"use client";

import { useState, useEffect } from "react";
import GrantCard from "../components/GrantCard";
import BottomNav from "../components/BottomNav";
import { fetchGrants, type FirebaseGrant, calculateMatches, type NPOProfile } from "../lib/api";
import { Grant } from "../lib/types";

function convertFirebaseToGrant(fbGrant: FirebaseGrant): Grant {
  const profile = fbGrant.grant_profile || {} as any;
  const funding = profile.funding || {};
  const applicationWindow = profile.application_window || {};
  
  return {
    id: fbGrant.firestore_id || fbGrant.id || fbGrant.source_url?.split('/')[4] || 'unknown',
    title: fbGrant.title,
    organization: fbGrant.agency,
    description: fbGrant.about || '',
    issueAreas: profile.issue_areas || [],
    scope: profile.scope_tags?.[0] || '',
    fundingMin: funding.min_amount_sgd || 0,
    fundingMax: funding.cap_amount_sgd || 0,
    deadline: applicationWindow.end_date || applicationWindow.dates?.[0] || '2026-12-31',
    eligibility: profile.eligibility?.requirements || [],
    kpis: [],
    applicationUrl: fbGrant.source_url || '',
  };
}

export default function MatchPage() {
  const [grants, setGrants] = useState<Grant[]>([]);
  const [saved, setSaved] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Load AI-matched grants based on user profile
  useEffect(() => {
    async function loadMatchedGrants() {
      try {
        setLoading(true);
        
        // Get user_id from localStorage (set during onboarding)
        const storedUserId = localStorage.getItem('user_id');
        
        if (!storedUserId) {
          setError('No profile found. Please complete onboarding first.');
          setLoading(false);
          return;
        }
        
        setUserId(storedUserId);
        
        // Get AI-matched recommendations from backend
        const response = await fetch(`http://localhost:8000/api/match/recommendations/${storedUserId}?limit=50`);
        
        if (!response.ok) {
          throw new Error('Failed to get recommendations');
        }
        
        const data = await response.json();
        console.log('AI Matched Grants:', data);
        
        // Convert recommendations to Grant format with match scores
        const matchedGrants = data.recommendations.map((match: any) => {
          // Find the full grant data
          const grantData = match.grant_data || match;
          const profile = grantData.grant_profile || {};
          const funding = profile.funding || {};
          const applicationWindow = profile.application_window || {};
          
          return {
            id: grantData.firestore_id || grantData.id || match.grant_id || 'unknown',
            title: match.grant_name || grantData.title,
            organization: match.agency || grantData.agency,
            description: grantData.about || '',
            issueAreas: profile.issue_areas || [],
            scope: profile.scope_tags?.[0] || '',
            fundingMin: funding.min_amount_sgd || 0,
            fundingMax: funding.cap_amount_sgd || 0,
            fundingRaw: funding.raw || grantData.funding || '',
            deadline: applicationWindow.end_date || applicationWindow.dates?.[0] || '2026-12-31',
            eligibility: profile.eligibility?.requirements || [],
            kpis: [],
            applicationUrl: match.grant_url || grantData.source_url || '',
            matchScore: match.match_score,
            confidence: match.confidence,
            reasoning: match.reasoning,
            strengths: match.strengths,
            concerns: match.concerns,
          };
        });
        
        setGrants(matchedGrants);
        setError(null);
      } catch (err) {
        console.error('Failed to load matched grants:', err);
        setError('Failed to load grants. Please ensure the backend is running.');
      } finally {
        setLoading(false);
      }
    }
    loadMatchedGrants();
  }, []);

  const handleSwipe = (direction: "left" | "right") => {
    const current = grants[0];
    if (!current) return;

    if (direction === "right") {
      setSaved((prev) => [...prev, current]);
    }

    setGrants((prev) => prev.slice(1));
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4">
        {loading ? (
          <p className="text-gray-500">Loading grants...</p>
        ) : error ? (
          <div className="text-center">
            <p className="text-red-500 mb-2">{error}</p>
            <p className="text-sm text-gray-500">Make sure the backend is running on http://localhost:8000</p>
          </div>
        ) : grants.length > 0 ? (
          <GrantCard grant={grants[0]} onSwipe={handleSwipe} />
        ) : (
          <p className="text-gray-500">No more grants 🎉</p>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
