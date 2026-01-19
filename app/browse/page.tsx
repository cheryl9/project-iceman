"use client";

import { useState, useEffect } from "react";
import Filters, { FilterState } from "../components/Filters";
import BottomNav from "../components/BottomNav";
import GrantListCard from "../components/GrantListCard";
import { applyFilters } from "../lib/filterUtils";
import { fetchGrants, type FirebaseGrant, saveSwipe } from "../lib/api";
import { Grant } from "../lib/types";

function convertFirebaseToGrant(fbGrant: FirebaseGrant): Grant {
  const profile = (fbGrant.grant_profile || {}) as any;
  const funding = profile.funding || {};
  const applicationWindow = profile.application_window || {};

  return {
    id: fbGrant.firestore_id || fbGrant.id || fbGrant.source_url || "unknown",
    title: fbGrant.title,
    organization: fbGrant.agency,
    description: fbGrant.about || "",
    issueAreas: profile.issue_areas || [],
    // scope_tags is an array, but we only use the first one for filtering
    scope: profile.scope_tags?.[0] || "",
    fundingMin: funding.min_amount_sgd || 0,
    fundingMax: funding.cap_amount_sgd || 0,
    fundingRaw: funding.raw || fbGrant.funding || "",
    deadline: applicationWindow.end_date || applicationWindow.dates?.[0] || "2026-12-31",
    eligibility: profile.eligibility?.requirements || [],
    kpis: [],
    applicationUrl: fbGrant.source_url || "",
  };
}

export default function BrowsePage() {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());

  const [filters, setFilters] = useState<FilterState>({
    issueArea: [],
    scopeOfGrant: [],
    fundingMin: 0,
    fundingMax: 1000000,
    deadlineAfter: null,
    deadlineBefore: null,
    eligibilityTypes: [],
  });

  const getKey = (g: Grant) => g.applicationUrl || g.id;

  // Fetch grants
  useEffect(() => {
    async function loadGrants() {
      try {
        setLoading(true);
        
        const data = await fetchGrants();
        const converted = (data || []).map(convertFirebaseToGrant);
        setGrants(converted);
        setError(null);
      } catch (err) {
        console.error("Failed to load grants:", err);
        setError("Failed to load grants. Please try again.");
      } finally {
        setLoading(false);
      }
    }
    loadGrants();
  }, []);

  // Load saved keys from localStorage
  useEffect(() => {
    async function loadSavedKeys() {
      const uid = localStorage.getItem("user_id");
      if (!uid) return;
      
      try {
        // Load saved keys from localStorage
        const savedKeysRaw = localStorage.getItem("saved_grant_keys");
        if (savedKeysRaw) {
          const keys = new Set<string>(JSON.parse(savedKeysRaw));
          setSavedKeys(keys);
        }
      } catch (err) {
        console.error("Error loading saved keys:", err);
      }
    }
    
    loadSavedKeys();
  }, []);

  const persistSaved = (next: Set<string>) => {
    localStorage.setItem("saved_grant_keys", JSON.stringify(Array.from(next)));
  };

  const toggleSave = async (grant: Grant) => {
    const uid = localStorage.getItem("user_id");
    if (!uid) {
      alert("Please complete onboarding first.");
      return;
    }

    const key = getKey(grant);
    const alreadySaved = savedKeys.has(key);

    // optimistic update
    setSavedKeys((prev) => {
      const next = new Set(prev);
      if (alreadySaved) next.delete(key);
      else next.add(key);
      persistSaved(next);
      return next;
    });

    try {
      // If your backend treats "dislike" as remove from saved, this works.
      // If not supported, tell me and I’ll adjust to a proper "unsave" endpoint.
      const action = alreadySaved ? "dislike" : "like";
      await saveSwipe(uid, key, action, grant.matchScore || 0);
    } catch (e) {
      console.error("Save failed:", e);

      // rollback
      setSavedKeys((prev) => {
        const next = new Set(prev);
        if (alreadySaved) next.add(key);
        else next.delete(key);
        persistSaved(next);
        return next;
      });
    }
  };

  const filteredGrants = applyFilters(grants, filters);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="sticky top-0 bg-white z-10 border-b px-4 py-3 flex justify-between items-center">
        <h1 className="text-xl font-bold">All Grants</h1>
        <button
          onClick={() => setIsFilterOpen(true)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-full text-sm"
        >
          Filters
        </button>
      </div>

      {/* List */}
      <div className="flex-1 p-4 space-y-4">
        {loading ? (
          <p className="text-gray-500 text-center mt-12">Loading grants...</p>
        ) : error ? (
          <div className="text-center mt-12">
            <p className="text-red-500 mb-2">{error}</p>
          </div>
        ) : filteredGrants.length > 0 ? (
          filteredGrants.map((grant, idx) => {
            const key = getKey(grant);
            return (
              <GrantListCard
                key={`${key}__${idx}`}
                grant={grant}
                isSaved={savedKeys.has(key)}
                onToggleSave={() => toggleSave(grant)}
                showSaveButton={true}
              />
            );
          })
        ) : (
          <p className="text-gray-500 text-center mt-12">
            No grants match your filters
          </p>
        )}
      </div>

      <BottomNav />

      <Filters
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        currentFilters={filters}
        onApplyFilters={setFilters}
      />
    </div>
  );
}
