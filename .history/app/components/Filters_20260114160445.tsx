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
    
}




