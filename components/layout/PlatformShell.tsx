"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/layout/Sidebar";
import type { User } from "@/types";

const COLLAPSE_KEY = "sidebar_collapsed";

export default function PlatformShell({
  user,
  children,
}: {
  user: User;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Restore collapse preference
  useEffect(() => {
    const saved = localStorage.getItem(COLLAPSE_KEY);
    if (saved === "true") setCollapsed(true);
  }, []);

  function toggleCollapse() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(COLLAPSE_KEY, String(next));
      return next;
    });
  }

  return (
    <div className="flex min-h-screen bg-[var(--bg-primary)]">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/70 z-20 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar — mobile: overlay drawer; desktop: static */}
      <div
        className={`fixed inset-y-0 left-0 z-30 lg:static lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
        style={{ transition: "transform 250ms ease" }}
      >
        <Sidebar user={user} collapsed={collapsed} onToggle={toggleCollapse} />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <div
          className="lg:hidden flex items-center gap-4 px-6 py-4"
          style={{ borderBottom: "0.5px solid rgba(var(--fg-rgb),0.06)" }}
        >
          <button
            onClick={() => setMobileOpen(true)}
            className="text-[rgba(var(--fg-rgb),0.5)] hover:text-[rgb(var(--fg-rgb))] transition-colors"
            aria-label="Open menu"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path
                d="M2 4.5h14M2 9h14M2 13.5h14"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <span
            className="font-poppins font-black uppercase text-[rgb(var(--fg-rgb))]"
            style={{ fontSize: "13px", letterSpacing: "0.25em" }}
          >
            STATIONS
          </span>
        </div>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
