import re
import os
import sys
import json
import signal
from datetime import datetime, timezone
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup
from bs4.element import NavigableString, Tag
from playwright.sync_api import sync_playwright


# ------------------------
# Logging (stderr)
# ------------------------
def log(*args):
    print(*args, file=sys.stderr, flush=True)


# ------------------------
# Helpers (same as main scraper)
# ------------------------
def clean(s: str) -> str:
    return re.sub(r"\s+", " ", s or "").strip()


def norm(s: str) -> str:
    return clean(s).lower()


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
    u = href.split("#", 1)[0].split("?", 1)[0]
    if u.endswith("/instruction"):
        return u
    if re.search(r"^/grants/[^/]+$", u):
        return u + "/instruction"

    parsed = urlparse(u)
    if parsed.scheme and parsed.netloc:
        if u.endswith("/instruction"):
            return u
        if re.search(r"/grants/[^/]+$", parsed.path):
            return u + "/instruction"
    return u


# ------------------------
# KEYMAP (match main script)
# ------------------------
KEYMAP = {
    "who can apply?": "who_can_apply",
    "when can i apply?": "when_to_apply",
    "when to apply?": "when_to_apply",
    "how much funding can you receive?": "funding",
    "how to apply?": "how_to_apply",
}


# ------------------------
# About + Others from #guideline
#   - About: normal intro text + bullets
#   - Others: sub-sections like <p class="instruction-header">Title</p> + content
# ------------------------
def extract_about_and_others_from_guideline(root) -> tuple[list[str], list[dict]]:
    guideline = root.select_one("#guideline")
    if not guideline:
        return [], []

    about_lines: list[str] = []
    others: list[dict] = []

    current_heading: str | None = None
    current_content: list[str] = []

    def push_current():
        nonlocal current_heading, current_content
        if current_heading:
            cleaned = [clean(x).strip('"').strip() for x in current_content if clean(x)]
            if cleaned:
                others.append({"heading": current_heading, "content": cleaned})
        current_heading = None
        current_content = []

    # iterate in DOM order over direct children
    for child in guideline.children:
        # direct text nodes
        if isinstance(child, NavigableString):
            t = clean(str(child)).strip('"').strip()
            if not t:
                continue
            if current_heading:
                current_content.append(t)
            else:
                about_lines.append(t)
            continue

        if not isinstance(child, Tag):
            continue

        # instruction-header defines an "others" section
        if child.name == "p" and "instruction-header" in (child.get("class", []) or []):
            push_current()
            h = clean(child.get_text(" ", strip=True))
            current_heading = h if h else None
            continue

        # normal paragraph
        if child.name == "p":
            t = clean(child.get_text(" ", strip=True)).strip('"').strip()
            if not t:
                continue
            if current_heading:
                current_content.append(t)
            else:
                about_lines.append(t)
            continue

        # bullet list
        if child.name == "ul":
            lis = [clean(li.get_text(" ", strip=True)) for li in child.find_all("li")]
            lis = [x for x in lis if x]
            if not lis:
                continue
            if current_heading:
                current_content.extend(lis)
            else:
                about_lines.extend(lis)
            continue

        # fallback: any other tag
        t = clean(child.get_text(" ", strip=True)).strip('"').strip()
        if t:
            if current_heading:
                current_content.append(t)
            else:
                about_lines.append(t)

    push_current()

    # fallback: if about still empty, take all text
    if not about_lines:
        txt = clean(guideline.get_text("\n", strip=True))
        if txt:
            about_lines = [line.strip() for line in txt.split("\n") if line.strip()]

    return about_lines, others


# ------------------------
# Section parsing (keep your working approach)
# ------------------------
def is_inside_attachments(el) -> bool:
    cur = el
    while cur is not None and getattr(cur, "name", None):
        if cur.name.lower() == "div":
            cls = " ".join(cur.get("class", []))
            if "attachments" in cls:
                return True
            if cur.get("aria-label") == "attachment-section":
                return True
        cur = cur.parent
    return False


def is_heading(el) -> bool:
    if not getattr(el, "name", None):
        return False

    tag = el.name.lower()
    if tag in ("h2", "h3", "h4"):
        return True

    if tag == "div":
        cls = " ".join(el.get("class", []))
        return "Title_" in cls

    if tag == "p":
        return "sub-head" in (el.get("class", []) or [])

    return False


def get_heading_text(el) -> str:
    return clean(el.get_text(" ", strip=True))


def should_capture_div_text(el) -> bool:
    if not getattr(el, "name", None) or el.name.lower() != "div":
        return False
    cls = set(el.get("class", []) or [])
    if "text" not in cls:
        return False
    if el.find(["p", "li"]) is not None:
        return False
    t = el.get_text(" ", strip=True) or ""
    return bool(clean(t))


def extract_sections_excluding_about(card_body) -> list[dict]:
    sections = []
    current_heading = None
    current_content = []

    def push():
        nonlocal current_heading, current_content
        if not current_heading:
            return
        cleaned = [c for c in (x.strip() for x in current_content) if c]
        sections.append({"heading": current_heading, "content": cleaned})
        current_heading = None
        current_content = []

    for el in card_body.descendants:
        if not getattr(el, "name", None):
            continue

        if is_inside_attachments(el):
            continue

        if is_heading(el):
            h = get_heading_text(el)
            if h:
                if norm(h) == "about this grant":
                    current_heading = None
                    current_content = []
                    continue
                if current_heading is not None:
                    push()
                current_heading = h
                current_content = []
            continue

        if current_heading is None:
            continue

        tag = el.name.lower()

        if tag == "p":
            if "sub-head" in (el.get("class", []) or []):
                continue
            t = (el.get_text("\n", strip=True) or "").strip()
            if t:
                current_content.append(t)
            continue

        if tag == "li":
            t = (el.get_text("\n", strip=True) or "").strip()
            if t:
                current_content.append(t)
            continue

        if should_capture_div_text(el):
            t = (el.get_text("\n", strip=True) or "").strip()
            if t:
                current_content.append(t)
            continue

    if current_heading is not None:
        push()

    return sections


def map_sections_to_fields(about_lines: list[str], other_sections: list[dict]) -> dict:
    fields = {
        "about": "\n".join(about_lines) if about_lines else None,
        "who_can_apply": None,
        "when_to_apply": None,
        "funding": None,
        "how_to_apply": None,
    }

    for s in other_sections:
        h = norm(s["heading"])
        field = KEYMAP.get(h)
        if not field:
            continue
        fields[field] = "\n".join(s["content"]) if s["content"] else ""

    return fields


# ------------------------
# Minimal fallback for How to apply? (match main script)
# ------------------------
def extract_how_to_apply_fallback(root) -> str | None:
    """
    Fallback when the content is in the next sibling div.text:
      <div class="Title_...">How to apply?</div>
      <div class="text"> ... </div>
    """
    if not root:
        return None

    title_divs = root.select("div[class*='Title_']")
    target = None
    for d in title_divs:
        if norm(d.get_text(" ", strip=True)) == "how to apply?":
            target = d
            break
    if not target:
        return None

    sib = target.next_sibling
    while sib is not None:
        if isinstance(sib, str):
            sib = sib.next_sibling
            continue
        if getattr(sib, "name", "").lower() == "div":
            cls = set(sib.get("class", []) or [])
            if "text" in cls:
                t = (sib.get_text("\n", strip=True) or "").strip().strip('"').strip()
                return t or None
        sib = sib.next_sibling

    return None


# ------------------------
# Documents: label + href only (match main script)
# ------------------------
def extract_documents(root, base_url: str) -> list[dict]:
    docs = []
    attachments = root.select_one("div.attachments[aria-label='attachment-section']")
    if not attachments:
        return []

    for a in attachments.select("a[href]"):
        href = a.get("href")
        label = a.get_text(" ", strip=True)
        if not href or not label:
            continue
        docs.append({
            "label": label.strip(),
            "href": href if href.startswith("http") else urljoin(base_url, href),
        })

    dedup = {d["href"]: d for d in docs}
    return list(dedup.values())


# ------------------------
# Crawl listing page -> extract grant card links
# ------------------------
def extract_grant_links_from_listing(page, base_url: str) -> set[str]:
    anchors = page.eval_on_selector_all(
        "a[href]",
        "els => els.map(a => a.getAttribute('href')).filter(Boolean)"
    )

    out = set()
    for href in anchors:
        if not isinstance(href, str):
            continue

        if "/grants/" not in href:
            continue
        if href.startswith("/grants/new"):
            continue
        if "grant_directory" in href:
            continue
        if "/faq" in href:
            continue

        m = re.match(r"^/grants/([^/]+)(/instruction)?/?$", href)
        if m:
            out.add(urljoin(base_url, href))

    return out


def auto_load_all_cards(page, max_rounds: int = 200):
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

        if stable_rounds >= 3:
            break

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

        try:
            page.mouse.wheel(0, 4000)
        except Exception:
            page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        page.wait_for_timeout(800)


# ------------------------
# Scrape one instruction page (uses the same logic as main script)
# ------------------------
def scrape_instruction_page(page, url: str) -> dict:
    log("[SCRAPE] Visiting:", url)
    page.goto(url, wait_until="domcontentloaded", timeout=30000)
    try:
        page.wait_for_load_state("networkidle", timeout=20000)
    except Exception:
        pass

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

    card_body = root.select_one(".card-body")
    if not card_body:
        raise RuntimeError("Missing .card-body")

    # UPDATED: about + others
    about_lines, others = extract_about_and_others_from_guideline(root)

    other_sections = extract_sections_excluding_about(card_body)
    fields = map_sections_to_fields(about_lines, other_sections)

    # sections[] output (about first)
    sections = []
    if about_lines:
        sections.append({"heading": "About this grant", "content": about_lines})
    sections.extend(other_sections)

    # How to apply fallback (only if missing/empty)
    how_to_apply = fields["how_to_apply"]
    if how_to_apply is None or (isinstance(how_to_apply, str) and how_to_apply.strip() == ""):
        fb = extract_how_to_apply_fallback(root)
        if fb:
            fields["how_to_apply"] = fb
            # keep sections consistent
            updated = False
            for s in sections:
                if norm(s["heading"]) == "how to apply?":
                    s["content"] = [fb]
                    updated = True
                    break
            if not updated:
                sections.append({"heading": "How to apply?", "content": [fb]})

    documents_required = extract_documents(root, url)

    return {
        "source": "oursggrants",
        "source_url": url,
        "title": title,
        "agency": agency,
        "about": fields["about"],
        "who_can_apply": fields["who_can_apply"],
        "when_to_apply": fields["when_to_apply"],
        "funding": fields["funding"],
        "how_to_apply": fields["how_to_apply"],
        "others": others,
        "sections": sections,
        "documents_required": documents_required,
        "metadata": {"last_scraped_at": datetime.now(timezone.utc).isoformat()},
    }


# ------------------------
# Main crawler
# ------------------------
def main():
    listing_url = "https://oursggrants.gov.sg/grants/new"
    limit = None

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

        page.wait_for_selector("a[href*='/grants/']", timeout=30000)

        log("Auto-loading all grant cards (scroll/load more)...")
        auto_load_all_cards(page)

        all_links = extract_grant_links_from_listing(page, "https://oursggrants.gov.sg")
        log(f"[LIST] Total grant card links found: {len(all_links)}")

        # Convert to instruction URLs
        instruction_urls = []
        for link in sorted(all_links):
            if link.startswith("http"):
                path = urlparse(link).path
                inst_path = to_instruction_url(path)
                instruction_urls.append(urljoin("https://oursggrants.gov.sg", inst_path))
            else:
                instruction_urls.append(urljoin("https://oursggrants.gov.sg", to_instruction_url(link)))

        instruction_urls = list(dict.fromkeys(instruction_urls))
        log(f"[LIST] Instruction URLs: {len(instruction_urls)}")

        if limit is not None:
            instruction_urls = instruction_urls[:limit]
            log(f"[LIST] Applying limit={limit}, now {len(instruction_urls)} URLs")

        out_count = 0
        for idx, inst_url in enumerate(instruction_urls, start=1):
            try:
                grant_page = context.new_page()
                grant_page.set_default_timeout(20000)

                data = scrape_instruction_page(grant_page, inst_url)
                grant_page.close()

                # JSONL to stdout (redirect-safe)
                print(json.dumps(data, ensure_ascii=False))
                out_count += 1
                log(f"[OK] {idx}/{len(instruction_urls)} scraped")

            except Exception as e:
                log(f"[ERR] {idx}/{len(instruction_urls)} {inst_url} -> {e}")
                try:
                    dbg_page = context.pages[-1] if context.pages else page
                    dump_debug(
                        f"fail_{idx}",
                        dbg_page.content(),
                        dbg_page.screenshot(full_page=True),
                    )
                except Exception:
                    pass
                continue

        log(f"Done. Scraped {out_count}/{len(instruction_urls)} grants.")
        browser.close()


if __name__ == "__main__":
    main()
