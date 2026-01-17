import { FilterState } from "../components/Filters";
import { Grant } from "./types";

export function applyFilters(grants: Grant[], filters: FilterState) {
  return grants.filter((grant) => {
    if (
      filters.issueArea.length &&
      !filters.issueArea.some((a) => grant.issueAreas.includes(a))
    ) return false;

    if (
      filters.scopeOfGrant.length &&
      !filters.scopeOfGrant.includes(grant.scope)
    ) return false;

    if (grant.fundingMax < filters.fundingMin) return false;
    if (grant.fundingMin > filters.fundingMax) return false;

    if (
      filters.deadlineAfter &&
      new Date(grant.deadline) < new Date(filters.deadlineAfter)
    ) return false;

    if (
      filters.deadlineBefore &&
      new Date(grant.deadline) > new Date(filters.deadlineBefore)
    ) return false;

    if (
      filters.eligibilityTypes.length &&
      !filters.eligibilityTypes.some((e) =>
        grant.eligibility.includes(e)
      )
    ) return false;

    return true;
  });
}
