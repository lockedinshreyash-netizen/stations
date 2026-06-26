import { NextRequest, NextResponse } from "next/server";

const ALLOWED = new Set(["/", "/maintenance", "/favicon.ico", "/robots.txt", "/sitemap.xml"]);

export function middleware(request: NextRequest) {
  if (process.env.MAINTENANCE_MODE !== "true") return NextResponse.next();

  const { pathname } = request.nextUrl;

  if (
    ALLOWED.has(pathname) ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/icon-") ||
    pathname.startsWith("/sw") ||
    pathname.startsWith("/workbox-") ||
    pathname.startsWith("/push-sw") ||
    pathname.match(/\.(?:png|svg|ico|webp|jpg|jpeg|js|css|json|txt|woff2?)$/)
  ) {
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL("/maintenance", request.url), 307);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
