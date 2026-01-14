"use client";

import { useState } from "react";

interface GrantCardProps {
    grant: Grant;
    onSwipe: (direction: "left" | "right") => void;
}
    
expor default function GrantCard({ grant, onSwipe }: GrantCardProps) {