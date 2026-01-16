import argparse
import json
import math
import re
from collections import Counter
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple


# ------------------------
# Text utils
# ------------------------
WS_RE = re.compile(r"\s+")
def clean(s: Optional[str]) -> str:
    return WS_RE.sub(" ", (s or "")).strip()

def norm(s: Optional[str]) -> str:
    return clean(s).lower()

def join_nonempty(parts: List[str], sep: str = "\n") -> str:
    parts = [clean(p) for p in parts if clean(p)]
    return sep.join(parts).strip()


# ------------------------
# NPO-focused taxonomies (tweak anytime)
# ------------------------
ISSUE_AREAS = {
    "ageing": ["elderly", "senior", "ageing", "aging", "dementia", "retirement", "caregiver"],
    "health": ["health", "healthcare", "nursing", "clinic", "medical", "wellness", "disease", "mental health"],
    "community": ["community", "volunteer", "social service", "social services", "family", "residents", "grassroots"],
    "education": ["school", "students", "education", "training", "upskill", "reskill", "workshop", "course", "learning"],
    "employment": ["employment", "job", "jobs", "hiring", "recruit", "recruitment", "career", "workforce"],
    "environment": ["climate", "environment", "sustainability", "carbon", "recycling", "green", "biodiversity"],
    "arts_culture": ["arts", "culture", "heritage", "museum", "music", "dance", "theatre", "literature"],
    "sports": ["sport", "sports", "physical activity", "fitness", "exercise", "team singapore", "youthcreates"],
    "youth": ["youth", "young", "teen", "students", "youthcreates"],
    "disability_inclusion": ["disability", "inclusive", "inclusion", "special needs", "accessibility", "assistive"],
    "digital_tech": ["digital", "technology", "tech", "software", "platform", "system", "solution", "digitalisation", "digitalization"],
}

SCOPE_TAGS = {
    "training_manpower": ["training", "attachment", "attachments", "leadership programme", "talent", "capability", "manpower", "upskill", "reskill"],
    "project_based": ["project", "initiative", "scheme", "pilot", "implementation", "deliverables"],
    "equipment_capex": ["equipment", "hardware", "device", "capex", "purchase", "procure", "implementation cost"],
    "operations_support": ["operating cost", "operational", "opex", "recurring", "day-to-day", "running cost"],
    "research_evaluation": ["research", "study", "evaluate", "evaluation", "impact assessment", "data collection"],
}

# For KPI snippets, we just capture lines that look like outcomes/targets/deliverables.
KPI_MARKERS = [
    "kpi", "key performance", "outcome", "deliverable", "target", "objective", "milestone",
    "impact", "indicator", "measure", "measurable", "must achieve", "should achieve"
]


# ------------------------
# Funding extraction (FIXED)
# ------------------------
PERCENT_RE = re.compile(r"(\d+(?:\.\d+)?)\s*%")
# Currency amounts like "$12,000" / "S$20,000" / "$20000"
MONEY_RE = re.compile(r"\b(?:S?\$)\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\b", re.I)

CAP_MARKERS = ["cap", "capped", "up to", "maximum", "max", "not exceed", "no more than"]
COFUND_MARKERS = ["co-fund", "cofund", "co-funding", "co funding", "co-funded", "co funded", "match", "matched", "co-pay", "copay"]

def extract_funding(raw_text: str) -> Dict[str, Any]:
    raw = clean(raw_text)
    low = norm(raw)

    percents = [float(m.group(1)) for m in PERCENT_RE.finditer(raw)]
    percent_max = max(percents) if percents else None

    amounts: List[Tuple[float, int]] = []
    for m in MONEY_RE.finditer(raw):
        try:
            val = float(m.group(1).replace(",", ""))
            amounts.append((val, m.start()))
        except Exception:
            pass

    # cap_amount only if a currency amount appears near cap markers
    cap_amount_sgd = None
    for val, pos in amounts:
        window = low[max(0, pos - 80): pos + 80]
        if any(k in window for k in CAP_MARKERS):
            cap_amount_sgd = val
            break

    mentions_cofunding = any(k in low for k in COFUND_MARKERS)

    return {
        "percent_max": percent_max,
        "cap_amount_sgd": cap_amount_sgd,
        "mentions_cofunding": mentions_cofunding,
        "raw": raw or None,
    }


# ------------------------
# Application window/date extraction (dedup + focused)
# ------------------------
DATE_RE = re.compile(r"\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+(\d{4})\b", re.I)
MONTH_MAP = {"jan":1,"feb":2,"mar":3,"apr":4,"may":5,"jun":6,"jul":7,"aug":8,"sep":9,"sept":9,"oct":10,"nov":11,"dec":12}

def _match_to_iso(m) -> Optional[str]:
    try:
        d = int(m.group(1))
        mon = MONTH_MAP[m.group(2).lower()]
        y = int(m.group(3))
        return datetime(y, mon, d, tzinfo=timezone.utc).date().isoformat()
    except Exception:
        return None

def extract_application_window(when_text: str) -> Dict[str, Any]:
    raw = clean(when_text)
    low = norm(raw)

    if not raw:
        return {
            "is_open_all_year": None,
            "dates": [],
            "start_date": None,
            "end_date": None,
            "raw": None,
        }

    is_open_all_year = any(x in low for x in [
        "throughout the year", "all year", "all year round", "year-round", "year round", "open throughout"
    ])

    dates: List[str] = []
    for m in DATE_RE.finditer(raw):
        iso = _match_to_iso(m)
        if iso:
            dates.append(iso)

    # DEDUPE
    dates = sorted(set(dates))

    start_date = dates[0] if dates else None
    end_date = dates[-1] if len(dates) >= 2 else (dates[0] if dates else None)

    return {
        "is_open_all_year": is_open_all_year,
        "dates": dates,
        "start_date": start_date,
        "end_date": end_date,
        "raw": raw,
    }


# ------------------------
# Issue areas + scope tags
# ------------------------
def has_digital_tech(text: str) -> bool:
    t = norm(text)
    has_core = any(k in t for k in ["digital", "technology", "tech", "digitalisation", "digitalization"])
    has_context = any(k in t for k in ["platform", "system", "software", "solution", "transformation", "adopt", "adoption", "implement"])
    return has_core and has_context

def extract_issue_areas(text: str) -> List[str]:
    t = norm(text)
    hits: List[str] = []

    # handle digital_tech with stricter check
    for area, kws in ISSUE_AREAS.items():
        if area == "digital_tech":
            continue
        if any(kw in t for kw in kws):
            hits.append(area)

    if has_digital_tech(text):
        hits.append("digital_tech")

    # stable order
    return sorted(set(hits))

def extract_scope_tags(text: str) -> List[str]:
    t = norm(text)
    hits = []
    for tag, kws in SCOPE_TAGS.items():
        if any(kw in t for kw in kws):
            hits.append(tag)
    return sorted(set(hits))


# ------------------------
# KPI snippets
# ------------------------
def split_lines_for_kpi(text: str) -> List[str]:
    # split by newline first, then fallback to sentence-ish splitting
    lines = [clean(x) for x in (text or "").split("\n")]
    lines = [x for x in lines if x]
    if lines:
        return lines

    # fallback
    parts = re.split(r"(?<=[.!?])\s+", clean(text))
    return [clean(p) for p in parts if clean(p)]

def extract_kpi_snippets(text: str, max_snippets: int = 8) -> List[str]:
    t = norm(text)
    if not t:
        return []

    out = []
    for line in split_lines_for_kpi(text):
        l = norm(line)
        if any(m in l for m in KPI_MARKERS):
            out.append(clean(line))
        # also capture obvious numeric targets (very light)
        elif re.search(r"\b\d{1,3}(?:,\d{3})*\b", line) and any(w in l for w in ["participants", "beneficiaries", "sessions", "hours", "weeks", "months"]):
            out.append(clean(line))

        if len(out) >= max_snippets:
            break

    return out


# ------------------------
# Phrase tags (simple, no extra deps)
# ------------------------
STOPWORDS = set("""
a an the and or but if then else when while where what how who whom which
to of in on at for from by with without into over under about as is are was were be been being
this that these those it its they them their you your we our i me my
may might can could should shall will would
""".split())

TOKEN_RE = re.compile(r"[A-Za-z][A-Za-z0-9']+")

def tokenize(text: str) -> List[str]:
    return [w.lower() for w in TOKEN_RE.findall(text or "")]

def make_phrase_tags(text: str, top_n: int = 25) -> List[str]:
    toks = [t for t in tokenize(text) if t not in STOPWORDS and len(t) >= 3]
    if not toks:
        return []

    bigrams = [" ".join([toks[i], toks[i+1]]) for i in range(len(toks)-1)]
    # light filter: remove bigrams with stopwords (already removed) and repeated junk
    counts = Counter(bigrams)
    # drop extremely generic terms
    for bad in ["grant application", "application form", "more information"]:
        counts.pop(bad, None)

    return [p for p, _ in counts.most_common(top_n)]


# ------------------------
# Others sections (unknown headings)
# ------------------------
KNOWN_HEADINGS = set([
    "about this grant",
    "who can apply?",
    "when to apply?",
    "when can i apply?",
    "how much funding can you receive?",
    "how to apply?",
])

def extract_others_from_sections(sections: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    others: List[Dict[str, Any]] = []
    for s in sections or []:
        h = clean(s.get("heading"))
        if not h:
            continue
        if norm(h) in KNOWN_HEADINGS:
            continue
        content = s.get("content") or []
        if isinstance(content, str):
            content_list = [clean(content)] if clean(content) else []
        else:
            content_list = [clean(x) for x in content if clean(x)]
        if not content_list:
            continue
        others.append({"heading": h, "content": content_list})
    return others


# ------------------------
# Build grant_profile + features
# ------------------------
def build_profile(record: Dict[str, Any]) -> Tuple[Dict[str, Any], Dict[str, Any], List[Dict[str, Any]]]:
    # Evidence text (prefer the structured fields)
    about = clean(record.get("about"))
    who = clean(record.get("who_can_apply"))
    when = clean(record.get("when_to_apply"))
    funding_txt = clean(record.get("funding"))
    how = clean(record.get("how_to_apply"))

    # If "funding" field is missing, try to derive from the section with that heading
    # (but we keep this gentle; your scraper already sets it in most cases).
    if not funding_txt:
        for s in record.get("sections", []) or []:
            if norm(s.get("heading")) == "how much funding can you receive?":
                funding_txt = join_nonempty(s.get("content") or [], "\n")
                break

    # Full text for tagging (keep it concise-ish)
    combined_text = "\n".join([x for x in [about, who, when, funding_txt, how] if x])

    issue_areas = extract_issue_areas(combined_text)
    scope_tags = extract_scope_tags(combined_text)
    kpi_snippets = extract_kpi_snippets(combined_text)

    funding_obj = extract_funding(funding_txt)
    application_window = extract_application_window(when)

    others = extract_others_from_sections(record.get("sections") or [])

    grant_profile = {
        "issue_areas": issue_areas,
        "scope_tags": scope_tags,
        "kpi_snippets": kpi_snippets,
        "funding": funding_obj,
        "application_window": application_window,
        "evidence": {
            "about": about or None,
            "who_can_apply": who or None,
            "when_to_apply": when or None,
            "funding": funding_txt or None,
            "how_to_apply": how or None,
        },
        "others": others,  # duplicates top-level "others" for convenience
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "version": 2,
    }

    tags = sorted(set(issue_areas + scope_tags))
    phrase_tags = make_phrase_tags(combined_text, top_n=25)

    features = {
        "tags": tags,
        "phrase_tags": phrase_tags,
        "generated_at": grant_profile["generated_at"],
        "method": "rule_based",
    }

    return grant_profile, features, others


# ------------------------
# IO
# ------------------------
def iter_jsonl(path: str):
    with open(path, "r", encoding="utf-8") as f:
        for line_no, line in enumerate(f, start=1):
            line = line.strip()
            if not line:
                continue
            try:
                yield json.loads(line)
            except Exception as e:
                raise RuntimeError(f"Bad JSON on line {line_no}: {e}")

def write_jsonl(path: str, rows: List[Dict[str, Any]]):
    with open(path, "w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("input_jsonl", help="Your scraped grants JSONL (raw scraper output)")
    ap.add_argument("output_jsonl", help="Output JSONL with grant_profile + features")
    ap.add_argument("--limit", type=int, default=None, help="Only process first N lines")
    args = ap.parse_args()

    out_rows: List[Dict[str, Any]] = []

    for i, rec in enumerate(iter_jsonl(args.input_jsonl), start=1):
        if args.limit is not None and i > args.limit:
            break

        grant_profile, features, others = build_profile(rec)

        # attach/overwrite
        rec["grant_profile"] = grant_profile
        rec["features"] = features
        rec["others"] = others

        out_rows.append(rec)

    write_jsonl(args.output_jsonl, out_rows)


if __name__ == "__main__":
    main()
