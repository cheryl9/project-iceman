"use client";

import { useState } from 'react';
import GrantCard from './components/GrantCard';
import { mockGrants } from './lib/mockGrants';

export default function Home() {
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [likedGrants, setLikedGrants] = useState<string[]>([]);

  const handleSwipe = (direction: 'left' | 'right') => {
    if (direction === 'right') {
      setLikedGrants([...likedGrants, mockGrants[currentIndex].id]);
    }
    
    // Move to next grant
    setTimeout(() => {
      setCurrentIndex(currentIndex + 1);
    }, 300);
  };

  const currentGrant = mockGrants[currentIndex];
  const hasMoreGrants = currentIndex < mockGrants.length;

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            Grant Matcher 
          </h1>
          <p className="text-gray-600">
            Swipe right on grants that match your NPO
          </p>
          <p className="text-sm text-gray-500 mt-2">
            {likedGrants.length} grants saved • {mockGrants.length - currentIndex} remaining
          </p>
        </div>

        {/* Grant Card Stack */}
        <div className="relative mb-8">
          {hasMoreGrants ? (
            <>
              {/* Show next 2 cards in background for stack effect */}
              {currentIndex + 2 < mockGrants.length && (
                <div className="absolute inset-0 bg-white rounded-2xl shadow-lg transform translate-y-4 scale-95 opacity-50" />
              )}
              {currentIndex + 1 < mockGrants.length && (
                <div className="absolute inset-0 bg-white rounded-2xl shadow-lg transform translate-y-2 scale-98 opacity-75" />
              )}
              
              {/* Current card */}
              <GrantCard 
                grant={currentGrant} 
                onSwipe={handleSwipe}
              />
            </>
          ) : (
            <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                All done!
              </h2>
              <p className="text-gray-600 mb-6">
                You&apos;ve reviewed all available grants.
              </p>
              <p className="text-lg font-semibold text-indigo-600">
                {likedGrants.length} grants saved
              </p>
              <button
                onClick={() => {
                  setCurrentIndex(0);
                  setLikedGrants([]);2
                }}
                className="mt-6 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Start Over
              </button>
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
          <p>💡 Tip: Drag cards left or right, or use the buttons below</p>
        </div>
      </div>
    </main>
  );
}