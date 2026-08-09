import { Footer } from "@/components/footer";
import { Nav } from "@/components/nav";
import { mapAlertCollection } from "@/lib/alert-data-state";
import { fetchSceAlertCollection } from "@/lib/sce-alerts";
import { toPublicRadarAlert } from "@/lib/public-alerts";
import { PublicAlertsView } from "./alerts-view";

export const dynamic = "force-dynamic";

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export default async function PublicAlertsPage() {
  // eslint-disable-next-line react-hooks/purity -- This server-rendered page intentionally filters to a request-time 24h window.
  const cutoff = Date.now() - TWENTY_FOUR_HOURS_MS;

  // The read is never caught into an empty array: an SCE failure arrives here as
  // an explicit `degraded` or `unavailable` state and stays that way through
  // rendering.
  const collection = await fetchSceAlertCollection({ limit: 200, surface: "public-alerts-page" });
  const result = mapAlertCollection(collection, (alerts) =>
    alerts
      .map(toPublicRadarAlert)
      .filter((alert) => {
        const updated = new Date(alert.updatedAt).getTime();
        return Number.isFinite(updated) && updated >= cutoff;
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Nav />
      <main className="flex-1 py-10">
        <PublicAlertsView result={result} />
      </main>
      <Footer />
    </div>
  );
}
