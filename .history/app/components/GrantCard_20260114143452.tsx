"use client";

import { useState } from "react";

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

    const rotation = dragOffset / 0.1; // Rotate based on drag offset
    const opacity = 1 - Math.abs(dragOffset); // Fade out on drag

    return (
        <div 
            className = "relative w-full h-[500px] cursor-grab active:cursor-grabbing"
            onMouseDown = {handleMouseDown}
            onMouseMove = {handleMouseMove}
            onMouseUp = {handleMouseUp}
            onMouseLeave = {handleMouseUp}
            style = {{
                transform: `translateX(${dragOffset}px) rotate(${rotation}deg)`,
                opacity: opacity
                transition: isDragging ? 'none' : 'transform 0.3s ease, opacity 0.3s ease'
            }}
        >
            {/* Card container with flip effect */}\
            <div
                className = "w-full h-full relative preserve-3d"
                style = {{
                    transformStyle: "preserve-3d",
                    transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
                    transition: "transform 0.6s"
                }}
            >
            {/* Front of card */}
            <div className = "absolute inset-0 backface-hidden bg-white rounded-2xl shadow-lg p-6 overflow-y-auto"></div>
                <div className = "flex justify-between items-start mb-4">
                    <div className = "flex-1">
                        <h2 className = "text-2xl font-bold text-gray-800 mb-2">{grant.title}</h2>
                        <p className = "text-sm text-gray-500 mt-1">{grant.information}</p>
                    </div>
                    <button
                        onClick = {(e) => {
                            e.stopPropagation();
                            setIsFlipped(true);
                        }}
                    >


            }
    )
}