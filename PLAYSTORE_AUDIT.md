# Play Store Readiness Audit — Stations

**Date:** June 18, 2026
**Target:** Google Play Store launch via Bubblewrap (Trusted Web Activity / TWA)
**Scope:** `D:\StationsHQ\stations` (Next.js 16 + React 19 + Tailwind v4 + Supabase PWA)

This document records the compliance work completed in this pass, the issues
found during the codebase audit, what was fixed automatically, and the manual
steps that remain before submitting to the Play Console.

---

## 1. Summary of compliance work completed

| Requirement | Status |
| --- | --- |
| Privacy Policy page (`/privacy`) | ✅ Done |
| Terms of Service page (`/terms`) | ✅ Done |
| Required Terms/Privacy consent checkbox at signup | ✅ Done |
| Legal section in Account Settings | ✅ Done |
| Privacy / Terms / Contact footer links on public surfaces | ✅ Done |
| Manifest hardening for TWA | ✅ Done |
| Root metadata hardening (title template, OG, viewport) | ✅ Done |
| Digital Asset Links file scaffold (`/.well-known/assetlinks.json`) | ⚠️ Scaffolded — needs signing fingerprint (manual) |

---

## 2. Issues found and fixes applied

### 2.1 Missing legal pages — **FIXED**
No Privacy Policy or Terms of Service existed. Google Play **requires** a
publicly reachable privacy policy URL, and a TWA must surface terms. Created:

- `app/privacy/page.tsx` — full Privacy Policy with all required sections
  (Information We Collect, How We Use Information, Services We Use, Push
  Notifications, Data Storage, Data Sharing, User Content, Account Deletion,
  Children's Privacy, Changes, Contact). Accurately describes the data Stations
  collects (name, email, profile image, username, user-generated content, DMs,
  wins, reactions, notification preferences) and the services it relies on
  (Supabase Auth, Google Sign-In, Web Push). No analytics provider is present in
  the codebase today, so the policy states this and commits to updating before
  any is added.
- `app/terms/page.tsx` — full Terms of Service (Eligibility, Account
  Responsibilities, Community Conduct, User Content, Moderation, Platform
  Availability, Payments, Intellectual Property, Limitation of Liability,
  Termination, Changes, Contact).
- `components/legal/LegalDocument.tsx` — shared, theme-driven, mobile-first
  chrome + typography primitives (`Section`, `P`, `List`) so both pages match
  the Stations design system.

**Both pages are public** (verified: `GET /privacy` and `GET /terms` return
`200` with no auth redirect — the `proxy.ts` matcher and `updateSession` only
guard the platform routes, never the legal routes). This matters because the
Play Console crawler and Google's OAuth verification fetch these URLs while
logged out.

### 2.2 No consent gate at signup — **FIXED**
The join funnel created accounts (Google + email) with no terms acceptance.
Added a required, **unchecked-by-default** checkbox in the auth step
(`components/onboarding/JoinFlow.tsx`):

- Text: "I agree to the Terms of Service and Privacy Policy." with the two
  phrases linking to `/terms` and `/privacy` (open in a new tab).
- Blocks **both** sign-up paths: the email submit button is disabled until
  checked, and `GoogleButton` is gated (dimmed + inert) until checked, showing
  an inline error if clicked early.
- `components/onboarding/GoogleButton.tsx` gained `disabled` / `onBlockedClick`
  props for this gating.

Verified end-to-end in the browser: checkbox starts unchecked, Google button is
`aria-disabled` and dimmed (opacity 0.4) while unchecked, clicking it surfaces
"Please agree to the Terms of Service and Privacy Policy to continue.", and
checking the box enables both paths.

### 2.3 No legal access inside the app — **FIXED**
Added a **Legal** section to the Account Settings modal
(`components/layout/ProfileModal.tsx`) linking to `/privacy` and `/terms`
(closes the modal and navigates via `next/link`).

### 2.4 No legal footer on public surfaces — **FIXED**
Created `components/legal/LegalFooter.tsx` (Privacy Policy · Terms · Contact,
where Contact is `mailto:lockedinshreyash@gmail.com`) and mounted it on:

- the login page (`app/(auth)/login/page.tsx`),
- the join funnel intro (`components/onboarding/JoinFlow.tsx`).

The authenticated platform shell deliberately has no persistent footer (it uses
a floating bottom dock); in-app legal access is provided through the Settings
Legal section instead.

### 2.5 Manifest gaps for TWA — **FIXED**
`public/manifest.json` already had `name`, `short_name`, `start_url`, `scope`,
`display: standalone`, `theme_color`, `background_color`, and a complete icon
set (192 any, 512 any, 512 maskable — all present in `public/`). Added the
fields Bubblewrap and the Play listing benefit from:

- `id: "/"` (stable app identity),
- `lang: "en"`, `dir: "ltr"`,
- `categories: ["social", "productivity", "education"]`.

### 2.6 Metadata hardening — **FIXED**
`app/layout.tsx`:

- Added a title template (`%s · Stations`) so child pages brand consistently
  (and de-duplicated the existing `/join` title accordingly).
- Added `applicationName`, `formatDetection`, an `openGraph` block, and a
  default `icon`.
- Added `metadataBase` (driven by `NEXT_PUBLIC_APP_URL` when set — see manual
  tasks) so Open Graph/absolute URLs resolve correctly.
- Expanded `viewport` with `width=device-width`, `initialScale=1`, and
  `viewportFit: "cover"` for proper edge-to-edge rendering inside the TWA.

### 2.7 Digital Asset Links — **SCAFFOLDED (manual completion required)**
A TWA **must** serve `/.well-known/assetlinks.json` from the launch domain or
Android will show the in-app browser URL bar (a launch blocker). Created
`public/.well-known/assetlinks.json` with the correct structure (verified served
at `200`). It contains two placeholders that **must** be filled before release —
see manual tasks below.

---

## 3. Items audited and found OK (no change needed)

- **Icons:** `icon-192.png`, `icon-512.png`, `icon-512-maskable.png`,
  `apple-touch-icon`, and `favicon.ico` all present and referenced correctly.
- **Notification permission handling:** push is **user-initiated** via the
  Settings toggle (`NotificationsToggle.tsx`) — there is no auto-prompt on load,
  which aligns with Play notification-UX policy. Permission-denied and
  unsupported states are handled gracefully. (On Android 13+, the TWA shell
  also requests the `POST_NOTIFICATIONS` runtime permission — Bubblewrap handles
  this.)
- **Auth redirects / OAuth:** the OAuth callback (`app/auth/callback/route.ts`)
  builds redirects from the request `origin`, and `GoogleButton` uses
  `window.location.origin` for `redirectTo` — both resolve to the real HTTPS
  origin inside a TWA, so no hardcoded localhost/preview URLs leak. The callback
  also rejects non-relative `next` values (open-redirect safe).
- **Deep links:** `start_url` and `scope` are in-origin; once assetlinks is
  verified, Android URL intents for the domain open in-app.
- **Type safety & lint:** `tsc --noEmit` passes clean. ESLint passes clean on
  all new/modified files. (Two pre-existing `set-state-in-effect` errors and one
  `no-img-element` warning remain in `ProfileModal.tsx` on lines untouched by
  this work — flagged here, not introduced here.)

---

## 4. Remaining manual tasks (cannot be automated)

1. **Fill `public/.well-known/assetlinks.json`** with the real values from your
   signed app:
   - `package_name` → your Android applicationId (e.g. `com.stations.app`).
   - `sha256_cert_fingerprints` → the SHA-256 of the **Play App Signing**
     certificate (Play Console → Setup → App integrity), and ideally also your
     upload key fingerprint. Bubblewrap can generate/auto-fill this; verify with
     Google's Statement List Tester after deploy.
2. **Set `NEXT_PUBLIC_APP_URL`** in the production environment (Vercel) to the
   canonical HTTPS origin, so `metadataBase` and Open Graph URLs resolve.
3. **Play Console listing assets** (not in-repo): provide at least 2 phone
   screenshots, a 512×512 hi-res icon, and a 1024×500 feature graphic. The PWA
   manifest could optionally also gain a `screenshots` array for richer install
   UI — out of scope here as the image assets don't yet exist.
4. **Data safety form:** in the Play Console, declare the data the Privacy
   Policy lists (name, email, profile image, username, user content, DMs,
   reactions, notification tokens), mark it encrypted in transit, and link the
   privacy policy URL (`https://<domain>/privacy`).
5. **Google OAuth consent screen:** add the privacy policy and terms URLs to the
   Google Cloud OAuth consent screen, and ensure the TWA opens Google sign-in in
   a Custom Tab (Bubblewrap default) — Google blocks OAuth inside embedded
   WebViews.
6. **Marketing-site signup (`landing pageeee` / `/bridge` flow):** accounts can
   also be created on the external marketing site, which then hands off to
   `/bridge`. That signup form lives in a separate project and should get the
   same Terms/Privacy consent checkbox for full coverage.
7. **Account deletion:** the policy documents email-based deletion via
   `lockedinshreyash@gmail.com`. Google now favors an in-app/self-serve deletion
   path — consider adding a "Delete account" action in Settings before or shortly
   after launch.

---

## 5. Play Store readiness status

**Code-side compliance: READY.** All legal pages, the signup consent gate,
settings links, footers, manifest, and metadata are implemented, type-safe,
lint-clean, and verified in the browser.

**Overall launch: BLOCKED on one item** — the `assetlinks.json` signing
fingerprint (task 1) must be filled for the TWA to verify its domain and drop
the URL bar. Everything else in section 4 is standard Play Console / external
configuration that does not require code changes.

**Contact for all legal/privacy matters:** lockedinshreyash@gmail.com
