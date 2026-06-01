import type { NextConfig } from "next";
// next-pwa 5.6.0 ships no type definitions
// @ts-expect-error — no types for next-pwa
import withPWAInit from "next-pwa";

const nextConfig: NextConfig = {
  /* config options here */
};

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
});

export default withPWA(nextConfig);
