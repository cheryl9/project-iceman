import re
import os
import sys
import json
import time
import signal
from datetime import datetime, timezone
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright


# ------------------------
# Logging (stderr)
# ------------------------
def log(*args):
    print(*args, file=sys.stderr, flush=True)


# ------------------------
# Helpers (same as your scraper)
# ------------------------
def clean(s: str) -> str:
    return re.sub(r"\s+", " ", s or "").strip()


def parse_doc_meta(label: str):
    m = re.search(r"\(([^)]+)\)", label)
    if not m:
        return {}
    inside = m.group(1)
    type_m = re.search(r"\b([A-Z]{2,5})\b", inside)
    size_m = re.search(r"(\d+(?:\.\d+)?)\s*KB", inside, re.I)
    out = {}
    if type_m:
        out["file_type"] = type_m.group(1)
    if size_m:
        out["size_kb"] = float(size_m.group(1))
    return out


FIELD_BY_MARKER = {
    "who can apply?": "who_can_apply",
    "who can apply": "who_can_apply",
    "when to apply?": "when_to_apply",
    "when to apply": "when_to_apply",
    "how much funding can you receive?": "funding",
    "how much funding can you receive": "funding",
    "how to apply?": "how_to_apply",
    "how to apply": "how_to_apply",
}


def split_by_text_markers(lines: list[str]) -> dict:
    buckets = {
        "about": [],
        "who_can_apply": [],
        "when_to_apply": [],
        "funding": [],
        "how_to_apply": [],
    }
    current = "about"

    for line in lines:
        t = clean(line)
        if not t:
            continue
        key = FIELD_BY_MARKER.get(t.lower())
        if key:
            current = key
            continue
        buckets[current].append(t)

    return buckets


def dump_debug(prefix: str, html: str, screenshot_bytes: bytes | None = None):
    os.makedirs("debug", exist_ok=True)
    html_path = os.path.join("debug", f"{prefix}.html")
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html)
    log(f"[DEBUG] Saved {html_path}")

    if screenshot_bytes:
        png_path = os.path.join("debug", f"{prefix}.png")
        with open(png_path, "wb") as f:
            f.write(screenshot_bytes)
        log(f"[DEBUG] Saved {png_path}")


def to_instruction_url(href: str) -> str:
    """
    Convert card URL to instruction URL.
    Examples:
      /grants/aicccmda  -> /grants/aicccmda/instruction
      /grants/aicccmda/instruction -> keep
    """
    # strip query/hash
    u = href.split("#", 1)[0].split("?", 1)[0]
    if u.endswith("/instruction"):
        return u
    if re.search(r"^/grants/[^/]+$", u):
        return u + "/instruction"
    # already a full URL?
    parsed = urlparse(u)
    if parsed.scheme and parsed.netloc:
        if u.endswith("/instruction"):
            return u
        if re.search(r"/grants/[^/]+$", u):
            return u + "/instruction"
    return u


# ------------------------
# Crawl listing page -> extract grant card links
# ------------------------
def extract_grant_links_from_listing(page, base_url: str) -> set[str]:
    """
    Pull candidate grant links from the rendered listing DOM.
    We intentionally use a heuristic approach to survive DOM/CSS changes.
    """
    anchors = page.eval_on_selector_all(
        "a[href]",
        "els => els.map(a => a.getAttribute('href')).filter(Boolean)"
    )

    out = set()
    for href in anchors:
        if not isinstance(href, str):
            continue

        # absolute -> keep; relative -> join later
        # Filter for grants
        if "/grants/" not in href:
            continue
        if href.startswith("/grants/new"):
            continue
        if "grant_directory" in href:
            continue
        if "/faq" in href:
            continue

        # Only keep plausible grant detail pages:
        # /grants/<slug> or /grants/<slug>/instruction
        m = re.match(r"^/grants/([^/]+)(/instruction)?/?$", href)
        if m:
            out.add(urljoin(base_url, href))

    return out


def auto_load_all_cards(page, max_rounds: int = 200):
    """
    Keep scrolling & clicking 'Load more' (if present) until link count stops increasing.
    """
    stable_rounds = 0
    prev_count = 0

    for r in range(max_rounds):
        links = extract_grant_links_from_listing(page, "https://oursggrants.gov.sg")
        count = len(links)
        log(f"[LIST] round={r+1} grant_links={count}")

        if count <= prev_count:
            stable_rounds += 1
        else:
            stable_rounds = 0
            prev_count = count

        # stop when stable for a few rounds
        if stable_rounds >= 3:
            break

        # try click "Load more" buttons (common pattern)
        clicked = False
        for selector in [
            "button:has-text('Load more')",
            "button:has-text('Load More')",
            "button:has-text('Show more')",
            "button:has-text('Show More')",
        ]:
            try:
                btn = page.locator(selector).first
                if btn and btn.is_visible():
                    btn.click(timeout=1500)
                    clicked = True
                    log(f"[LIST] clicked {selector}")
                    page.wait_for_timeout(800)
                    break
            except Exception:
                pass

        if clicked:
            continue

        # fallback: scroll
        try:
            page.mouse.wheel(0, 4000)
        except Exception:
            page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        page.wait_for_timeout(800)


# ------------------------
# Scrape one instruction page (reusing one browser)
# ------------------------
def scrape_instruction_page(page, url: str) -> dict:
    log("[SCRAPE] Visiting:", url)
    page.goto(url, wait_until="domcontentloaded", timeout=30000)
    try:
        page.wait_for_load_state("networkidle", timeout=20000)
    except Exception:
        pass

    # This selector is from your working script
    page.wait_for_selector(".form.instructions-page .card-body", timeout=30000)

    html = page.content()
    soup = BeautifulSoup(html, "html.parser")

    root = soup.select_one(".form.instructions-page")
    if not root:
        raise RuntimeError("Missing .form.instructions-page after render")

    agency_el = root.select_one(".card-title h2")
    title_el = root.select_one("#grant-header")
    agency = clean(agency_el.get_text(" ", strip=True)) if agency_el else None
    title = clean(title_el.get_text(" ", strip=True)) if title_el else None

    guideline = root.select_one("#guideline")
    if not guideline:
        raise RuntimeError("Missing #guideline")

    # Build lines from p + li (DOM order) and split by markers
    lines = []
    for el in guideline.find_all(["p", "li"]):
        t = clean(el.get_text(" ", strip=True))
        if t:
            lines.append(t)
    buckets = split_by_text_markers(lines)

    about = "\n".join(buckets["about"]) if buckets["about"] else None
    who_can_apply = "\n".join(buckets["who_can_apply"]) if buckets["who_can_apply"] else None
    when_to_apply = "\n".join(buckets["when_to_apply"]) if buckets["when_to_apply"] else None
    funding = "\n".join(buckets["funding"]) if buckets["funding"] else None
    how_to_apply = "\n".join(buckets["how_to_apply"]) if buckets["how_to_apply"] else None

    sections = []
    if buckets["about"]:
        sections.append({"heading": "About this grant", "content": buckets["about"]})
    if buckets["who_can_apply"]:
        sections.append({"heading": "Who Can Apply?", "content": buckets["who_can_apply"]})
    if buckets["when_to_apply"]:
        sections.append({"heading": "When to Apply?", "content": buckets["when_to_apply"]})
    if buckets["funding"]:
        sections.append({"heading": "How much funding can you receive?", "content": buckets["funding"]})
    if buckets["how_to_apply"]:
        sections.append({"heading": "How to apply?", "content": buckets["how_to_apply"]})

    # Documents (same heuristic)
    documents_required = []
    for a in root.select("a[href]"):
        label_raw = clean(a.get_text(" ", strip=True))
        href = a.get("href")
        if not href or not label_raw:
            continue

        looks_relevant = (
            re.search(r"(application|form|doc|pdf)", label_raw, re.I)
            or re.search(r"\.(pdf|docx?)$", href, re.I)
        )
        if not looks_relevant:
            continue

        meta = parse_doc_meta(label_raw)
        documents_required.append({
            "label": re.sub(r"\([^)]+\)", "", label_raw).strip(),
            "href": href if href.startswith("http") else urljoin(url, href),
            **meta
        })

    dedup = {d["href"]: d for d in documents_required}

    return {
        "source": "oursggrants",
        "source_url": url,
        "title": title,
        "agency": agency,
        "about": about,
        "who_can_apply": who_can_apply,
        "when_to_apply": when_to_apply,
        "funding": funding,
        "how_to_apply": how_to_apply,
        "sections": sections,
        "documents_required": list(dedup.values()),
        "metadata": {"last_scraped_at": datetime.now(timezone.utc).isoformat()},
    }


# ------------------------
# Main crawler
# ------------------------
def main():
    listing_url = "https://oursggrants.gov.sg/grants/new"
    limit = None  # set via CLI

    # CLI:
    # python3 scripts/crawl_oursg_grants_new.py [--limit 10] > grants.jsonl
    args = sys.argv[1:]
    if "--limit" in args:
        i = args.index("--limit")
        limit = int(args[i + 1])

    state = {"browser": None}

    def handle_sigint(signum, frame):
        log("\nCaught Ctrl+C — closing browser...")
        try:
            if state["browser"]:
                state["browser"].close()
        except Exception:
            pass
        raise SystemExit(130)

    signal.signal(signal.SIGINT, handle_sigint)

    with sync_playwright() as p:
        log("Launching browser...")
        browser = p.chromium.launch(headless=True)
        state["browser"] = browser

        context = browser.new_context(
            user_agent="Mozilla/5.0 (GrantMVPBot; +https://your-project.example)"
        )
        page = context.new_page()
        page.set_default_timeout(20000)

        log("Going to listing:", listing_url)
        page.goto(listing_url, wait_until="domcontentloaded", timeout=30000)
        try:
            page.wait_for_load_state("networkidle", timeout=20000)
        except Exception:
            pass

        # wait for any anchors to appear
        page.wait_for_selector("a[href*='/grants/']", timeout=30000)

        log("Auto-loading all grant cards (scroll/load more)...")
        auto_load_all_cards(page)

        all_links = extract_grant_links_from_listing(page, "https://oursggrants.gov.sg")
        log(f"[LIST] Total grant card links found: {len(all_links)}")

        # Convert to instruction URLs
        instruction_urls = []
        for link in sorted(all_links):
            # normalize
            if link.startswith("http"):
                # convert absolute /grants/x to /grants/x/instruction
                path = urlparse(link).path
                inst_path = to_instruction_url(path)
                instruction_urls.append(urljoin("https://oursggrants.gov.sg", inst_path))
            else:
                instruction_urls.append(urljoin("https://oursggrants.gov.sg", to_instruction_url(link)))

        # de-dup
        instruction_urls = list(dict.fromkeys(instruction_urls))
        log(f"[LIST] Instruction URLs: {len(instruction_urls)}")

        if limit is not None:
            instruction_urls = instruction_urls[:limit]
            log(f"[LIST] Applying limit={limit}, now {len(instruction_urls)} URLs")

        # Scrape each instruction page
        out_count = 0
        for idx, inst_url in enumerate(instruction_urls, start=1):
            try:
                # use a fresh page per grant (more stable)
                grant_page = context.new_page()
                grant_page.set_default_timeout(20000)

                data = scrape_instruction_page(grant_page, inst_url)
                grant_page.close()

                # JSONL to stdout (so redirect works cleanly)
                print(json.dumps(data, ensure_ascii=False))
                out_count += 1
                log(f"[OK] {idx}/{len(instruction_urls)} scraped")

            except Exception as e:
                log(f"[ERR] {idx}/{len(instruction_urls)} {inst_url} -> {e}")
                try:
                    # dump debug for this grant
                    dbg_page = context.pages[-1] if context.pages else page
                    dump_debug(f"fail_{idx}", dbg_page.content(), dbg_page.screenshot(full_page=True))
                except Exception:
                    pass
                continue

        log(f"Done. Scraped {out_count}/{len(instruction_urls)} grants.")
        browser.close()


if __name__ == "__main__":
    main()
