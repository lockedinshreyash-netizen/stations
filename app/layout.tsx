import type { Metadata, Viewport } from "next";
import { Poppins, Playfair_Display } from "next/font/google";
import "./globals.css";
import SplashScreen from "@/components/layout/SplashScreen";
import HapticsProvider from "@/components/layout/HapticsProvider";
import Celebration from "@/components/layout/Celebration";
import UserProfileModal from "@/components/layout/UserProfileModal";
import RevealFX from "@/components/layout/RevealFX";
import ServiceWorkerRegistrar from "@/components/layout/ServiceWorkerRegistrar";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "900"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  style: ["italic"],
});

// Canonical origin for absolute URLs (Open Graph, etc.). Set NEXT_PUBLIC_APP_URL
// in the deployment env; omitting metadataBase only affects absolute URL
// resolution, never rendering.
const appUrl = process.env.NEXT_PUBLIC_APP_URL;

export const metadata: Metadata = {
  ...(appUrl ? { metadataBase: new URL(appUrl) } : {}),
  title: {
    default: "Stations — For India's Most Ambitious",
    template: "%s · Stations",
  },
  description:
    "A premium digital institution for India's top 1% of ambitious young people.",
  applicationName: "Stations",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Stations",
  },
  formatDetection: { telephone: false },
  icons: {
    apple: "/icon-192.png",
    icon: "/icon-192.png",
  },
  openGraph: {
    type: "website",
    siteName: "Stations",
    title: "Stations — For India's Most Ambitious",
    description:
      "A premium digital institution for India's top 1% of ambitious young people.",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={`${poppins.variable} ${playfair.variable} h-full antialiased`}
    >
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <meta name="apple-mobile-web-app-title" content="Stations" />
        {/* Anti-flash: read theme from localStorage before first paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('stations-theme')||'dark';document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full bg-bg-primary text-text-primary font-poppins">
        {/* Atmosphere: light source + vignette behind, film grain above.
            Both fixed and non-interactive; tuned per theme in globals.css. */}
        <div className="st-atmosphere" aria-hidden="true" />
        <div className="st-grain" aria-hidden="true" />
        <ServiceWorkerRegistrar />
        <SplashScreen />
        <HapticsProvider />
        <Celebration />
        <RevealFX />
        <UserProfileModal />
        <div className="st-content">{children}</div>
      </body>
    </html>
  );
}
