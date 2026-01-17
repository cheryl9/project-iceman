import json
from typing import Dict, List, Any, Set
from datetime import datetime
import re

class OurSGGrantMatcher:
    
    def __init__(self):
        self.weights = {
            "issue_area_match": 0.30,      
            "scope_alignment": 0.20,   
            "funding_fit": 0.20,            
            "eligibility_match": 0.15,      
            "timeline_urgency": 0.10,       
            "strategic_fit": 0.05          
        }
    
    def calculate_match_score(self, npo_profile: Dict[str, Any], grant: Dict[str, Any]) -> Dict[str, Any]:
        
        scores = {
            "issue_area_match": self._score_issue_areas(npo_profile, grant),
            "scope_alignment": self._score_scope_tags(npo_profile, grant),
            "funding_fit": self._score_funding(npo_profile, grant),
            "eligibility_match": self._score_eligibility(npo_profile, grant),
            "timeline_urgency": self._score_timeline(npo_profile, grant),
            "strategic_fit": self._score_strategic_alignment(npo_profile, grant)
        }
        
        total_score = sum(scores[key]["score"] * self.weights[key] for key in self.weights.keys())
        
        adjustments = self._apply_adjustments(npo_profile, grant, scores)
        final_score = max(0, min(100, total_score + adjustments["total"]))
        
        insights = self._generate_insights(npo_profile, grant, scores, adjustments)
        
        return {
            "grant_id": grant.get("source_url", "").split("/")[-2] if grant.get("source_url") else None,
            "grant_name": grant.get("title"),
            "agency": grant.get("agency"),
            "match_score": round(final_score, 1),
            "confidence": self._calculate_confidence(scores),
            "component_scores": {k: v["score"] for k, v in scores.items()},
            "detailed_scores": scores,
            "reasoning": insights["reasoning"],
            "strengths": insights["strengths"],
            "concerns": insights["concerns"],
            "action_items": insights["action_items"],
            "grant_url": grant.get("source_url")
        }
    
    def _score_issue_areas(self, npo: Dict, grant: Dict) -> Dict[str, Any]:
        """Score match on issue areas (most important factor)"""
        
        npo_areas = set(area.lower().strip() for area in npo.get("issue_areas", []))
        
        grant_profile = grant.get("grant_profile", {})
        grant_areas = set(area.lower().strip() for area in grant_profile.get("issue_areas", []))
        
        if not npo_areas or not grant_areas:
            return {"score": 0, "details": "Missing issue area information", "matched": []}
        
        # Calculate overlap
        matched = npo_areas & grant_areas
        
        if not matched:
            return {"score": 0, "details": "No matching issue areas", "matched": []}
        
        # Score based on coverage and overlap
        coverage = len(matched) / len(grant_areas)  # How many grant areas are covered
        overlap_rate = len(matched) / len(npo_areas) if npo_areas else 0  # Specificity
        
        # Better score if NPO covers all grant areas
        score = (coverage * 0.7 + overlap_rate * 0.3) * 100
        
        details = f"Matched {len(matched)}/{len(grant_areas)} grant areas"
        
        return {
            "score": round(score, 1),
            "details": details,
            "matched_areas": list(matched),
            "missing_areas": list(grant_areas - npo_areas)
        }
    
    def _score_scope_tags(self, npo: Dict, grant: Dict) -> Dict[str, Any]:
        """Score match on scope tags (project type)"""
        
        npo_scopes = set(scope.lower().strip() for scope in npo.get("project_types", []))
        
        grant_profile = grant.get("grant_profile", {})
        grant_scopes = set(scope.lower().strip() for scope in grant_profile.get("scope_tags", []))
        
        if not grant_scopes:
            return {"score": 100, "details": "No specific project type required", "matched": []}
        
        if not npo_scopes:
            return {"score": 50, "details": "NPO project types not specified", "matched": []}
        
        matched = npo_scopes & grant_scopes
        
        if not matched:
            return {"score": 30, "details": "No matching project types", "matched": []}
        
        # Score based on coverage
        coverage = len(matched) / len(grant_scopes)
        score = coverage * 100
        
        details = f"Matches {len(matched)}/{len(grant_scopes)} required project types"
        
        return {
            "score": round(score, 1),
            "details": details,
            "matched_scopes": list(matched),
            "available_scopes": list(grant_scopes)
        }
    
    def _score_funding(self, npo: Dict, grant: Dict) -> Dict[str, Any]:
        """Score funding compatibility"""
        
        npo_min = npo.get("funding_min", 0)
        npo_max = npo.get("funding_max", float('inf'))
        
        grant_profile = grant.get("grant_profile", {})
        funding_info = grant_profile.get("funding", {})
        
        # Check if grant has funding info
        cap_amount = funding_info.get("cap_amount_sgd")
        percent_max = funding_info.get("percent_max")
        
        # If no specific funding info, assume reasonable compatibility
        if not cap_amount and not percent_max:
            return {"score": 70, "details": "Funding amount not specified in grant"}
        
        # If there's a cap, check if it can meet NPO needs
        if cap_amount:
            if cap_amount < npo_min:
                return {
                    "score": 20,
                    "details": f"Grant cap (${cap_amount:,.0f}) below your minimum (${npo_min:,.0f})"
                }
            elif cap_amount >= npo_max:
                return {
                    "score": 100,
                    "details": f"Grant cap (${cap_amount:,.0f}) can fully cover your needs"
                }
            else:
                # Partial coverage
                coverage = (cap_amount - npo_min) / (npo_max - npo_min) if npo_max > npo_min else 1.0
                score = 50 + (coverage * 50)  # 50-100 range
                return {
                    "score": round(score, 1),
                    "details": f"Grant cap (${cap_amount:,.0f}) provides partial coverage"
                }
        
        # If only percentage is known
        if percent_max:
            details = f"Grant covers up to {percent_max}% of costs"
            # Higher percentage = better score
            score = (percent_max / 100) * 100
            return {"score": round(score, 1), "details": details}
        
        return {"score": 60, "details": "Funding details unclear"}
    
    def _score_eligibility(self, npo: Dict, grant: Dict) -> Dict[str, Any]:
        """Score based on eligibility requirements"""
        
        who_can_apply = grant.get("who_can_apply", "").lower()
        
        if not who_can_apply:
            return {"score": 70, "details": "Eligibility criteria not specified"}
        
        # Check NPO characteristics against eligibility text
        npo_type = npo.get("organization_type", "").lower()
        npo_registration = npo.get("registration_status", "").lower()
        
        score = 50  # Base score
        issues = []
        matches = []
        
        # Common eligibility patterns
        eligibility_checks = {
            "registered charity": ("charity" in npo_registration or "ipc" in npo_registration),
            "non-profit": ("non-profit" in npo_type or "charity" in npo_registration),
            "social service": ("social service" in npo_type or "ssa" in npo_type),
            "registered": (npo_registration != ""),
            "singapore": True,  # Assume all NPOs are Singapore-based
        }
        
        for criterion, npo_meets in eligibility_checks.items():
            if criterion in who_can_apply:
                if npo_meets:
                    score += 10
                    matches.append(f"Meets '{criterion}' requirement")
                else:
                    score -= 15
                    issues.append(f"May not meet '{criterion}' requirement")
        
        # Cap at 100
        score = min(100, score)
        
        details = f"Assessed {len(matches)} eligibility criteria"
        if issues:
            details = f"Potential issue: {issues[0]}"
        
        return {
            "score": round(score, 1),
            "details": details,
            "matches": matches,
            "concerns": issues
        }
    
    def _score_timeline(self, npo: Dict, grant: Dict) -> Dict[str, Any]:
        """Score based on application timeline"""
        
        grant_profile = grant.get("grant_profile", {})
        app_window = grant_profile.get("application_window", {})
        
        is_open_all_year = app_window.get("is_open_all_year")
        
        # If open all year, perfect score
        if is_open_all_year:
            return {"score": 100, "details": "Application open year-round"}
        
        # Check specific dates
        start_date = app_window.get("start_date")
        end_date = app_window.get("end_date")
        
        npo_urgency = npo.get("funding_urgency", "medium").lower()
        
        if not start_date and not end_date:
            return {"score": 60, "details": "Application timeline not clearly specified"}
        
        # If dates exist, check if currently open
        today = datetime.now()
        
        try:
            if start_date:
                start = datetime.strptime(start_date, "%Y-%m-%d")
                if today < start:
                    days_until = (start - today).days
                    if npo_urgency == "urgent" and days_until > 30:
                        return {"score": 40, "details": f"Opens in {days_until} days (may be too late for urgent need)"}
                    else:
                        return {"score": 70, "details": f"Opens in {days_until} days"}
            
            if end_date:
                end = datetime.strptime(end_date, "%Y-%m-%d")
                if today > end:
                    return {"score": 0, "details": "Application window closed"}
                else:
                    days_left = (end - today).days
                    if days_left < 7:
                        return {"score": 30, "details": f"Only {days_left} days left to apply"}
                    elif days_left < 30:
                        return {"score": 80, "details": f"{days_left} days left to apply"}
                    else:
                        return {"score": 100, "details": f"{days_left} days left to apply"}
        except:
            pass
        
        return {"score": 60, "details": "Application timeline unclear"}
    
    def _score_strategic_alignment(self, npo: Dict, grant: Dict) -> Dict[str, Any]:
        """Score based on mission/strategic fit using keyword matching"""
        
        npo_mission = npo.get("mission", "").lower()
        npo_description = npo.get("description", "").lower()
        
        grant_about = grant.get("about", "").lower()
        grant_title = grant.get("title", "").lower()
        
        if not npo_mission and not npo_description:
            return {"score": 50, "details": "NPO mission not provided"}
        
        if not grant_about:
            return {"score": 50, "details": "Grant description not available"}
        
        # Simple keyword overlap
        npo_text = f"{npo_mission} {npo_description}"
        grant_text = f"{grant_about} {grant_title}"
        
        # Extract meaningful words (remove common words)
        stop_words = {"the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by"}
        
        npo_words = set(word for word in re.findall(r'\w+', npo_text) if len(word) > 3 and word not in stop_words)
        grant_words = set(word for word in re.findall(r'\w+', grant_text) if len(word) > 3 and word not in stop_words)
        
        if not npo_words or not grant_words:
            return {"score": 50, "details": "Insufficient text for analysis"}
        
        overlap = npo_words & grant_words
        overlap_rate = len(overlap) / min(len(npo_words), len(grant_words))
        
        score = min(100, overlap_rate * 200)  # Scale up
        
        key_matches = list(overlap)[:5]  # Top 5 matching keywords
        
        details = f"Found {len(overlap)} keyword matches"
        
        return {
            "score": round(score, 1),
            "details": details,
            "key_matches": key_matches
        }
    
    def _apply_adjustments(self, npo: Dict, grant: Dict, scores: Dict) -> Dict[str, Any]:
        """Apply contextual adjustments"""
        
        adjustment = 0
        reasons = []
        
        # Bonus for multiple strong matches
        strong_matches = sum(1 for s in scores.values() if s["score"] >= 80)
        if strong_matches >= 3:
            adjustment += 5
            reasons.append("Multiple strong compatibility indicators")
        
        # Penalty if completely missing issue areas
        if scores["issue_area_match"]["score"] == 0:
            adjustment -= 15
            reasons.append("No issue area overlap - may not be suitable")
        
        # Bonus for perfect issue area match
        if scores["issue_area_match"]["score"] == 100:
            adjustment += 5
            reasons.append("Perfect issue area alignment")
        
        # Penalty for closed application window
        if scores["timeline_urgency"]["score"] == 0:
            adjustment -= 20
            reasons.append("Application window closed")
        
        return {
            "total": adjustment,
            "reasons": reasons
        }
    
    def _calculate_confidence(self, scores: Dict) -> str:
        """Calculate confidence level"""
        
        score_values = [s["score"] for s in scores.values()]
        avg_score = sum(score_values) / len(score_values)
        
        # Check for missing/unclear data
        unclear_count = sum(1 for s in scores.values() if "not specified" in s.get("details", "").lower() or "unclear" in s.get("details", "").lower())
        
        if unclear_count >= 3:
            return "low"
        elif unclear_count >= 1:
            return "medium"
        elif avg_score >= 70:
            return "high"
        else:
            return "medium"
    
    def _generate_insights(self, npo: Dict, grant: Dict, scores: Dict, adjustments: Dict) -> Dict[str, Any]:
        """Generate human-readable insights"""
        
        # Find top strengths
        top_scores = sorted(scores.items(), key=lambda x: x[1]["score"], reverse=True)
        strengths = [scores[key]["details"] for key, _ in top_scores[:3] if scores[key]["score"] >= 70]
        
        # Find concerns
        concerns = [scores[key]["details"] for key, val in scores.items() if val["score"] < 50]
        if not concerns:
            concerns = ["No major concerns identified"]
        
        # Generate action items
        action_items = []
        
        # Check what's missing
        if scores["issue_area_match"]["score"] < 70 and "missing_areas" in scores["issue_area_match"]:
            missing = scores["issue_area_match"]["missing_areas"]
            if missing:
                action_items.append(f"Consider how your work relates to: {', '.join(missing[:2])}")
        
        if scores["eligibility_match"]["score"] < 70 and "concerns" in scores["eligibility_match"]:
            concerns_list = scores["eligibility_match"]["concerns"]
            if concerns_list:
                action_items.append(f"Verify eligibility: {concerns_list[0]}")
        
        if scores["timeline_urgency"]["score"] < 60:
            action_items.append("Check application timeline and prepare documents early")
        
        if not action_items:
            action_items = ["Review full grant guidelines on OurSG portal", "Prepare required documents", "Contact grant agency if you have questions"]
        
        # Overall reasoning
        if top_scores[0][1]["score"] >= 80:
            reasoning = f"Strong match due to {top_scores[0][0].replace('_', ' ')}. {top_scores[0][1]['details']}"
        else:
            reasoning = f"Moderate match. {top_scores[0][1]['details']}"
        
        return {
            "reasoning": reasoning,
            "strengths": strengths[:3],
            "concerns": concerns[:3],
            "action_items": action_items[:3]
        }
    
    def batch_match_grants(self, npo_profile: Dict[str, Any], grants: List[Dict[str, Any]], top_n: int = 20) -> List[Dict[str, Any]]:
        """Match NPO against multiple grants"""
        
        matches = []
        for grant in grants:
            try:
                match_result = self.calculate_match_score(npo_profile, grant)
                # Include the full grant data in the match result
                match_result['grant_data'] = grant
                matches.append(match_result)
            except Exception as e:
                print(f"Error matching grant {grant.get('title', 'Unknown')}: {e}")
                continue
        
        # Sort by match score
        matches.sort(key=lambda x: x["match_score"], reverse=True)
        
        return matches[:top_n]


if __name__ == "__main__":
    matcher = OurSGGrantMatcher()
   