import { notFound } from "next/navigation";
import Link from "next/link";
import { Footer } from "@/components/footer";
import { Nav } from "@/components/nav";
import {
  coverageGapBadgeLabel,
  getCoverageGapTier,
  isCoverageGapAlert,
} from "@/lib/alert-classification";
import { formatDurationBetween } from "@/lib/alert-time";
import { auth0 } from "@/lib/auth0";
import { buildMonitorCtaHref, toPublicRadarAlert } from "@/lib/public-alerts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LocalDateTime } from "@/components/local-time";
import { fetchSceAlertById } from "@/lib/sce-alerts";

export const dynamic = "force-dynamic";

function severityVariant(severity: string): "critical" | "warning" | "watch" {
  if (severity === "critical") return "critical";
  if (severity === "warning") return "warning";
  return "watch";
}

function statusLabel(status: string, isCoverageGap: boolean): string {
  if (isCoverageGap && status === "resolved") return "restored";
  return status;
}

function detailRows(alert: ReturnType<typeof toPublicRadarAlert>) {
  if (!alert) return [];
  return [
    ["Monitor type", alert.monitorType],
    ["Provider", alert.provider],
    ["Chain", alert.chain],
    ["Asset", alert.asset],
    ["Asset pair", alert.assetPair ?? null],
    ["Route", alert.route],
    ["Pool", alert.poolName ?? null],
    ["Threshold", alert.thresholdName ?? null],
    ["Observed value", alert.observedValueLabel ?? null],
    ["Threshold value", alert.thresholdValueLabel ?? null],
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

  const publicAlert = toPublicRadarAlert(alert);
  const session = await auth0.getSession();
  const rows = detailRows(publicAlert);
  const isCoverageGap = isCoverageGapAlert({
    signalClass: alert.signalClass,
    reasonCode: alert.reasonCode,
    summary: publicAlert.summary,
    openedAt: publicAlert.openedAt ?? undefined,
    createdAt: publicAlert.createdAt,
  });
  const coverageTier = getCoverageGapTier({
    signalClass: alert.signalClass,
    reasonCode: alert.reasonCode,
    summary: publicAlert.summary,
    openedAt: publicAlert.openedAt ?? undefined,
    createdAt: publicAlert.createdAt,
    coverageTier: publicAlert.coverageTier,
  });
  const monitorCtaHref = buildMonitorCtaHref(Boolean(session), alert.objectId ?? null);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Nav />
      <main className="flex-1 py-10">
        <div className="mx-auto max-w-4xl space-y-6 px-4 sm:px-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {isCoverageGap ? (
                <Badge variant="secondary">{coverageGapBadgeLabel(coverageTier)}</Badge>
              ) : (
                <Badge variant={severityVariant(alert.severity)}>{alert.severity}</Badge>
              )}
              <Badge variant="secondary">{statusLabel(alert.status, isCoverageGap)}</Badge>
              <Badge variant="secondary">{publicAlert.monitorType}</Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{publicAlert.id}</p>
              <h1 className="text-3xl font-bold tracking-tight">
                {publicAlert.summary}
              </h1>
            </div>
          </div>

          {isCoverageGap && (
            <Card className="border-border/60">
              <CardHeader>
              <CardTitle className="text-base">Coverage gap</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>Radar could not observe this object, so object state is currently unknown.</p>
                {publicAlert.failureCause && <p>Cause: {publicAlert.failureCause.replace(/_/g, " ")}</p>}
                {publicAlert.lastSuccessfulObservationAt && (
                  <p>
                    Last successful observation: <LocalDateTime value={publicAlert.lastSuccessfulObservationAt} preset="detailed" /> (
                    {formatDurationBetween(publicAlert.lastSuccessfulObservationAt)} ago)
                  </p>
                )}
                {publicAlert.consecutiveFailedCycles !== null &&
                  publicAlert.consecutiveFailedCycles !== undefined && (
                    <p>Consecutive failed cycles: {publicAlert.consecutiveFailedCycles}</p>
                  )}
                <p>
                  Open duration:{" "}
                  {formatDurationBetween(publicAlert.openedAt ?? publicAlert.createdAt, publicAlert.resolvedAt ?? new Date())}
                </p>
                <p>Object state: {publicAlert.objectState ?? "unknown"}</p>
              </CardContent>
            </Card>
          )}

          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-base">Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {alert.whatHappened && (
                <div>
                  <p className="text-sm font-medium">What happened</p>
                  <p className="text-sm text-muted-foreground">{publicAlert.whatHappened}</p>
                </div>
              )}
              {publicAlert.whyItMatters && (
                <div>
                  <p className="text-sm font-medium">Why it matters</p>
                  <p className="text-sm text-muted-foreground">{publicAlert.whyItMatters}</p>
                </div>
              )}
              {publicAlert.radarStatus && (
                <div>
                  <p className="text-sm font-medium">Status</p>
                  <p className="text-sm text-muted-foreground">{publicAlert.radarStatus}</p>
                </div>
              )}
              {publicAlert.nextWatch && (
                <div>
                  <p className="text-sm font-medium">Next watch</p>
                  <p className="text-sm text-muted-foreground">{publicAlert.nextWatch}</p>
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
                <p className="text-sm">
                  <LocalDateTime value={publicAlert.createdAt} preset="detailed" />
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Updated
                </p>
                <p className="text-sm">
                  <LocalDateTime value={publicAlert.updatedAt} preset="detailed" />
                </p>
              </div>
            </CardContent>
          </Card>

          {(publicAlert.severityExplanation ||
            publicAlert.thresholdExplanation ||
            publicAlert.evidenceExplanation ||
            publicAlert.evidenceSummary ||
            publicAlert.humanRiskSummary) && (
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-base">Evidence and context</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {publicAlert.severityExplanation && (
                  <div>
                    <p className="text-sm font-medium">Severity explanation</p>
                    <p className="text-sm text-muted-foreground">{publicAlert.severityExplanation}</p>
                  </div>
                )}
                {publicAlert.thresholdExplanation && (
                  <div>
                    <p className="text-sm font-medium">Threshold context</p>
                    <p className="text-sm text-muted-foreground">{publicAlert.thresholdExplanation}</p>
                  </div>
                )}
                {publicAlert.evidenceExplanation && (
                  <div>
                    <p className="text-sm font-medium">Evidence explanation</p>
                    <p className="text-sm text-muted-foreground">{publicAlert.evidenceExplanation}</p>
                  </div>
                )}
                {publicAlert.evidenceSummary && (
                  <div>
                    <p className="text-sm font-medium">Evidence summary</p>
                    <p className="text-sm text-muted-foreground">{publicAlert.evidenceSummary}</p>
                  </div>
                )}
                {publicAlert.humanRiskSummary && (
                  <div>
                    <p className="text-sm font-medium">Human risk summary</p>
                    <p className="text-sm text-muted-foreground">{publicAlert.humanRiskSummary}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card className="border-border/60 bg-muted/30">
            <CardHeader>
              <CardTitle className="text-base">Monitor this object with Radar</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Track this object privately and route evidence-backed alerts into your operating channels.
              </p>
              <Button asChild>
                <Link href={monitorCtaHref}>Monitor this object with Radar</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
