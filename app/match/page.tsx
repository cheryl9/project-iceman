"use client";

import { useEffect, useState } from "react";
import GrantCard from "../components/GrantCard";
import BottomNav from "../components/BottomNav";
import { saveSwipe } from "../lib/api";
import { Grant } from "../lib/types";

import { motion, useMotionValue, useTransform, animate } from "framer-motion";



function SwipeableGrantCard({
  grant,
  onSwipe,
}: {
  grant: Grant;
  onSwipe: (direction: "left" | "right") => void;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 0, 200], [-10, 0, 10]);
  const opacity = useTransform(x, [-240, -80, 0, 80, 240], [0.3, 1, 1, 1, 0.3]);

  // "LIKE" / "PASS" badges fade in while dragging
  const likeOpacity = useTransform(x, [20, 140], [0, 1]);
  const passOpacity = useTransform(x, [-140, -20], [1, 0]);

  const triggerSwipe = async (dir: "left" | "right") => {
    const targetX = dir === "right" ? 520 : -520;

    // animate card off-screen first
    await new Promise<void>((resolve) => {
      const controls = animate(x, targetX, {
        type: "spring",
        stiffness: 420,
        damping: 32,
        onComplete: resolve,
      });
      return () => controls.stop();
    });

    // reset and notify parent
    x.set(0);
    onSwipe(dir);
  };

  return (
    <div className="relative">
      <motion.div
        style={{ x, rotate, opacity }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.18}
        onDragEnd={(_, info) => {
          if (info.offset.x > 120) triggerSwipe("right");
          else if (info.offset.x < -120) triggerSwipe("left");
          else animate(x, 0, { type: "spring", stiffness: 420, damping: 30 });
        }}
        className="relative"
      >
        {/* PASS / LIKE badges */}
        <motion.div
          style={{ opacity: passOpacity }}
          className="pointer-events-none absolute top-5 left-5 z-20 rotate-[-10deg] rounded-xl border-2 border-rose-500 bg-white/90 px-3 py-1 text-sm font-extrabold text-rose-600 shadow-lg"
        >
          PASS
        </motion.div>

        <motion.div
          style={{ opacity: likeOpacity }}
          className="pointer-events-none absolute top-5 right-5 z-20 rotate-[10deg] rounded-xl border-2 border-emerald-500 bg-white/90 px-3 py-1 text-sm font-extrabold text-emerald-600 shadow-lg"
        >
          SAVE
        </motion.div>

        {/* Your existing card */}
        <GrantCard grant={grant} onSwipe={onSwipe} />
      </motion.div>

      {/* Mobile hint */}
      <div className="mt-3 text-center text-xs text-gray-500">
        Drag left to skip, drag right to save!
      </div>

      {/* Expose programmatic swipe for buttons via window (simple hack-free approach) */}
      <div className="hidden" data-swipe-hook />
    </div>
  );
}

export default function MatchPage() {
  const [grants, setGrants] = useState<Grant[]>([]);
  const [savedCount, setSavedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const getKey = (g: Grant) => g.applicationUrl || g.id;

  useEffect(() => {
    async function loadMatchedGrants() {
      try {
        setLoading(true);

        const storedUserId = localStorage.getItem("user_id");
        if (!storedUserId) {
          setError("No profile found. Please complete onboarding first.");
          return;
        }
        setUserId(storedUserId);

        // Get already saved grants from backend
        const { getSavedGrants } = await import("../lib/api");
        const savedGrantsFromBackend = await getSavedGrants(storedUserId);
        
        // Build set of saved grant keys from backend data
        const savedKeys = new Set<string>();
        savedGrantsFromBackend.forEach((grant: any) => {
          const key = grant.source_url || grant.firestore_id || grant.id;
          if (key) savedKeys.add(key);
        });
        
        // Sync localStorage with backend
        localStorage.setItem("saved_grant_keys", JSON.stringify(Array.from(savedKeys)));
        setSavedCount(savedKeys.size);

        const { fetchGrants } = await import("../lib/api");
        const grantsData = await fetchGrants();

        const mapGrant = (grantData: any): Grant => {
          const profile = grantData.grant_profile || {};
          const funding = profile.funding || {};
          const applicationWindow = profile.application_window || {};

          return {
            id: grantData.firestore_id || grantData.id || "unknown",
            title: grantData.title,
            organization: grantData.agency,
            description: grantData.about || "",
            issueAreas: profile.issue_areas || [],
            scope: profile.scope_tags?.[0] || "",
            fundingMin: funding.min_amount_sgd || 0,
            fundingMax: funding.cap_amount_sgd || 0,
            fundingRaw: funding.raw || grantData.funding || "",
            deadline: applicationWindow.end_date || applicationWindow.dates?.[0] || "2026-12-31",
            eligibility: profile.eligibility?.requirements || [],
            kpis: [],
            applicationUrl: grantData.source_url || "",
            matchScore: 75,
            confidence: "medium",
            reasoning: "Based on your profile",
            strengths: ["Available grant opportunity"],
            concerns: ["Complete your profile for better matching"],
          };
        };

        const allMatchedGrants: Grant[] = (grantsData || []).slice(0, 50).map(mapGrant);

        // Filter out already saved grants
        const unseenGrants = allMatchedGrants.filter(grant => {
          const key = getKey(grant);
          return !savedKeys.has(key);
        });

        setGrants(unseenGrants);
        setError(null);
      } catch (err) {
        console.error(err);
        setError("Failed to load grants. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    loadMatchedGrants();
  }, []);

  const handleSwipe = async (direction: "left" | "right") => {
    const current = grants[0];
    if (!current) return;

    const uid = localStorage.getItem("user_id");
    if (uid) {
      try {
        const action = direction === "right" ? "like" : "dislike";
        const grantId = current.applicationUrl || current.id || "";
        await saveSwipe(uid, grantId, action, current.matchScore || 0);

        if (direction === "right") {
          // Update shared localStorage
          const key = getKey(current);
          const savedKeysRaw = localStorage.getItem("saved_grant_keys");
          const savedKeys = savedKeysRaw ? new Set(JSON.parse(savedKeysRaw)) : new Set();
          savedKeys.add(key);
          localStorage.setItem("saved_grant_keys", JSON.stringify(Array.from(savedKeys)));
          setSavedCount(savedKeys.size);
        }
      } catch (e) {
        console.error("Error saving swipe:", e);
      }
    }

    setGrants((prev) => prev.slice(1));
  };

  const remaining = grants.length;

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-blue-50 to-purple-50">
      {/* Soft background blobs */}
      <div className="pointer-events-none absolute -top-24 -left-24 h-80 w-80 rounded-full bg-indigo-200 blur-3xl opacity-40" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-purple-200 blur-3xl opacity-40" />
      

      {/* Animated aurora layer */}
<div className="pointer-events-none absolute inset-0 opacity-50">
  <div className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-gradient-to-br from-indigo-300/40 via-purple-300/30 to-emerald-300/30 blur-3xl animate-[pulse_6s_ease-in-out_infinite]" />
  <div className="absolute top-40 -left-28 h-[420px] w-[420px] rounded-full bg-gradient-to-br from-sky-300/35 via-indigo-300/25 to-purple-300/25 blur-3xl animate-[pulse_7s_ease-in-out_infinite]" />
  <div className="absolute bottom-10 -right-28 h-[460px] w-[460px] rounded-full bg-gradient-to-br from-emerald-300/30 via-purple-300/25 to-indigo-300/30 blur-3xl animate-[pulse_8s_ease-in-out_infinite]" />
</div>

      {/* Content */}
      <div className="relative mx-auto max-w-2xl px-4 pt-6 pb-24">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
  <div>
    <div className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/60 px-3 py-1 text-xs font-semibold text-indigo-700 shadow-sm backdrop-blur">
      AI-matched for your NPO
      <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
      Swipe to save
    </div>

    <h1 className="mt-3 text-3xl md:text-4xl font-extrabold tracking-tight text-gray-900">
      Discover Grants{" "}
      <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-emerald-600 bg-clip-text text-transparent">
        that fit
      </span>
    </h1>

    <p className="mt-2 text-sm md:text-base text-gray-600">
      Fast decisions. Clean summaries. Save what matters.
    </p>

    <div className="mt-4 flex flex-wrap items-center gap-2">
      <span className="rounded-full border border-white/60 bg-white/70 px-3 py-1 text-xs font-semibold text-gray-800 shadow-sm backdrop-blur">
        Saved <span className="text-indigo-700">{savedCount}</span>
      </span>
      <span className="rounded-full border border-white/60 bg-white/70 px-3 py-1 text-xs font-semibold text-gray-800 shadow-sm backdrop-blur">
        Remaining <span className="text-indigo-700">{remaining}</span>
      </span>
      {userId && (
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
          Profile loaded
        </span>
      )}
    </div>
  </div>

  <div className="rounded-2xl border border-white/60 bg-white/70 px-4 py-3 shadow-sm backdrop-blur">
    <div className="text-xs font-semibold text-gray-600">Your Matches</div>
    <div className="mt-1 text-sm text-gray-800">
      <span className="font-extrabold text-indigo-700">{savedCount}</span> saved
    </div>
  </div>
</div>


        {/* Card area */}
        <div className="relative">
          {/* Stack background cards (make them visually distinct) */}
{remaining > 1 && (
  <div
    className="
      pointer-events-none absolute inset-0 z-0
      translate-y-4 scale-[0.985]
      rounded-2xl
      bg-gradient-to-br from-indigo-100/70 via-white/40 to-purple-100/70
      border border-indigo-200/60
      backdrop-blur-sm
    "
  />
)}
{remaining > 2 && (
  <div
    className="
      pointer-events-none absolute inset-0 z-0
      translate-y-8 scale-[0.97]
      rounded-2xl
      bg-gradient-to-br from-purple-100/60 via-white/30 to-indigo-100/60
      border border-dashed border-purple-200/70
      backdrop-blur-sm
    "
  />
)}

          {/* Main card container */}
          <div className="relative z-10 rounded-2xl border border-gray-200/70 bg-white/85 backdrop-blur">
          <div className="h-1.5 w-full rounded-t-2xl bg-gradient-to-r from-indigo-400 via-purple-400 to-emerald-400 opacity-70" />

            <div className="p-4 md:p-6">
              {loading ? (
                <div className="animate-pulse space-y-4">
                  <div className="h-6 w-2/3 rounded bg-gray-200" />
                  <div className="h-4 w-1/3 rounded bg-gray-200" />
                  <div className="h-40 rounded bg-gray-200" />
                  <div className="h-10 w-full rounded bg-gray-200" />
                </div>
              ) : error ? (
                <div className="text-center py-10">
                  <div className="text-4xl mb-3">⚠️</div>
                  <p className="text-red-600 font-semibold">{error}</p>
                  <p className="mt-2 text-sm text-gray-600">
                    Backend should run at <span className="font-mono">http://localhost:8000</span>
                  </p>
                </div>
              ) : grants.length > 0 ? (
                <SwipeableGrantCard grant={grants[0]} onSwipe={handleSwipe} />
              ) : (
                <div className="text-center py-12">
                  <div className="text-5xl mb-3">🎉</div>
                  <h2 className="text-xl font-bold text-gray-900">You’re done!</h2>
                  <p className="mt-2 text-sm text-gray-600">
                    No more grants in your recommendations.
                  </p>
                  <p className="mt-4 text-indigo-700 font-semibold">
                    Saved {savedCount} grants
                  </p>
                </div>
              )}
            </div>

            {/* Action buttons (only when there's a card) */}
            {!loading && !error && grants.length > 0 && (
              <div className="flex items-center justify-center gap-8 border-t border-gray-100 px-6 py-3">
              <button
                onClick={() => handleSwipe("left")}
                className="
  group relative h-14 w-14 rounded-full
  bg-white/70 border border-white/70
  backdrop-blur
  transition
  hover:scale-125 active:scale-95
"

                title="Skip"
              >
                <span className="absolute inset-0 rounded-full bg-gradient-to-br from-rose-400/30 to-orange-300/20 opacity-0 group-hover:opacity-100 transition" />
                <span className="relative grid place-items-center text-2xl">
                  ✕
                </span>
                <span className="absolute -bottom-1 right-1 -translate-x-1/2 whitespace-nowrap text-[11px] font-semibold text-gray-500">
                  Skip
                </span>
              </button>
            
              <button
                onClick={() => handleSwipe("right")}
                className="group relative transition hover:scale-125 active:scale-95"
                title="Save"
              >
                <span className="relative text-2xl">
                  ♥
                </span>
                <span className="absolute -bottom-4 -translate-x-1/2 whitespace-nowrap text-[11px] font-semibold text-gray-500">
                  Save
                </span>
              </button>
            </div>
            )}
          </div>
        </div>
      </div>

      {/* Keep BottomNav at bottom without pushing content */}
      <div className="fixed bottom-0 left-0 right-0">
        <BottomNav />
      </div>
    </main>
  );
}
