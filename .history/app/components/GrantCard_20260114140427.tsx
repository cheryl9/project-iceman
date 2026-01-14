"use client";

import { useState } from "react";

interface GrantCardProps {
    grant: Grant;
    onSwipe: (direction: "left" | "right") => void;
    