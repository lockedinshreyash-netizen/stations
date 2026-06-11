"use client";

import { Lock } from "lucide-react";

/**
 * Paywall panel shown to free members where the player would be (and when a
 * locked lesson is tapped). No checkout yet — Razorpay billing is a separate
 * feature — so the CTA is informational for now.
 */
export default function UpgradeUpsell() {
  return (
    <div
      className="st-card flex flex-col items-center text-center px-8 py-12"
      style={{
        background: "var(--bg-surface)",
        border: "0.5px solid rgba(var(--accent-rgb),0.3)",
        aspectRatio: "16 / 9",
        justifyContent: "center",
      }}
    >
      <span
        className="flex items-center justify-center mb-5"
        style={{
          width: "56px",
          height: "56px",
          borderRadius: "9999px",
          background: "rgba(var(--accent-rgb),0.12)",
          color: "var(--accent)",
        }}
      >
        <Lock size={24} strokeWidth={1.75} />
      </span>

      <h3
        className="font-poppins font-black uppercase"
        style={{
          fontSize: "20px",
          letterSpacing: "0.04em",
          color: "rgb(var(--fg-rgb))",
          marginBottom: "10px",
        }}
      >
        Members only
      </h3>

      <p
        className="font-playfair italic max-w-md"
        style={{
          fontSize: "18px",
          lineHeight: 1.5,
          color: "rgba(var(--fg-rgb),0.6)",
        }}
      >
        Courses in the Archive are part of Stations+ and the Founding Cohort.
        Upgrade to unlock every lesson — taught by people who&rsquo;ve actually
        done the thing.
      </p>

      <span
        className="font-poppins uppercase mt-7"
        style={{
          fontSize: "12px",
          letterSpacing: "0.16em",
          color: "rgba(var(--fg-rgb),0.35)",
          border: "0.5px solid rgba(var(--fg-rgb),0.18)",
          borderRadius: "var(--radius-btn)",
          padding: "12px 22px",
        }}
      >
        Membership upgrades coming soon
      </span>
    </div>
  );
}
