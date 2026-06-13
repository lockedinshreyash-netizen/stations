"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { Home, Trophy, Users, Archive, Clock, MessageCircle, Moon, Sun } from "lucide-react";
import type { User } from "@/types";
import ProfileModal from "./ProfileModal";
import { useWinsUnread } from "@/lib/wins/useWinsUnread";
import { useNetworkUnread } from "@/lib/rooms/useNetworkUnread";
import { useDmUnread } from "@/lib/dm/useDmUnread";
import { tap } from "@/lib/feedback";

const NAV = [
  { label: "Home", href: "/home", Icon: Home },
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

  // Sliding active indicator — measures the active tab and glides a glowing
  // pill behind it on every navigation.
  const navRef = useRef<HTMLDivElement>(null);
  const [ind, setInd] = useState({ left: 0, top: 0, width: 0, height: 0, show: false });

  useLayoutEffect(() => {
    const root = navRef.current;
    if (!root) return;
    const measure = () => {
      const el = root.querySelector<HTMLElement>('[data-nav-active="true"]');
      if (!el) {
        setInd((p) => ({ ...p, show: false }));
        return;
      }
      setInd({
        left: el.offsetLeft,
        top: el.offsetTop,
        width: el.offsetWidth,
        height: el.offsetHeight,
        show: true,
      });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [pathname]);

  function toggleTheme() {
    tap();
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("stations-theme", next);
    } catch {}
    setTheme(next);
  }

  return (
    <>
      {/* Responsive nav sizing. Below 420px the bar goes icon-only (labels +
          divider hide) so all seven controls fit comfortably on small phones;
          wider screens get the full labelled treatment. */}
      <style>{`
        .st-navbar { gap: 2px; }
        .st-navitem {
          min-width: 44px;
          padding: 6px 8px 5px;
        }
        .st-navlabel { font-size: 11px; }
        /* Compact, icon-only on small phones — but the bar still hugs its
           content and floats; it never stretches edge-to-edge. */
        @media (max-width: 420px) {
          .st-navbar { gap: 1px; }
          .st-navitem { min-width: 40px; padding: 9px 6px; }
          .st-navlabel { display: none; }
          .st-navdivider { display: none !important; }
        }
      `}</style>
      {/* Positioning is owned by the shared dock in PlatformShell; this is just
          the bar itself, centred within that dock. */}
      <nav className="flex justify-center" aria-label="Primary">
        <div
          ref={navRef}
          className="st-navbar st-liquid pointer-events-auto flex items-center justify-center px-1.5 py-1.5"
          style={{
            position: "relative",
            borderRadius: "9999px",
            maxWidth: "calc(100vw - 24px)",
          }}
        >
          {/* Sliding active indicator — glides + glows beneath the active tab. */}
          <span
            aria-hidden
            style={{
              position: "absolute",
              left: ind.left,
              top: ind.top,
              width: ind.width,
              height: ind.height,
              borderRadius: "14px",
              background: "rgba(var(--accent-rgb),0.16)",
              boxShadow:
                "inset 0 0 0 0.5px rgba(var(--accent-rgb),0.35), 0 0 16px rgba(var(--accent-rgb),0.25)",
              opacity: ind.show ? 1 : 0,
              transition:
                "left 0.42s cubic-bezier(0.34,1.4,0.5,1), top 0.42s cubic-bezier(0.34,1.4,0.5,1), width 0.42s cubic-bezier(0.34,1.4,0.5,1), height 0.3s var(--ease), opacity 0.3s var(--ease)",
              pointerEvents: "none",
              zIndex: 0,
            }}
          />
          {NAV.map(({ label, href, Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                title={label}
                onClick={() => tap()}
                data-nav-active={active ? "true" : "false"}
                className="st-navitem st-pill flex flex-col items-center justify-center gap-1 shrink-0"
                style={{
                  position: "relative",
                  zIndex: 1,
                  borderRadius: "14px",
                  background: "transparent",
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
                  className="st-navlabel font-poppins uppercase"
                  style={{ letterSpacing: "0.04em", lineHeight: 1, fontWeight: 500 }}
                >
                  {label}
                </span>
              </Link>
            );
          })}

          {/* Divider */}
          <span
            aria-hidden
            className="st-navdivider"
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
            className="st-navitem st-pill flex flex-col items-center justify-center gap-1 shrink-0"
            style={{
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
              className="st-navlabel font-poppins uppercase"
              style={{ letterSpacing: "0.04em", lineHeight: 1, fontWeight: 500 }}
            >
              Theme
            </span>
          </button>

          {/* Profile */}
          <button
            type="button"
            onClick={() => {
              tap();
              setProfileOpen(true);
            }}
            aria-label="Profile settings"
            title="Profile settings"
            className="st-navitem st-pill flex flex-col items-center justify-center gap-1 shrink-0"
            style={{
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
              className="st-navlabel font-poppins uppercase"
              style={{ letterSpacing: "0.04em", lineHeight: 1, fontWeight: 500, color: "rgba(var(--fg-rgb),0.5)" }}
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
