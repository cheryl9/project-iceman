"use client";

import { useState, useMemo } from 'react';
import GrantCard from './components/GrantCard';
import Filters, { FilterState } from './components/Filters';
import { mockGrants } from './lib/mockGrants';

export default function Home() {
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [likedGrants, setLikedGrants] = useState<string[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    issueArea: [],
    scopeOfGrant: [],
    fundingMin: 0,
    fundingMax: 1000000,
    deadlineAfter: null,
    deadlineBefore: null,
    eligibilityTypes: []
  });

  // Filter grants based on user preferences
  const filteredGrants = useMemo(() => {
    return mockGrants.filter(grant => {
      // Filter by issue areas
      if (filters.issueArea.length > 0) {
        const hasMatchingArea = grant.issueAreas.some(area => 
          filters.issueArea.includes(area)
        );
        if (!hasMatchingArea) return false;
      }

      // Filter by scope of grant
      if (filters.scopeOfGrant.length > 0) {
        // Placeholder: will match once you add scope field to grants
      }

      // Filter by funding quantum
      if (grant.fundingMax < filters.fundingMin || grant.fundingMin > filters.fundingMax) {
        return false;
      }

      // Filter by application due date (calendar dates)
      const grantDeadline = new Date(grant.deadline);
      
      if (filters.deadlineAfter) {
        const afterDate = new Date(filters.deadlineAfter);
        if (grantDeadline < afterDate) return false;
      }
      
      if (filters.deadlineBefore) {
        const beforeDate = new Date(filters.deadlineBefore);
        if (grantDeadline > beforeDate) return false;
      }

      // Filter by eligibility
      if (filters.eligibilityTypes.length > 0) {
        const hasMatchingEligibility = grant.eligibility.some(criterion =>
          filters.eligibilityTypes.some(type => 
            criterion.toLowerCase().includes(type.toLowerCase()) ||
            type.toLowerCase().includes(criterion.toLowerCase())
          )
        );
        if (!hasMatchingEligibility) return false;
      }

      return true;
    });
  }, [filters]);

  const handleSwipe = (direction: 'left' | 'right') => {
    if (direction === 'right') {
      setLikedGrants([...likedGrants, filteredGrants[currentIndex].id]);
    }
    
    setTimeout(() => {
      setCurrentIndex(currentIndex + 1);
    }, 300);
  };

  const handleApplyFilters = (newFilters: FilterState) => {
    setFilters(newFilters);
    setCurrentIndex(0); // Reset to first grant when filters change
  };

  const currentGrant = filteredGrants[currentIndex];
  const hasMoreGrants = currentIndex < filteredGrants.length;

  // Count active filters
  const activeFilterCount = 
    filters.issueAreas.length + 
    filters.scopeOfGrant.length +
    (filters.fundingMin > 0 || filters.fundingMax < 1000000 ? 1 : 0) +
    (filters.deadlineAfter || filters.deadlineBefore ? 1 : 0) +
    filters.eligibilityTypes.length;

  // Format date for display
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-SG', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    });
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            Grant Matcher 
          </h1>
          <p className="text-gray-600">
            Swipe right on grants that match your NPO
          </p>
          <div className="flex items-center justify-center gap-4 mt-4">
            <p className="text-sm text-gray-500">
              {likedGrants.length} saved • {filteredGrants.length - currentIndex} remaining
            </p>
            <button
              onClick={() => setIsFilterOpen(true)}
              className="relative px-4 py-2 bg-white border-2 border-indigo-200 text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors font-medium flex items-center gap-2 shadow-sm"
            >
              🔍 Filter Grants
              {activeFilterCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-indigo-600 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold shadow-md">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Active Filters Display */}
        {activeFilterCount > 0 && (
          <div className="mb-4 bg-white rounded-lg p-3 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold text-gray-600">ACTIVE FILTERS:</span>
              <button 
                onClick={() => handleApplyFilters({
                  issueAreas: [],
                  scopeOfGrant: [],
                  fundingMin: 0,
                  fundingMax: 1000000,
                  deadlineAfter: null,
                  deadlineBefore: null,
                  eligibilityTypes: []
                })}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
              >
                Clear all
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {filters.issueAreas.map(area => (
                <span key={area} className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium">
                  🎯 {area}
                </span>
              ))}
              {filters.scopeOfGrant.map(scope => (
                <span key={scope} className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                  📊 {scope}
                </span>
              ))}
              {(filters.fundingMin > 0 || filters.fundingMax < 1000000) && (
                <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                  💰 ${filters.fundingMin.toLocaleString()} - ${filters.fundingMax.toLocaleString()}
                </span>
              )}
              {(filters.deadlineAfter || filters.deadlineBefore) && (
                <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                  📅 {filters.deadlineAfter && `After ${formatDate(filters.deadlineAfter)}`}
                  {filters.deadlineAfter && filters.deadlineBefore && ' - '}
                  {filters.deadlineBefore && `Before ${formatDate(filters.deadlineBefore)}`}
                </span>
              )}
              {filters.eligibilityTypes.map(type => (
                <span key={type} className="px-2 py-1 bg-teal-100 text-teal-700 rounded-full text-xs font-medium">
                  ✓ {type}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Grant Card Stack */}
        <div className="relative mb-8">
          {hasMoreGrants ? (
            <>
              {currentIndex + 2 < filteredGrants.length && (
                <div className="absolute inset-0 bg-white rounded-2xl shadow-lg transform translate-y-4 scale-95 opacity-50" />
              )}
              {currentIndex + 1 < filteredGrants.length && (
                <div className="absolute inset-0 bg-white rounded-2xl shadow-lg transform translate-y-2 scale-98 opacity-75" />
              )}
              
              <GrantCard 
                grant={currentGrant} 
                onSwipe={handleSwipe}
              />
            </>
          ) : (
            <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
              <div className="text-6xl mb-4">
                {filteredGrants.length === 0 ? '🔍' : '🎉'}
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                {filteredGrants.length === 0 
                  ? 'No matching grants found'
                  : 'All done!'
                }
              </h2>
              <p className="text-gray-600 mb-6">
                {filteredGrants.length === 0
                  ? 'Try adjusting your filters to discover more funding opportunities'
                  : "You've reviewed all grants matching your criteria"
                }
              </p>
              {filteredGrants.length > 0 && (
                <p className="text-lg font-semibold text-indigo-600">
                  {likedGrants.length} grants saved
                </p>
              )}
              <div className="flex gap-3 justify-center mt-6">
                {filteredGrants.length === 0 && (
                  <button
                    onClick={() => setIsFilterOpen(true)}
                    className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    Adjust Filters
                  </button>
                )}
                <button
                  onClick={() => {
                    setCurrentIndex(0);
                    setLikedGrants([]);
                  }}
                  className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Start Over
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {hasMoreGrants && (
          <div className="flex gap-6 justify-center">
            <button
              onClick={() => handleSwipe('left')}
              className="w-16 h-16 bg-white border-2 border-red-300 hover:bg-red-50 text-red-500 rounded-full shadow-lg transition-all hover:scale-110 flex items-center justify-center text-2xl"
              title="Pass"
            >
              ✕
            </button>
            <button
              onClick={() => handleSwipe('right')}
              className="w-16 h-16 bg-green-500 hover:bg-green-600 text-white rounded-full shadow-lg transition-all hover:scale-110 flex items-center justify-center text-2xl"
              title="Like"
            >
              ♥
            </button>
          </div>
        )}

        {/* Quick tip */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p> Tip: Use filters to find grants matching your NPO's focus and eligibility</p>
        </div>
      </div>

      {/* Filter Modal */}
      <Filters
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        onApplyFilters={handleApplyFilters}
        currentFilters={filters}
      />
    </main>
  );
}