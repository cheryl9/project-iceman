from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import firebase_admin
from firebase_admin import credentials, firestore
from grant_matcher import OurSGGrantMatcher
from firebase_init import db
from query_grants import get_all_grants
import os

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

matcher = OurSGGrantMatcher()


# Pydantic models
class NPOProfile(BaseModel):
    organization_name: str
    organization_type: str
    registration_status: Optional[str] = ""
    issue_areas: List[str]
    project_types: List[str]
    funding_min: int
    funding_max: int
    funding_urgency: str = "medium"
    years_operating: int
    staff_size: int
    mission: str
    description: Optional[str] = ""


class MatchRequest(BaseModel):
    npo_profile: NPOProfile
    limit: Optional[int] = 20

# API Endpoints

@app.get("/api/grants")
def fetch_grants():
    return get_all_grants()


@app.post("/api/npo/profile")
async def save_npo_profile(profile: NPOProfile):
    """Save NPO profile to Firebase"""
    try:
        profile_dict = profile.dict()
        
        doc_ref = db.collection('npo_profiles').document()
        profile_dict['created_at'] = firestore.SERVER_TIMESTAMP
        profile_dict['user_id'] = doc_ref.id
        
        doc_ref.set(profile_dict)
        
        return {
            "status": "success",
            "user_id": doc_ref.id,
            "message": "Profile saved successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/npo/profile/{user_id}")
async def get_npo_profile(user_id: str):
    """Get NPO profile from Firebase"""
    try:
        doc = db.collection('npo_profiles').document(user_id).get()
        
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Profile not found")
        
        return doc.to_dict()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/match/calculate")
async def calculate_matches(request: MatchRequest):
    """
    Calculate match scores for NPO against all grants in Firebase
    Returns ranked list of grants with match scores
    """
    try:
        grants = []
        grants_ref = db.collection('grants')
        
        for doc in grants_ref.stream():
            grant_data = doc.to_dict()
            grant_data['firestore_id'] = doc.id
            grants.append(grant_data)
        
        if not grants:
            raise HTTPException(status_code=404, detail="No grants found in database")
        
        # Convert Pydantic model to dict
        npo_profile_dict = request.npo_profile.dict()
        
        # Calculate matches
        matches = matcher.batch_match_grants(
            npo_profile_dict, 
            grants, 
            top_n=request.limit
        )
        
        return {
            "status": "success",
            "total_grants_analyzed": len(grants),
            "matches": matches
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/match/recommendations/{user_id}")
async def get_recommendations(user_id: str, limit: int = 20):
    """
    Get personalized grant recommendations for a saved user profile
    Excludes grants the user has already swiped on
    """
    try:
        # Get user profile
        profile_doc = db.collection('npo_profiles').document(user_id).get()
        
        if not profile_doc.exists:
            raise HTTPException(status_code=404, detail="Profile not found")
        
        npo_profile = profile_doc.to_dict()
        
        # Get grants user has already swiped on
        swipes_ref = db.collection('swipes').where('user_id', '==', user_id)
        swiped_grants = set()
        
        for swipe in swipes_ref.stream():
            swiped_grants.add(swipe.to_dict().get('grant_id'))
        
        # Get all grants
        all_grants = []
        for doc in db.collection('grants').stream():
            grant_id = doc.to_dict().get('source_url', doc.id)
            
            # Skip if already swiped
            if grant_id not in swiped_grants:
                grant_data = doc.to_dict()
                grant_data['firestore_id'] = doc.id
                all_grants.append(grant_data)
        
        # Calculate matches
        matches = matcher.batch_match_grants(npo_profile, all_grants, top_n=limit)
        
        return {
            "status": "success",
            "user_id": user_id,
            "recommendations": matches,
            "total_available": len(all_grants)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/swipe")
async def save_swipe(
    user_id: str,
    grant_id: str,
    action: str,  # "like" or "dislike"
    match_score: float
):
    """Save user's swipe action"""
    try:
        swipe_data = {
            "user_id": user_id,
            "grant_id": grant_id,
            "action": action,
            "match_score": match_score,
            "timestamp": firestore.SERVER_TIMESTAMP
        }
        
        db.collection('swipes').add(swipe_data)
        
        # Update user's liked/disliked lists
        field = "liked_grants" if action == "like" else "disliked_grants"
        db.collection('npo_profiles').document(user_id).update({
            field: firestore.ArrayUnion([grant_id])
        })
        
        return {
            "status": "success",
            "message": f"Swipe {action} saved"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/grants/summary")
async def get_grants_summary():
    """Get summary statistics of grants in database"""
    try:
        grants_ref = db.collection('grants')
        grants = list(grants_ref.stream())
        
        # Count by agency
        agencies = {}
        issue_areas = {}
        
        for doc in grants:
            data = doc.to_dict()
            
            # Count agencies
            agency = data.get('agency', 'Unknown')
            agencies[agency] = agencies.get(agency, 0) + 1
            
            # Count issue areas
            grant_profile = data.get('grant_profile', {})
            for area in grant_profile.get('issue_areas', []):
                issue_areas[area] = issue_areas.get(area, 0) + 1
        
        return {
            "total_grants": len(grants),
            "agencies": agencies,
            "issue_areas": issue_areas
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Health check
@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "OurSG Grant Matching API"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)