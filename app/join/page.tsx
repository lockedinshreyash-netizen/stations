import JoinFlow from "@/components/onboarding/JoinFlow";

export const metadata = {
  title: "Join Stations",
};

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string | string[] }>;
}) {
  // Founders arriving from the waitlist deep link (APP_URL/join?code=STN-…) —
  // carry the code straight through so it auto-applies at the plan step.
  const { code } = await searchParams;
  const initialCode = Array.isArray(code) ? code[0] : code;
  return <JoinFlow initialCode={initialCode} />;
}
