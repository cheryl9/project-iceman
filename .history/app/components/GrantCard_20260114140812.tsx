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