import OfflineContent from "./OfflineContent";

// Thin static shell so the SW can precache /offline cheaply. The actual copy is
// localized client-side (OfflineContent) because the precached HTML body is
// frozen to whichever locale the prerender resolved to.
export const dynamic = "force-static";

export const metadata = {
  title: "Offline — NBA Tracker",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return <OfflineContent />;
}
