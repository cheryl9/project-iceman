"use client";

import { useRouter } from "next/navigation";

export default function WelcomePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-100 to-purple-200 px-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
        <h1 className="text-4xl font-bold text-gray-800 mb-4">
          GrantSwipe
        </h1>
        <p className="text-gray-600 mb-8">
          Discover grants tailored to your NPO.  
          Swipe. Save. Succeed.
        </p>

        <button
          onClick={() => router.push("/onboarding")}
          className="w-full py-3 bg-indigo-600 text-white rounded-full text-lg hover:bg-indigo-700 transition"
        >
          Get Started
        </button>
      </div>
    </div>
  );
}
