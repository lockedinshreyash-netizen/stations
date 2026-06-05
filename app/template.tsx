/**
 * A template re-mounts on every navigation (unlike layout, which persists),
 * so this wrapper replays its entrance animation on each page change — giving
 * every transition a deliberate, cinematic fade-and-rise.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="st-page-enter">{children}</div>;
}
