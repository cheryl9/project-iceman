"use client";

import { useState } from "react";

interface FiltersProps {
    isOpen: boolean;
    onClose: () => void;
    onApplyFilters: (filters: FilterState) => void;
    currentFilters: FilterState;
}

export interface FilterState {
    issueArea: string[];
    scopeOfGrant: string[];
    fundingMin: number;
    fundingMax: number;
    deadlineAfter: string | null;
    deadlineBefore: string | null;
    eligibilityTypes: string[];
}

export default function Filters({ 
    isOpen, 
    onClose, 
    onApplyFilters, 
    currentFilters 
}: FiltersProps) {
    const[filters, setFilters] = useState<FilterState>(currentFilters);

    if (!isOpen) return null;

    const issueAreaOptions = [
        "Digital Skills/Tools",
        "Education/Learning",
        "Engagement Marketing",
        "Environment",
        "Health",
        "Heritage",
        "Social Cohesion",
        "Social Service",
        "Sport",
        "Youth"
    ]

    const scopeOptions = [
        "Apps/Social Media/Website",
        "Classes/Seminar/Workshop",
        "Construction",
        "Dialogue/Conversation",
        "Event/Exhibition/Performance",
        "Fund-Raising",
        "Music/Video",
        "Publication",
        "Research/Documentaton/Prototype",
        "Visual Arts"
    ]

    const eligibilityOptions = [
        "Registered Charity",
        "Institutions of a Public Character (IPC)",
        "Social Enterprises",
        "Community Groups",
        "Educational Institutions",
        "Healthcare Providers",
        "New Organisations (less than 1 year old)",
        "Established Organisations (more than 1 year old)"
    ]

    const toggleItem = (list:string[], item:string, key: keyof FilterState) => {
        const currentList = filters[key] as string[];
        if (currentList.includes(item)) {
            setFilters({
                ...filters,
                [key]: currentList.filter(i => i !== item)
            });
        } else {
            setFilters({
                ...filters,
                [key]: [...currentList, item]
            });
        }
    };

    const handleApply = () => {
        onApplyFilters(filters);
        onClose();
    }

    const handleReset = () => {
        const resetFilters: FilterState = {
            issueArea: [],
            scopeOfGrant: [],
            fundingMin: 0,
            fundingMax: 1000000,
            deadlineAfter: null,
            deadlineBefore: null,
            eligibilityTypes: []
        };
        setFilters(resetFilters);
    };

    const today = new Date().toISOString().split("T")[0];

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 p-6 rounded-t-2xl z-10">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">Filter Grants</h2>
                <p className="text-sm text-gray-500 mt-1">Find grants that match your organization's needs</p>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 text-3xl leading-none"
              >
                ×
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-8">
            {/* Issue Areas */}
            <div>
              <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <span className="text-lg">🎯</span>
                Issue Area
              </h3>
              <p className="text-xs text-gray-500 mb-3">Select the focus areas relevant to your NPO</p>
              <div className="flex flex-wrap gap-2">
                {issueAreaOptions.map((area: string) => (
                  <button
                    key={area}
                    onClick={() => toggleItem(filters.issueArea, area, 'issueArea')}
                    className={`px-3 py-2 rounded-full text-sm transition-all ${
                      filters.issueArea.includes(area)
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {area}
                  </button>
                ))}
              </div>
              {filters.issueArea.length > 0 && (
                <p className="text-xs text-indigo-600 mt-2 font-medium">
                  {filters.issueArea.length} area{filters.issueArea.length > 1 ? 's' : ''} selected
                </p>
              )}
            </div>

            {/* Scope of Grant */}
            <div>
              <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <span className="text-lg">📊</span>
                Scope of Grant
              </h3>
              <p className="text-xs text-gray-500 mb-3">Type and scale of projects funded</p>
              <div className="flex flex-wrap gap-2">
                {scopeOptions.map(scope => (
                  <button
                    key={scope}
                    onClick={() => toggleItem(filters.scopeOfGrant, scope, 'scopeOfGrant')}
                    className={`px-3 py-2 rounded-full text-sm transition-all ${
                      filters.scopeOfGrant.includes(scope)
                        ? 'bg-purple-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {scope}
                  </button>
                ))}
              </div>
              {filters.scopeOfGrant.length > 0 && (
                <p className="text-xs text-purple-600 mt-2 font-medium">
                  {filters.scopeOfGrant.length} scope{filters.scopeOfGrant.length > 1 ? 's' : ''} selected
                </p>
              )}
            </div>

            {/* Funding Quantum - Single Slider with Range */}
            <div>
              <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <span className="text-lg">💰</span>
                Funding Quantum (Amount)
              </h3>
              <p className="text-xs text-gray-500 mb-3">Set your required funding range</p>
              
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
                <div className="flex justify-between items-center mb-3">
                  <div className="text-center">
                    <p className="text-xs text-gray-600 mb-1">Minimum</p>
                    <p className="text-lg font-bold text-green-700">
                      ${filters.fundingMin.toLocaleString()}
                    </p>
                  </div>
                  <div className="text-gray-400">—</div>
                  <div className="text-center">
                    <p className="text-xs text-gray-600 mb-1">Maximum</p>
                    <p className="text-lg font-bold text-green-700">
                      ${filters.fundingMax.toLocaleString()}
                    </p>
                  </div>
                </div>
                
                {/* Min Slider */}
                <div className="mb-4">
                  <label className="block text-xs text-gray-600 mb-2">Minimum Funding</label>
                  <input
                    type="range"
                    min="0"
                    max="500000"
                    step="5000"
                    value={filters.fundingMin}
                    onChange={(e) => {
                      const newMin = parseInt(e.target.value);
                      setFilters({
                        ...filters,
                        fundingMin: newMin,
                        // Ensure max is always >= min
                        fundingMax: Math.max(newMin, filters.fundingMax)
                      });
                    }}
                    className="w-full h-3 bg-green-200 rounded-lg appearance-none cursor-pointer accent-green-600"
                    style={{
                      background: `linear-gradient(to right, #10b981 0%, #10b981 ${(filters.fundingMin / 500000) * 100}%, #d1fae5 ${(filters.fundingMin / 500000) * 100}%, #d1fae5 100%)`
                    }}
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>$0</span>
                    <span>$250K</span>
                    <span>$500K</span>
                  </div>
                </div>

                {/* Max Slider */}
                <div>
                  <label className="block text-xs text-gray-600 mb-2">Maximum Funding</label>
                  <input
                    type="range"
                    min="0"
                    max="1000000"
                    step="10000"
                    value={filters.fundingMax}
                    onChange={(e) => {
                      const newMax = parseInt(e.target.value);
                      setFilters({
                        ...filters,
                        fundingMax: newMax,
                        // Ensure min is always <= max
                        fundingMin: Math.min(filters.fundingMin, newMax)
                      });
                    }}
                    className="w-full h-3 bg-green-200 rounded-lg appearance-none cursor-pointer accent-green-600"
                    style={{
                      background: `linear-gradient(to right, #10b981 0%, #10b981 ${(filters.fundingMax / 1000000) * 100}%, #d1fae5 ${(filters.fundingMax / 1000000) * 100}%, #d1fae5 100%)`
                    }}
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>$0</span>
                    <span>$500K</span>
                    <span>$1M</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Application Due Date - Calendar Picker */}
            <div>
              <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <span className="text-lg">📅</span>
                Application Due Date
              </h3>
              <p className="text-xs text-gray-500 mb-3">Filter grants by application deadline dates</p>
              
              <div className="grid grid-cols-2 gap-4">
                {/* Deadline After */}
                <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Deadline After
                  </label>
                  <input
                    type="date"
                    value={filters.deadlineAfter || ''}
                    onChange={(e) => setFilters({
                      ...filters,
                      deadlineAfter: e.target.value || null
                    })}
                    min={today}
                    className="w-full px-3 py-2 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Show grants with deadlines after this date
                  </p>
                  {filters.deadlineAfter && (
                    <button
                      onClick={() => setFilters({ ...filters, deadlineAfter: null })}
                      className="text-xs text-orange-600 hover:text-orange-800 mt-2 font-medium"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Deadline Before */}
                <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Deadline Before
                  </label>
                  <input
                    type="date"
                    value={filters.deadlineBefore || ''}
                    onChange={(e) => setFilters({
                      ...filters,
                      deadlineBefore: e.target.value || null
                    })}
                    min={filters.deadlineAfter || today}
                    className="w-full px-3 py-2 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Show grants with deadlines before this date
                  </p>
                  {filters.deadlineBefore && (
                    <button
                      onClick={() => setFilters({ ...filters, deadlineBefore: null })}
                      className="text-xs text-orange-600 hover:text-orange-800 mt-2 font-medium"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Quick Date Presets */}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    const after = new Date();
                    const before = new Date();
                    before.setDate(before.getDate() + 14);
                    setFilters({
                      ...filters,
                      deadlineAfter: after.toISOString().split('T')[0],
                      deadlineBefore: before.toISOString().split('T')[0]
                    });
                  }}
                  className="px-3 py-1 bg-white border border-orange-300 text-orange-700 rounded-full text-xs hover:bg-orange-50 transition-colors"
                >
                  Next 14 days
                </button>
                <button
                  onClick={() => {
                    const after = new Date();
                    const before = new Date();
                    before.setMonth(before.getMonth() + 1);
                    setFilters({
                      ...filters,
                      deadlineAfter: after.toISOString().split('T')[0],
                      deadlineBefore: before.toISOString().split('T')[0]
                    });
                  }}
                  className="px-3 py-1 bg-white border border-orange-300 text-orange-700 rounded-full text-xs hover:bg-orange-50 transition-colors"
                >
                  Next month
                </button>
                <button
                  onClick={() => {
                    const after = new Date();
                    const before = new Date();
                    before.setMonth(before.getMonth() + 3);
                    setFilters({
                      ...filters,
                      deadlineAfter: after.toISOString().split('T')[0],
                      deadlineBefore: before.toISOString().split('T')[0]
                    });
                  }}
                  className="px-3 py-1 bg-white border border-orange-300 text-orange-700 rounded-full text-xs hover:bg-orange-50 transition-colors"
                >
                  Next 3 months
                </button>
              </div>
            </div>

            {/* Eligibility Criteria */}
            <div>
              <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <span className="text-lg">✓</span>
                Eligibility Criteria
              </h3>
              <p className="text-xs text-gray-500 mb-3">Your organization type and status</p>
              <div className="grid grid-cols-2 gap-2">
                {eligibilityOptions.map(eligibility => (
                  <button
                    key={eligibility}
                    onClick={() => toggleItem(filters.eligibilityTypes, eligibility, 'eligibilityTypes')}
                    className={`px-3 py-2 rounded-lg text-sm text-left transition-all ${
                      filters.eligibilityTypes.includes(eligibility)
                        ? 'bg-teal-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {eligibility}
                  </button>
                ))}
              </div>
              {filters.eligibilityTypes.length > 0 && (
                <p className="text-xs text-teal-600 mt-2 font-medium">
                  {filters.eligibilityTypes.length} criteria selected
                </p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-6 rounded-b-2xl flex gap-3">
            <button
              onClick={handleReset}
              className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium"
            >
              Reset All
            </button>
            <button
              onClick={handleApply}
              className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-lg"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

