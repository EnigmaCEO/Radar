import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Footer } from "@/components/footer";
import { Nav } from "@/components/nav";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LocalDateTime } from "@/components/local-time";
import { fetchSceAlerts } from "@/lib/sce-alerts";
import { toPublicRadarAlert } from "@/lib/public-alerts";

export const dynamic = "force-dynamic";

function severityVariant(severity: string): "critical" | "warning" | "watch" {
  if (severity === "critical") return "critical";
  if (severity === "warning") return "warning";
  return "watch";
}

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export default async function PublicAlertsPage() {
  const cutoff = Date.now() - TWENTY_FOUR_HOURS_MS;
  const alerts = (await fetchSceAlerts({ limit: 200 }).catch(() => []))
    .map(toPublicRadarAlert)
    .filter((alert) => {
      const updated = new Date(alert.updatedAt).getTime();
      return Number.isFinite(updated) && updated >= cutoff;
    })
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Nav />
      <main className="flex-1 py-10">
        <div className="mx-auto max-w-5xl space-y-8 px-4 sm:px-6">
          <section className="space-y-3">
            <Badge variant="secondary">Public Record</Badge>
            <div className="space-y-2">
              <h1 className="text-4xl font-bold tracking-tight">Public infrastructure record</h1>
              <p className="max-w-3xl text-sm text-muted-foreground sm:text-base">
                Alerts from the last 24 hours across crypto infrastructure. Open any alert
                for its public-safe detail page and evidence-backed state changes.
              </p>
            </div>
          </section>

          {alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No public alerts in the last 24 hours.
            </p>
          ) : (
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {alerts.map((alert) => (
              <Card key={alert.id} className="border-border/60">
                <CardHeader className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={severityVariant(alert.severity)}>{alert.severity}</Badge>
                    <Badge variant="secondary">{alert.monitorType}</Badge>
                    <Badge variant="secondary">{alert.status}</Badge>
                  </div>
                  <CardTitle className="text-lg">{alert.summary}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-muted-foreground">
                  <div className="space-y-1">
                    <p>{alert.provider}</p>
                    <p>
                      {[alert.chain, alert.assetPair ?? alert.asset, alert.route ?? alert.poolName]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <p>
                      Updated <LocalDateTime value={alert.updatedAt} preset="detailed" />
                    </p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/alerts/${alert.id}`}>
                      Open public detail <ArrowRight className="ml-1 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </section>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
