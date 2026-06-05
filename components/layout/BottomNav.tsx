"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Trophy, Users, Archive, Clock, MessageCircle, Moon, Sun } from "lucide-react";
import type { User } from "@/types";
import ProfileModal from "./ProfileModal";
import { useWinsUnread } from "@/lib/wins/useWinsUnread";
import { useNetworkUnread } from "@/lib/rooms/useNetworkUnread";
import { useDmUnread } from "@/lib/dm/useDmUnread";

const NAV = [
  { label: "Wins", href: "/wins", Icon: Trophy },
  { label: "Network", href: "/network", Icon: Users },
  { label: "Archive", href: "/archive", Icon: Archive },
  { label: "Work", href: "/work", Icon: Clock },
  { label: "Messages", href: "/messages", Icon: MessageCircle },
] as const;

/**
 * Floating glass navbar pinned to the bottom-center of the viewport.
 * Replaces the old left sidebar — carries the five stations plus the
 * theme toggle and profile access that used to live there.
 */
export default function BottomNav({ user }: { user: User }) {
  const pathname = usePathname();
  const [profileOpen, setProfileOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  // Unread/notification state for the Wins and Network tabs.
  const { hasNew: winsHasNew, markSeen: markWinsSeen } = useWinsUnread(user.id);
  const networkUnread = useNetworkUnread(user);
  const dmUnread = useDmUnread(user.id);
  const onWins = pathname.startsWith("/wins");

  // Reaching the Wins feed (by any route) clears its badge.
  useEffect(() => {
    if (onWins) markWinsSeen();
  }, [onWins, markWinsSeen]);

  const badgeFor = (href: string): boolean => {
    if (href === "/wins") return winsHasNew && !onWins;
    if (href === "/network") return networkUnread;
    if (href === "/messages") return dmUnread;
    return false;
  };

  useEffect(() => {
    const t = document.documentElement.getAttribute("data-theme");
    if (t === "light" || t === "dark") setTheme(t);
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("stations-theme", next);
    } catch {}
    setTheme(next);
  }

  return (
    <>
      <nav
        className="fixed inset-x-0 z-40 flex justify-center pointer-events-none"
        style={{ bottom: "calc(16px + env(safe-area-inset-bottom))" }}
        aria-label="Primary"
      >
        <div
          className="st-glass pointer-events-auto flex items-center gap-0.5 px-1.5 py-1.5"
          style={{
            borderRadius: "9999px",
            boxShadow: "var(--shadow-lg)",
            border: "0.5px solid var(--glass-border)",
            maxWidth: "calc(100vw - 20px)",
          }}
        >
          {NAV.map(({ label, href, Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                title={label}
                className="st-pill flex flex-col items-center justify-center gap-1 shrink-0"
                style={{
                  minWidth: "40px",
                  padding: "6px 6px 5px",
                  borderRadius: "14px",
                  background: active ? "rgba(var(--accent-rgb),0.14)" : "transparent",
                  color: active ? "var(--accent)" : "rgba(var(--fg-rgb),0.5)",
                }}
              >
                <span style={{ position: "relative", display: "inline-flex" }}>
                  <Icon size={18} strokeWidth={1.75} aria-hidden />
                  {badgeFor(href) && (
                    <span
                      role="status"
                      aria-label="Unread"
                      style={{
                        position: "absolute",
                        top: "-3px",
                        right: "-4px",
                        width: "7px",
                        height: "7px",
                        borderRadius: "9999px",
                        background: "var(--accent)",
                        boxShadow: "0 0 0 1.5px var(--glass-bg)",
                      }}
                    />
                  )}
                </span>
                <span
                  className="font-poppins uppercase"
                  style={{ fontSize: "11px", letterSpacing: "0.04em", lineHeight: 1, fontWeight: 500 }}
                >
                  {label}
                </span>
              </Link>
            );
          })}

          {/* Divider */}
          <span
            aria-hidden
            style={{
              width: "0.5px",
              height: "30px",
              background: "rgba(var(--fg-rgb),0.15)",
              margin: "0 3px",
              flexShrink: 0,
            }}
          />

          {/* Theme toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={theme === "dark" ? "Light mode" : "Dark mode"}
            className="st-pill flex flex-col items-center justify-center gap-1 shrink-0"
            style={{
              minWidth: "40px",
              padding: "6px 6px 5px",
              borderRadius: "14px",
              color: "rgba(var(--fg-rgb),0.5)",
              background: "transparent",
              border: "none",
              cursor: "pointer",
            }}
          >
            {theme === "dark" ? (
              <Moon size={18} strokeWidth={1.75} aria-hidden />
            ) : (
              <Sun size={18} strokeWidth={1.75} aria-hidden />
            )}
            <span
              className="font-poppins uppercase"
              style={{ fontSize: "11px", letterSpacing: "0.04em", lineHeight: 1, fontWeight: 500 }}
            >
              Theme
            </span>
          </button>

          {/* Profile */}
          <button
            type="button"
            onClick={() => setProfileOpen(true)}
            aria-label="Profile settings"
            title="Profile settings"
            className="st-pill flex flex-col items-center justify-center gap-1 shrink-0"
            style={{
              minWidth: "40px",
              padding: "6px 6px 5px",
              borderRadius: "14px",
              background: "transparent",
              border: "none",
              cursor: "pointer",
            }}
          >
            <span
              className="flex items-center justify-center overflow-hidden"
              style={{
                width: "20px",
                height: "20px",
                borderRadius: "50%",
                border: "0.5px solid rgba(var(--fg-rgb),0.2)",
                background: "var(--bg-surface)",
              }}
            >
              {user.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatar_url}
                  alt={user.username}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span
                  className="font-poppins uppercase"
                  style={{ fontSize: "12px", fontWeight: 500, color: "rgba(var(--fg-rgb),0.6)" }}
                >
                  {user.username[0]}
                </span>
              )}
            </span>
            <span
              className="font-poppins uppercase"
              style={{ fontSize: "11px", letterSpacing: "0.04em", lineHeight: 1, fontWeight: 500, color: "rgba(var(--fg-rgb),0.5)" }}
            >
              Profile
            </span>
          </button>
        </div>
      </nav>

      {profileOpen && (
        <ProfileModal user={user} onClose={() => setProfileOpen(false)} />
      )}
    </>
  );
}
