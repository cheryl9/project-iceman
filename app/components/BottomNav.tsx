"use client";

import { usePathname, useRouter } from "next/navigation";

const tabs = [
  { label: "Discover", route: "/match" },
  { label: "Browse", route: "/browse" },
  { label: "Saved", route: "/saved" },
];

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="flex border-t bg-white">
      {tabs.map((tab) => (
        <button
          key={tab.route}
          onClick={() => router.push(tab.route)}
          className={`flex-1 py-3 text-sm ${
            pathname === tab.route
              ? "text-indigo-600 font-semibold"
              : "text-gray-500"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
