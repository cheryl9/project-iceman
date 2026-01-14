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
        onApplyFilters(resetFilters);
        onClose();
    };

    const today = new Date().toISOString().split("T")[0];

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50">
    )




