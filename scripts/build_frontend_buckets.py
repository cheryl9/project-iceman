import json
import re
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

INPUT = "grants_features.jsonl"          # <-- your current file
OUT_FRONTEND = "grants_frontend.jsonl"
OUT_FACETS = "facets.json"

# -----------------------
# Helpers
# -----------------------
def safe_get(d, *keys, default=None):
    cur = d
    for k in keys:
        if not isinstance(cur, dict) or k not in cur:
            return default
        cur = cur[k]
    return cur

def slug_from_url(url: str) -> str | None:
    # https://oursggrants.gov.sg/grants/<slug>/instruction
    m = re.search(r"/grants/([^/]+)/instruction", url or "")
    return m.group(1) if m else None

def parse_amounts(text: str) -> list[float]:
    """
    Extract currency-ish amounts like:
      $12,000  $20000  SGD 12,000  20,000
    Returns numeric amounts.
    """
    if not text:
        return []
    t = text.replace(",", "")
    # $12000 or SGD12000 or 12000 (we keep it simple)
    nums = re.findall(r"(?:SGD|\$)\s*(\d+(?:\.\d+)?)", t, flags=re.I)
    nums += re.findall(r"\b(\d{4,})(?:\.\d+)?\b", t)  # bare 4+ digit numbers
    out = []
    for x in nums:
        try:
            out.append(float(x))
        except:
            pass
    return out

def funding_bucket(grant: dict) -> dict:
    """
    Returns:
      {
        "band": "unknown" | "lt_5k" | "5k_20k" | "20k_100k" | "gt_100k",
        "percent_max": float|None,
        "cap_amount": float|None,
        "mentions_cofunding": bool,
        "amounts_found": [..]
      }
    """
    f = safe_get(grant, "grant_profile", "funding", default={}) or {}
    raw = f.get("raw") or ""
    amounts = parse_amounts(raw)

    # Prefer explicit cap_amount if it's real money; your current cap_amount sometimes stores percent.
    percent_max = f.get("percent_max")
    cap_amount = f.get("cap_amount")
    mentions_cofunding = bool(f.get("mentions_cofunding", False))

    # Determine a "money cap" candidate
    money_candidates = [a for a in amounts if a >= 100]  # ignore tiny numbers
    money_cap = max(money_candidates) if money_candidates else None

    if money_cap is None:
        band = "unknown"
    elif money_cap < 5000:
        band = "lt_5k"
    elif money_cap < 20000:
        band = "5k_20k"
    elif money_cap < 100000:
        band = "20k_100k"
    else:
        band = "gt_100k"

    return {
        "band": band,
        "percent_max": percent_max if isinstance(percent_max, (int, float)) else None,
        "cap_amount": cap_amount if isinstance(cap_amount, (int, float)) else None,
        "mentions_cofunding": mentions_cofunding,
        "amounts_found": sorted(set(money_candidates))[:10],
    }

def due_date_bucket(grant: dict) -> dict:
    """
    Uses grant_profile.application_window.
    Buckets:
      - all_year
      - has_dates
      - unknown
    Also returns any parsed start/end if present.
    """
    aw = safe_get(grant, "grant_profile", "application_window", default={}) or {}
    is_all_year = bool(aw.get("is_open_all_year", False))
    start = aw.get("start_date")
    end = aw.get("end_date")
    dates = aw.get("dates") or []

    if is_all_year:
        bucket = "all_year"
    elif start or end or dates:
        bucket = "has_dates"
    else:
        bucket = "unknown"

    return {
        "bucket": bucket,
        "start_date": start,
        "end_date": end,
        "dates": dates[:10],
        "raw": aw.get("raw"),
    }

def kpi_bucket(grant: dict) -> dict:
    """
    If your kpi_snippets is empty, we can still do a simple detection.
    """
    snippets = safe_get(grant, "grant_profile", "kpi_snippets", default=[]) or []
    if snippets:
        return {"mentions_kpi": True, "snippets": snippets[:10]}

    # Lightweight fallback scan in evidence/about
    text = " ".join([
        safe_get(grant, "about", default="") or "",
        safe_get(grant, "funding", default="") or "",
        safe_get(grant, "who_can_apply", default="") or "",
    ])
    text_l = text.lower()
    keywords = ["kpi", "deliverable", "outcome", "target", "must", "required", "reporting", "evaluation"]
    mentions = any(k in text_l for k in keywords)
    return {"mentions_kpi": mentions, "snippets": []}

def scope_bucket(grant: dict) -> list[str]:
    """
    Uses grant_profile.scope_tags, but normalizes to UI-friendly categories.
    """
    scope_tags = safe_get(grant, "grant_profile", "scope_tags", default=[]) or []
    scope_tags = [str(x) for x in scope_tags]

    # Optional: map to nicer UI buckets
    mapping = {
        "training_manpower": "Manpower & Training",
        "project_based": "Project / Programme",
        "capex": "Equipment / Capex",
        "opex": "Operating Costs",
        "research": "Research",
        "pilot": "Pilot / Trial",
        "digitalisation": "Digital / Tech",
    }

    out = []
    for t in scope_tags:
        out.append(mapping.get(t, t))  # keep original if unknown
    return sorted(set(out))

# -----------------------
# Main build
# -----------------------
def main():
    inp = Path(INPUT)
    if not inp.exists():
        raise SystemExit(f"Input not found: {INPUT}")

    facets = {
        "issue_areas": Counter(),
        "scope": Counter(),
        "funding_band": Counter(),
        "due_date_bucket": Counter(),
        "agency": Counter(),
        "mentions_kpi": Counter(),
    }

    with open(OUT_FRONTEND, "w", encoding="utf-8") as out_f:
        with open(INPUT, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue

                g = json.loads(line)

                url = g.get("source_url")
                slug = slug_from_url(url) or g.get("id") or None

                issue_areas = safe_get(g, "grant_profile", "issue_areas", default=[]) or []
                issue_areas = [str(x) for x in issue_areas]

                scope = scope_bucket(g)
                fund = funding_bucket(g)
                due = due_date_bucket(g)
                kpi = kpi_bucket(g)

                # ---- update facets ----
                for ia in issue_areas:
                    facets["issue_areas"][ia] += 1
                for sc in scope:
                    facets["scope"][sc] += 1
                facets["funding_band"][fund["band"]] += 1
                facets["due_date_bucket"][due["bucket"]] += 1
                if g.get("agency"):
                    facets["agency"][g["agency"]] += 1
                facets["mentions_kpi"][str(bool(kpi["mentions_kpi"]))] += 1

                # ---- compact frontend record ----
                rec = {
                    "id": slug,
                    "title": g.get("title"),
                    "agency": g.get("agency"),
                    "source_url": url,

                    # buckets / filters
                    "issue_areas": issue_areas,
                    "scope": scope,
                    "funding": fund,
                    "application": due,
                    "kpi": kpi,

                    # optional UI preview text (keep short)
                    "blurb": (g.get("about") or "")[:280].strip() or None,
                }

                out_f.write(json.dumps(rec, ensure_ascii=False) + "\n")

    # write facets
    facets_out = {k: dict(v.most_common()) for k, v in facets.items()}
    with open(OUT_FACETS, "w", encoding="utf-8") as f:
        json.dump(facets_out, f, ensure_ascii=False, indent=2)

    print(f"✅ Wrote: {OUT_FRONTEND}")
    print(f"✅ Wrote: {OUT_FACETS}")

if __name__ == "__main__":
    main()
