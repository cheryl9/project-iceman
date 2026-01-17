from firebase_init import db
from typing import List, Dict, Any, Optional


def get_all_grants():
    grants_ref = db.collection("grants")
    docs = grants_ref.stream()
    return [{**doc.to_dict(), "id": doc.id} for doc in docs]


def search_grants_by_agency(agency: str, limit: int = 50) -> List[Dict[str, Any]]:
    """Search grants by agency name."""
    docs = (
        db.collection("grants")
        .where("agency", "==", agency)
        .limit(limit)
        .stream()
    )
    
    grants = []
    for doc in docs:
        grant = doc.to_dict()
        grant['id'] = doc.id
        grants.append(grant)
    
    return grants


def search_grants_by_issue_area(
    issue_area: str,
    limit: int = 50
) -> List[Dict[str, Any]]:
    """
    Search grants by issue area.
    Uses array-contains query on grant_profile.issue_areas.
    """
    docs = (
        db.collection("grants")
        .where("grant_profile.issue_areas", "array_contains", issue_area)
        .limit(limit)
        .stream()
    )
    
    grants = []
    for doc in docs:
        grant = doc.to_dict()
        grant['id'] = doc.id
        grants.append(grant)
    
    return grants


def search_grants_by_scope(
    scope_tag: str,
    limit: int = 50
) -> List[Dict[str, Any]]:
    """
    Search grants by scope tag.
    Uses array-contains query on grant_profile.scope_tags.
    """
    docs = (
        db.collection("grants")
        .where("grant_profile.scope_tags", "array_contains", scope_tag)
        .limit(limit)
        .stream()
    )
    
    grants = []
    for doc in docs:
        grant = doc.to_dict()
        grant['id'] = doc.id
        grants.append(grant)
    
    return grants


def search_grants_by_funding_range(
    min_amount: float = None,
    max_amount: float = None,
    limit: int = 50
) -> List[Dict[str, Any]]:
    """
    Search grants within a funding range.
    Note: Firestore has limitations on range queries with other filters.
    """
    query = db.collection("grants")
    
    if min_amount is not None:
        query = query.where(
            "grant_profile.funding.cap_amount_sgd",
            ">=",
            min_amount
        )
    
    if max_amount is not None:
        query = query.where(
            "grant_profile.funding.cap_amount_sgd",
            "<=",
            max_amount
        )
    
    docs = query.limit(limit).stream()
    
    grants = []
    for doc in docs:
        grant = doc.to_dict()
        grant['id'] = doc.id
        grants.append(grant)
    
    return grants


def get_facets() -> Dict[str, Any]:
    """Fetch facets metadata for filtering UI."""
    doc = db.collection("metadata").document("facets").get()
    
    if doc.exists:
        return doc.to_dict().get("facets", {})
    return {}


def filter_grants(
    issue_areas: List[str] = None,
    scope_tags: List[str] = None,
    agencies: List[str] = None,
    min_funding: float = None,
    max_funding: float = None,
    limit: int = 100
) -> List[Dict[str, Any]]:
    """
    Advanced filtering with multiple criteria.
    Note: Due to Firestore limitations, this does client-side filtering
    for complex queries. For production, consider using array-contains-any
    or separating queries.
    """
    all_grants = get_all_grants(limit=1000)  # Fetch more for filtering
    
    filtered = all_grants
    
    # Filter by issue areas
    if issue_areas:
        filtered = [
            g for g in filtered
            if any(
                area in g.get("grant_profile", {}).get("issue_areas", [])
                for area in issue_areas
            )
        ]
    
    # Filter by scope tags
    if scope_tags:
        filtered = [
            g for g in filtered
            if any(
                tag in g.get("grant_profile", {}).get("scope_tags", [])
                for tag in scope_tags
            )
        ]
    
    # Filter by agencies
    if agencies:
        filtered = [
            g for g in filtered
            if g.get("agency") in agencies
        ]
    
    # Filter by funding range
    if min_funding is not None or max_funding is not None:
        filtered = [
            g for g in filtered
            if _funding_in_range(g, min_funding, max_funding)
        ]
    
    return filtered[:limit]


def _funding_in_range(
    grant: Dict[str, Any],
    min_amount: float = None,
    max_amount: float = None
) -> bool:
    """Helper to check if grant funding is in range."""
    cap = grant.get("grant_profile", {}).get("funding", {}).get("cap_amount_sgd")
    
    if cap is None:
        return False
    
    if min_amount is not None and cap < min_amount:
        return False
    
    if max_amount is not None and cap > max_amount:
        return False
    
    return True


if __name__ == "__main__":
    import json
    
    # Get ALL grants (no filters, no bias)
    all_grants = get_all_grants(limit=1000)
    
    print(f"\n{'='*60}")
    print(f"TOTAL GRANTS IN FIREBASE: {len(all_grants)}")
    print(f"{'='*60}\n")
    
    for i, grant in enumerate(all_grants, 1):
        agency = grant.get('agency', 'N/A')
        title = grant.get('title', 'N/A')
        print(f"{i:2d}. [{agency}] {title}")
    
    print(f"\n{'='*60}")