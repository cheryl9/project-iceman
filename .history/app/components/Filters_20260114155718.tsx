"use client";

import { useState } from "react";

interface FiltersProps {
    isOpen: boolean;
    onClose: () => void;
    onApplyFilters: (filters: { [key: string]: any }) => void;

}


