import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const MAINTENANCE_ALLOWED = new Set(["/", "/maintenance", "/favicon.ico", "/robots.txt", "/sitemap.xml"]);

export async function proxy(request: NextRequest) {
  if (process.env.MAINTENANCE_MODE === "true") {
    const { pathname } = request.nextUrl;

    if (
      !MAINTENANCE_ALLOWED.has(pathname) &&
      !pathname.startsWith("/_next/") &&
      !pathname.startsWith("/icon-") &&
      !pathname.startsWith("/sw") &&
      !pathname.startsWith("/workbox-") &&
      !pathname.startsWith("/push-sw") &&
      !pathname.match(/\.(?:png|svg|ico|webp|jpg|jpeg|js|css|json|txt|woff2?)$/)
    ) {
      return NextResponse.redirect(new URL("/maintenance", request.url), 307);
    }
  }

  return await updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
