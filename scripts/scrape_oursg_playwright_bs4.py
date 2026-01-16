import re
import json
import signal
import sys
from datetime import datetime, timezone
from urllib.parse import urljoin

from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright


# ------------------------
# Logging (stderr only)
# ------------------------
def log(*args):
    print(*args, file=sys.stderr, flush=True)


# ------------------------
# Helpers
# ------------------------
def clean(s: str) -> str:
    return re.sub(r"\s+", " ", s or "").strip()


def norm(s: str) -> str:
    return clean(s).lower()


def dump_debug(page, html: str, reason: str):
    log(f"[DEBUG] {reason} -> saving debug.html and debug.png")
    with open("debug.html", "w", encoding="utf-8") as f:
        f.write(html)
    page.screenshot(path="debug.png", full_page=True)


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
    """
    Heading patterns on OurSG instruction pages:
      1) Title_* divs (React/CSS modules)
      2) h2/h3/h4
      3) <p class="sub-head">Who can apply?</p> etc.
    """
    if not getattr(el, "name", None):
        return False

    tag = el.name.lower()

    if tag in ("h2", "h3", "h4"):
        return True

    if tag == "div":
        cls = " ".join(el.get("class", []))
        if "Title_" in cls:
            return True

    if tag == "p":
        cls_list = el.get("class", []) or []
        if "sub-head" in cls_list:
            return True

    return False


def get_heading_text(el) -> str:
    return clean(el.get_text(" ", strip=True))


def should_capture_div_text(el) -> bool:
    """
    Capture div blocks that contain plain text instructions, e.g.:
      <div class="text">Completing the grant application...</div>
    Sometimes it's 'text divider', sometimes just 'text'.
    """
    if not getattr(el, "name", None) or el.name.lower() != "div":
        return False

    cls = set(el.get("class", []) or [])
    if "text" not in cls:
        return False

    # If it contains p/li, we'll capture those separately
    if el.find(["p", "li"]) is not None:
        return False

    t = el.get_text(" ", strip=True) or ""
    return bool(clean(t))


# ------------------------
# About: scrape from #guideline (handles raw text nodes + li)
# ------------------------
def extract_about_from_guideline(root) -> list[str]:
    guideline = root.select_one("#guideline")
    if not guideline:
        return []

    lines = []

    # Direct text nodes inside #guideline (captures raw quoted text nodes)
    for t in guideline.find_all(string=True, recursive=False):
        s = (t or "").strip()
        s = s.strip('"').strip()
        if s:
            lines.append(s)

    # List items
    for li in guideline.find_all("li"):
        t = (li.get_text(" ", strip=True) or "").strip()
        if t:
            lines.append(t)

    # fallback
    if not lines:
        txt = (guideline.get_text("\n", strip=True) or "").strip()
        if txt:
            lines.append(txt)

    return lines


# ------------------------
# SECTION PARSING (your original approach)
# ------------------------
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
                # skip About heading (handled separately)
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

    log("Sections extracted (excluding about):", [s["heading"] for s in sections])
    return sections


# ------------------------
# Keymap (simplified exact headings)
# ------------------------
KEYMAP = {
    "who can apply?": "who_can_apply",
    "when can i apply?": "when_to_apply",
    "when to apply?": "when_to_apply",
    "how much funding can you receive?": "funding",
    "how to apply?": "how_to_apply",
}



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
# Documents: label + href only
# ------------------------
def extract_documents(root, base_url: str):
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
# MINIMAL FIX: How to apply? fallback
# ------------------------
def extract_how_to_apply_fallback(root) -> str | None:
    """
    Fallback when 'How to apply?' content is in the next sibling div.text.
    Pattern:
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
# Main scrape
# ------------------------
def scrape(url: str) -> dict:
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
            raise RuntimeError("Could not find .form.instructions-page")

        agency_el = root.select_one(".card-title h2")
        title_el = root.select_one("#grant-header")
        agency = clean(agency_el.get_text(" ", strip=True)) if agency_el else None
        title = clean(title_el.get_text(" ", strip=True)) if title_el else None

        log("Extracted agency:", agency)
        log("Extracted title:", title)

        card_body = root.select_one(".card-body")
        if not card_body:
            dump_debug(page, html, "Could not find .card-body")
            browser.close()
            raise RuntimeError("Could not find .card-body")

        about_lines = extract_about_from_guideline(root)
        log("About lines count:", len(about_lines))

        other_sections = extract_sections_excluding_about(card_body)
        fields = map_sections_to_fields(about_lines, other_sections)

        # Build full sections list (About first)
        sections = []
        if about_lines:
            sections.append({"heading": "About this grant", "content": about_lines})
        sections.extend(other_sections)

        # --- MINIMAL FIX APPLIED HERE (only if missing/empty) ---
        how_to_apply = fields["how_to_apply"]
        if how_to_apply is None or (isinstance(how_to_apply, str) and how_to_apply.strip() == ""):
            fallback = extract_how_to_apply_fallback(root)
            if fallback:
                fields["how_to_apply"] = fallback
                # keep sections consistent too
                updated = False
                for s in sections:
                    if norm(s["heading"]) == "how to apply?":
                        s["content"] = [fallback]
                        updated = True
                        break
                if not updated:
                    sections.append({"heading": "How to apply?", "content": [fallback]})

        log("Extracting documents...")
        documents_required = extract_documents(root, url)

        # sanity check
        if not any([
            fields["about"],
            fields["who_can_apply"],
            fields["when_to_apply"],
            fields["funding"],
            fields["how_to_apply"],
        ]):
            dump_debug(page, html, "Parsed 0 meaningful fields")
            browser.close()
            raise RuntimeError("Parsed 0 meaningful fields")

        browser.close()
        log("Closing browser...")

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
            "sections": sections,
            "documents_required": documents_required,
            "metadata": {"last_scraped_at": datetime.now(timezone.utc).isoformat()},
        }


if __name__ == "__main__":
    # python3 scripts/scrape_oursg_playwright_bs4.py "<url>" > grant.json
    url = sys.argv[1] if len(sys.argv) > 1 else "https://oursggrants.gov.sg/grants/aicccmda/instruction"
    data = scrape(url)
    print(json.dumps(data, indent=2, ensure_ascii=False))
