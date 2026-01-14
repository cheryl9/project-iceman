"use client";

import { useState } from "react";
import { Grant, formatCurrency, formatDeadline } from '../lib/mockGrants';

interface GrantCardProps {
  grant: Grant;
  onSwipe: (direction: "left" | "right") => void;
}

export default function GrantCard({ grant, onSwipe }: GrantCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [dragStart, setDragStart] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart(e.clientX);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const offset = e.clientX - dragStart;
    setDragOffset(offset);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    
    // Swipe threshold: 100px
    if (Math.abs(dragOffset) > 100) {
      const direction = dragOffset > 0 ? 'right' : 'left';
      onSwipe(direction);
    }
    
    setDragOffset(0);
  };

  const rotation = dragOffset / 10; // Rotate based on drag offset
  const opacity = 1 - Math.abs(dragOffset) / 500; // Fade out on drag

  return (
    <div 
      className="relative w-full h-[500px] cursor-grab active:cursor-grabbing"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{
        transform: `translateX(${dragOffset}px) rotate(${rotation}deg)`,
        opacity: opacity,
        transition: isDragging ? 'none' : 'transform 0.3s ease, opacity 0.3s ease'
      }}
    >
      {/* Card container with flip effect */}
      <div
        className="w-full h-full relative preserve-3d"
        style={{
          transformStyle: "preserve-3d",
          transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
          transition: "transform 0.6s"
        }}
      >
        {/* Front of card */}
        <div className="absolute inset-0 backface-hidden bg-white rounded-2xl shadow-lg p-6 overflow-y-auto">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-800 mb-2">{grant.title}</h2>
              <p className="text-sm text-gray-500 mt-1">{grant.organization}</p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsFlipped(true);
              }}
              className="ml-4 px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm hover:bg-indigo-200 transition-colors"
            >
              {isFlipped ? 'Front' : 'Details'}
            </button>
          </div>
          
          <div className="mb-4">
            <div className="flex flex-wrap gap-2 mb-4">
              {grant.issueAreas.map((area: string, idx: number) => (
                <span
                  key={idx}
                  className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                >
                  {area}
                </span>
              ))}
            </div>
          </div>

          <p className="text-gray-600 mb-6 leading-relaxed">
            {grant.description}
          </p>

          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-1">Funding Range</p>
              <p className="text-xl font-bold text-green-700">
                {formatCurrency(grant.fundingMin)} - {formatCurrency(grant.fundingMax)}
              </p>
            </div>
            
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-1">Application Deadline</p>
              <p className="text-lg font-semibold text-orange-700">
                {formatDeadline(grant.deadline)}
              </p>
            </div>
          </div>
        </div>

        {/* Back of card */}
        <div 
          className="absolute inset-0 backface-hidden bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl shadow-2xl p-6 overflow-y-auto"
          style={{ transform: 'rotateY(180deg)' }}
        >
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-xl font-bold text-gray-800">Grant Details</h3>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsFlipped(!isFlipped);
              }}
              className="px-3 py-1 bg-white text-gray-700 rounded-full text-sm hover:bg-gray-100 transition-colors"
            >
              Back
            </button>
          </div>

          <div className="space-y-6">
            <div>
              <h4 className="font-semibold text-gray-700 mb-2">Eligibility Criteria</h4>
              <ul className="space-y-2">
                {grant.eligibility.map((item: string, idx: number) => (
                  <li key={idx} className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span className="text-gray-600 text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-gray-700 mb-2">Key Performance Indicators</h4>
              <ul className="space-y-2">
                {grant.kpis.map((kpi: string, idx: number) => (
                  <li key={idx} className="flex items-start">
                    <span className="text-indigo-500 mr-2">•</span>
                    <span className="text-gray-600 text-sm">{kpi}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white rounded-lg p-4 border border-purple-200">
              <h4 className="font-semibold text-gray-700 mb-2">AI Gap Analysis</h4>
              <p className="text-sm text-gray-500 italic">
                Swipe right to save this grant if your NPO meets the criteria. Swipe left to skip.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Swipe indicators */}
      {dragOffset > 50 && (
        <div className="absolute top-8 right-8 bg-green-500 text-white px-6 py-3 rounded-lg font-bold text-xl rotate-12 opacity-80">
          LIKE
        </div>
      )}
      {dragOffset < -50 && (
        <div className="absolute top-8 left-8 bg-red-500 text-white px-6 py-3 rounded-lg font-bold text-xl -rotate-12 opacity-80">
          PASS
        </div>
      )}
    </div>
  );
}
      