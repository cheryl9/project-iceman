"use client";

import { useState, useEffect } from "react";
import BottomNav from "../components/BottomNav";
import GrantListCard from "../components/GrantListCard";
import { getSavedGrants, type FirebaseGrant } from "../lib/api";
import { Grant } from "../lib/types";

function convertFirebaseToGrant(fbGrant: FirebaseGrant): Grant {
  const profile = fbGrant.grant_profile || {} as any;
  const funding = profile.funding || {};
  const applicationWindow = profile.application_window || {};
  
  return {
    id: fbGrant.firestore_id || fbGrant.id || fbGrant.source_url || "unknown",

    title: fbGrant.title,
    organization: fbGrant.agency,
    description: fbGrant.about || '',
    issueAreas: profile.issue_areas || [],
    scope: profile.scope_tags?.[0] || '',
    eligibility: profile.eligibility?.requirements || [],
    deadline: applicationWindow.end_date || applicationWindow.raw || 'No deadline specified',
    fundingMin: funding.min_amount_sgd || 0,
    fundingMax: funding.cap_amount_sgd || 0,
    fundingRaw: funding.raw,
    kpis: [],
    applicationUrl: fbGrant.source_url || '',
    // @ts-ignore - match_score added by backend
    matchScore: fbGrant.match_score || 0,
  };
}

export default function SavedPage() {
  const [grants, setGrants] = useState<Grant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadSavedGrants() {
      try {
        const userId = localStorage.getItem("user_id");
        
        if (!userId) {
          setError("Please complete onboarding first");
          setLoading(false);
          return;
        }

        // Fetch saved grants directly from Firestore
        const savedFromFirestore = await getSavedGrants(userId);
        const savedGrants = savedFromFirestore.map(convertFirebaseToGrant);
        setGrants(savedGrants);
      } catch (err) {
        console.error("Error loading saved grants:", err);
        setError("Failed to load saved grants. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    loadSavedGrants();
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-6">Saved Grants</h1>
        
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Loading saved grants...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-500 mb-2">{error}</p>
          </div>
        ) : grants.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No saved grants yet</p>
            <p className="text-sm text-gray-400 mt-2">Swipe right on grants you like in the Match tab!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {grants.map((grant, idx) => (
  <GrantListCard
    key={`${grant.applicationUrl || "no_url"}__${grant.id}__${idx}`}
    grant={grant}
    showSaveButton={false}
  />
))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}

