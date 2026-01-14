import re
import json
import signal
import sys
from datetime import datetime, timezone
from urllib.parse import urljoin
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright


def log(*args):
    # Logs to terminal even when stdout is redirected to a file
    print(*args, file=sys.stderr, flush=True)


def clean(s: str) -> str:
    return re.sub(r"\s+", " ", s or "").strip()


def norm(s: str) -> str:
    return clean(s).lower()


def parse_doc_meta(label: str):
    # e.g. "CCMDA... (DOCX 61.6 KB)"
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


def dump_debug(page, html: str, reason: str):
    log(f"[DEBUG] {reason} -> saving debug.html and debug.png")
    with open("debug.html", "w", encoding="utf-8") as f:
        f.write(html)
    page.screenshot(path="debug.png", full_page=True)


def is_heading_tag(tagname: str) -> bool:
    return tagname in ("h1", "h2", "h3", "h4")


def is_portal_heading(el) -> bool:
    """
    Supports:
      - h2/h3/h4 headings
      - div with class containing 'Title_'
      - elements with role='heading'
    """
    tag = (el.name or "").lower()
    if is_heading_tag(tag):
        return True

    if tag == "div":
        cls = " ".join(el.get("class", []))
        if "Title_" in cls:
            return True

    if el.get("role") == "heading":
        return True

    return False


# Text-marker fallback (when portal doesn't use real headings)
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
            continue  # do not include the marker itself

        buckets[current].append(t)

    return buckets


def split_sections(container) -> list[dict]:
    """
    Walks through container descendants in DOM order.
    Starts with 'About this grant' until a heading is found.
    Collects p/li text into current section.
    """
    sections = []
    current_heading = "About this grant"
    current_content = []

    def push():
        nonlocal current_heading, current_content
        cleaned = [clean(x) for x in current_content if clean(x)]
        if cleaned:
            sections.append({"heading": current_heading, "content": cleaned})

    for el in container.descendants:
        if not getattr(el, "name", None):
            continue

        tag = el.name.lower()

        if is_portal_heading(el):
            h = clean(el.get_text(" ", strip=True))
            if h:
                push()
                current_heading = h
                current_content = []
            continue

        if tag == "p":
            t = clean(el.get_text(" ", strip=True))
            if t:
                current_content.append(t)
            continue

        if tag == "li":
            t = clean(el.get_text(" ", strip=True))
            if t:
                current_content.append(t)
            continue

    push()
    return sections


def find_section(sections: list[dict], *names: str):
    want = set(norm(n) for n in names)
    for s in sections:
        if norm(s["heading"]) in want:
            return s
    return None


def scrape(url: str) -> dict:
    # Keep reference for SIGINT
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

    log("Launching browser...")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        state["browser"] = browser

        page = browser.new_page(
            user_agent="Mozilla/5.0 (GrantMVPBot; +https://your-project.example)"
        )
        page.set_default_timeout(20000)

        log("Going to page:", url)
        page.goto(url, wait_until="domcontentloaded", timeout=30000)
        try:
            page.wait_for_load_state("networkidle", timeout=30000)
        except Exception:
            pass

        log("Waiting for instructions page...")
        page.wait_for_selector(".form.instructions-page .card-body", timeout=30000)

        html = page.content()
        soup = BeautifulSoup(html, "html.parser")

        root = soup.select_one(".form.instructions-page")
        if not root:
            dump_debug(page, html, "Could not find .form.instructions-page")
            browser.close()
            raise RuntimeError("Could not find .form.instructions-page. Saved debug.html/debug.png")

        agency_el = root.select_one(".card-title h2")
        title_el = root.select_one("#grant-header")

        agency = clean(agency_el.get_text(" ", strip=True)) if agency_el else None
        title = clean(title_el.get_text(" ", strip=True)) if title_el else None

        log("Extracted agency:", agency)
        log("Extracted title:", title)

        # ---------------------------
        # SECTION PARSING
        # ---------------------------
        guideline = root.select_one("#guideline")
        log("Guideline found:", 1 if guideline else 0)

        if not guideline:
            dump_debug(page, html, "Could not find #guideline")
            browser.close()
            raise RuntimeError("Could not find #guideline. Saved debug.html/debug.png")

        direct_children = [c for c in guideline.find_all(recursive=False) if getattr(c, "name", None)]
        log("Guideline direct child count:", len(direct_children))

        headings_preview = []
        for c in guideline.find_all(["h2", "h3", "h4"]):
            headings_preview.append(clean(c.get_text(" ", strip=True)))
        log("Guideline heading tags found:", headings_preview)

        # First try heading-based split
        sections = split_sections(guideline)
        log("Sections extracted:", [s["heading"] for s in sections])

        about = who_can_apply = when_to_apply = funding = how_to_apply = None

        only_one_section = (len(sections) <= 1)
        no_heading_tags = (len(headings_preview) == 0)

        if only_one_section and no_heading_tags:
            log("[INFO] No heading tags found; using text-marker splitting fallback...")

            lines = []
            for el in guideline.find_all(["p", "li"]):
                t = clean(el.get_text(" ", strip=True))
                if t:
                    lines.append(t)

            buckets = split_by_text_markers(lines)

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

            about = "\n".join(buckets["about"]) if buckets["about"] else None
            who_can_apply = "\n".join(buckets["who_can_apply"]) if buckets["who_can_apply"] else None
            when_to_apply = "\n".join(buckets["when_to_apply"]) if buckets["when_to_apply"] else None
            funding = "\n".join(buckets["funding"]) if buckets["funding"] else None
            how_to_apply = "\n".join(buckets["how_to_apply"]) if buckets["how_to_apply"] else None

            log("Sections extracted (fallback):", [s["heading"] for s in sections])

        else:
            about_sec = find_section(sections, "About this grant", "About", "Overview", "Description")
            who_sec = find_section(sections, "Who Can Apply?", "Who Can Apply", "Eligibility", "Eligible Applicants")
            when_sec = find_section(sections, "When to Apply?", "When to Apply", "Application Period", "Deadline")
            fund_sec = find_section(
                sections,
                "How much funding can you receive?",
                "How much funding can you receive",
                "Funding",
                "Grant amount",
                "Support level",
            )
            how_sec = find_section(sections, "How to apply?", "How to apply", "Application process", "How to Apply")

            about = "\n".join(about_sec["content"]) if about_sec else None
            who_can_apply = "\n".join(who_sec["content"]) if who_sec else None
            when_to_apply = "\n".join(when_sec["content"]) if when_sec else None
            funding = "\n".join(fund_sec["content"]) if fund_sec else None
            how_to_apply = "\n".join(how_sec["content"]) if how_sec else None

        if not any([about, who_can_apply, when_to_apply, funding]):
            dump_debug(page, html, "Parsed 0 meaningful sections (after fallback)")
            browser.close()
            raise RuntimeError("Parsed 0 meaningful sections. Saved debug.html/debug.png")

        # ---------------------------
        # DOCUMENTS REQUIRED
        # ---------------------------
        log("Extracting documents...")
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
            documents_required.append(
                {
                    "label": re.sub(r"\([^)]+\)", "", label_raw).strip(),
                    "href": href if href.startswith("http") else urljoin(url, href),
                    **meta,
                }
            )

        dedup = {d["href"]: d for d in documents_required}

        browser.close()
        log("Closing browser...")

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


if __name__ == "__main__":
    # CLI:
    #   python3 scripts/scrape_oursg_playwright_bs4.py "<url>" > grant.json
    import sys as _sys

    url = (
        _sys.argv[1]
        if len(_sys.argv) > 1
        else "https://oursggrants.gov.sg/grants/aicccmda/instruction"
    )
    data = scrape(url)

    # IMPORTANT: JSON to stdout only (so redirects produce clean JSON files)
    print(json.dumps(data, indent=2, ensure_ascii=False))
