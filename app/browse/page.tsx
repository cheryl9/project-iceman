"use client";

import { useState, useEffect } from "react";
import Filters, { FilterState } from "../components/Filters";
import BottomNav from "../components/BottomNav";
import GrantListCard from "../components/GrantListCard";
import { applyFilters } from "../lib/filterUtils";
import { fetchGrants, type FirebaseGrant } from "../lib/api";
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
    fundingRaw: funding.raw || fbGrant.funding || '',
    deadline: applicationWindow.end_date || applicationWindow.dates?.[0] || '2026-12-31',
    eligibility: profile.eligibility?.requirements || [],
    kpis: [],
    applicationUrl: fbGrant.source_url || '',
  };
}

export default function BrowsePage() {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<FilterState>({
    issueArea: [],
    scopeOfGrant: [],
    fundingMin: 0,
    fundingMax: 1000000,
    deadlineAfter: null,
    deadlineBefore: null,
    eligibilityTypes: [],
  });

  // Fetch grants from backend
  useEffect(() => {
    async function loadGrants() {
      try {
        setLoading(true);
        const firebaseGrants = await fetchGrants();
        const converted = firebaseGrants.map(convertFirebaseToGrant);
        setGrants(converted);
        setError(null);
      } catch (err) {
        console.error('Failed to load grants:', err);
        setError('Failed to load grants. Please ensure the backend is running.');
      } finally {
        setLoading(false);
      }
    }
    loadGrants();
  }, []);

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
            <p className="text-sm text-gray-500">Make sure the backend is running on http://localhost:8000</p>
          </div>
        ) : filteredGrants.length > 0 ? (
          filteredGrants.map((grant) => (
            <GrantListCard key={grant.id} grant={grant} />
          ))
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
