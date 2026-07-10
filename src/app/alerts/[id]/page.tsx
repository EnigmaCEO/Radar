import { notFound } from "next/navigation";
import { Footer } from "@/components/footer";
import { Nav } from "@/components/nav";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchSceAlertById } from "@/lib/sce-alerts";

export const dynamic = "force-dynamic";

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date);
}

function severityVariant(severity: string): "critical" | "warning" | "watch" {
  if (severity === "critical") return "critical";
  if (severity === "warning") return "warning";
  return "watch";
}

function detailRows(alert: Awaited<ReturnType<typeof fetchSceAlertById>>) {
  if (!alert) return [];
  return [
    ["Monitor type", alert.monitorType],
    ["Provider", alert.provider],
    ["Chain", alert.chain],
    ["Asset", alert.asset],
    ["Asset pair", alert.assetPair ?? null],
    ["Route", alert.route],
    ["Pool", alert.poolName ?? null],
    ["Reason code", alert.reasonCode],
    ["Threshold", alert.thresholdName ?? null],
    ["Observed value", alert.observedValueLabel ?? null],
    ["Threshold value", alert.thresholdValueLabel ?? null],
    ["Purpose", alert.purpose],
    ["Object ID", alert.objectId],
  ].filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].trim().length > 0);
}

export default async function PublicAlertDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const alert = await fetchSceAlertById(id).catch(() => null);

  if (!alert) {
    notFound();
  }

  const rows = detailRows(alert);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Nav />
      <main className="flex-1 py-10">
        <div className="mx-auto max-w-4xl space-y-6 px-4 sm:px-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={severityVariant(alert.severity)}>{alert.severity}</Badge>
              <Badge variant="secondary">{alert.status}</Badge>
              <Badge variant="secondary">{alert.monitorType}</Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{alert.id}</p>
              <h1 className="text-3xl font-bold tracking-tight">
                {alert.publicSummary ?? alert.summary}
              </h1>
            </div>
          </div>

          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-base">Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {alert.whatHappened && (
                <div>
                  <p className="text-sm font-medium">What happened</p>
                  <p className="text-sm text-muted-foreground">{alert.whatHappened}</p>
                </div>
              )}
              {alert.whyItMatters && (
                <div>
                  <p className="text-sm font-medium">Why it matters</p>
                  <p className="text-sm text-muted-foreground">{alert.whyItMatters}</p>
                </div>
              )}
              {alert.radarStatus && (
                <div>
                  <p className="text-sm font-medium">Status</p>
                  <p className="text-sm text-muted-foreground">{alert.radarStatus}</p>
                </div>
              )}
              {alert.nextWatch && (
                <div>
                  <p className="text-sm font-medium">Next watch</p>
                  <p className="text-sm text-muted-foreground">{alert.nextWatch}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-base">Alert details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {rows.map(([label, value]) => (
                <div key={label} className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {label}
                  </p>
                  <p className="text-sm">{value}</p>
                </div>
              ))}
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Created
                </p>
                <p className="text-sm">{formatDateTime(alert.createdAt)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Updated
                </p>
                <p className="text-sm">{formatDateTime(alert.updatedAt)}</p>
              </div>
            </CardContent>
          </Card>

          {(alert.severityExplanation ||
            alert.thresholdExplanation ||
            alert.evidenceExplanation ||
            alert.evidenceSummary ||
            alert.humanRiskSummary) && (
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-base">Evidence and context</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {alert.severityExplanation && (
                  <div>
                    <p className="text-sm font-medium">Severity explanation</p>
                    <p className="text-sm text-muted-foreground">{alert.severityExplanation}</p>
                  </div>
                )}
                {alert.thresholdExplanation && (
                  <div>
                    <p className="text-sm font-medium">Threshold context</p>
                    <p className="text-sm text-muted-foreground">{alert.thresholdExplanation}</p>
                  </div>
                )}
                {alert.evidenceExplanation && (
                  <div>
                    <p className="text-sm font-medium">Evidence explanation</p>
                    <p className="text-sm text-muted-foreground">{alert.evidenceExplanation}</p>
                  </div>
                )}
                {alert.evidenceSummary && (
                  <div>
                    <p className="text-sm font-medium">Evidence summary</p>
                    <p className="text-sm text-muted-foreground">{alert.evidenceSummary}</p>
                  </div>
                )}
                {alert.humanRiskSummary && (
                  <div>
                    <p className="text-sm font-medium">Human risk summary</p>
                    <p className="text-sm text-muted-foreground">{alert.humanRiskSummary}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
