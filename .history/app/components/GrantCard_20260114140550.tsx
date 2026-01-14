"use client";

import { useState } from "react";

interface GrantCardProps {
    grant: Grant;
    onSwipe: (direction: "left" | "right") => void;
}
    
export default function GrantCard({ grant, onSwipe }: GrantCardProps) {