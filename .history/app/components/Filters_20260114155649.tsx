"use client";

import { useState } from "react";

interface FiltersProps {
  grant: Grant;
  onSwipe: (direction: "left" | "right") => void;
}


