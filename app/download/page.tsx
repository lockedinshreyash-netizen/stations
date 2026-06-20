import DownloadScreen from "@/components/onboarding/DownloadScreen";

export const metadata = {
  title: "Get the App",
  description:
    "Install Stations on your phone — a full-screen, offline-ready home for India's most ambitious work. Free, no app store needed.",
  openGraph: {
    title: "Get the Stations app",
    description:
      "Install Stations on your phone — a full-screen, offline-ready home for India's most ambitious work.",
  },
};

export default function DownloadPage() {
  return <DownloadScreen />;
}
