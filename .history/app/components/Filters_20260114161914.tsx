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
    deadlineDays: number | null;
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

    const fundingQuantam = [0, 5000, 10000, 50000, 100000, 500000];

    const deadlineOptions = [




