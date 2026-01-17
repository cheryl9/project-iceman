"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LoadingPage() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push("/match");
    }, 2500); 

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-100">
      <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mb-6" />
      <h2 className="text-xl font-semibold text-gray-700">
        AI is matching grants for your NPO...
      </h2>
      <p className="text-sm text-gray-500 mt-2">
        Analysing eligibility, KPIs and funding fit
      </p>
    </div>
  );
}
