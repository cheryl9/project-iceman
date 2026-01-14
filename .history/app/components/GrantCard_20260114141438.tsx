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
}