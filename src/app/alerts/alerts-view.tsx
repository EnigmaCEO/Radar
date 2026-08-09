import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LocalDateTime } from "@/components/local-time";
import {
  ALERT_DEGRADED_DETAIL_PREFIX,
  ALERT_DEGRADED_HEADLINE,
  ALERT_DETAIL_UNAVAILABLE_DETAIL,
  ALERT_DETAIL_UNAVAILABLE_HEADLINE,
  ALERT_EMPTY_DETAIL_PREFIX,
  ALERT_EMPTY_HEADLINE,
  ALERT_UNAVAILABLE_DETAIL,
  ALERT_UNAVAILABLE_HEADLINE,
  type AlertCollectionResult,
} from "@/lib/alert-data-state";
import { isDisabledAlertStatus } from "@/lib/alert-status";
import type { PublicRadarAlert } from "@/lib/public-alerts";

export const PUBLIC_ALERTS_HEADING = "Public infrastructure record";

function severityVariant(severity: string): "critical" | "warning" | "watch" {
  if (severity === "critical") return "critical";
  if (severity === "warning") return "warning";
  return "watch";
}

function statusVariant(status: string): "resolved" | "closed" | "secondary" {
  if (status.toLowerCase() === "resolved") return "resolved";
  if (isDisabledAlertStatus(status)) return "closed";
  return "secondary";
}

function statusLabel(status: string): string {
  return isDisabledAlertStatus(status) ? "closed" : status;
}

function formatCacheAge(seconds: number | undefined): string | null {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) return null;
  if (seconds < 60) return `${Math.max(0, Math.round(seconds))}s old`;
  const minutes = Math.round(seconds / 60);
  return `${minutes}m old`;
}

/**
 * Status banner for the current data state.
 *
 * This is the only place the four states become words, and each one says
 * exactly what Radar knows. `unavailable` in particular never borrows
 * empty-state language: "no alerts" and "we cannot tell you" are different
 * claims and the page must not blur them.
 */
function AlertStateNotice({ result }: { result: AlertCollectionResult<PublicRadarAlert> }) {
  if (result.state === "available") {
    return (
      <p className="text-xs text-muted-foreground" data-alert-notice="available">
        Live from Radar&apos;s alert source. Checked{" "}
        <LocalDateTime value={result.fetchedAt} preset="detailed" />.
      </p>
    );
  }

  if (result.state === "empty") {
    return (
      <Card className="border-border/60" data-alert-notice="empty">
        <CardContent className="space-y-1 py-8 text-center">
          <p className="text-sm font-medium">{ALERT_EMPTY_HEADLINE}</p>
          <p className="text-sm text-muted-foreground">
            {ALERT_EMPTY_DETAIL_PREFIX}{" "}
            <LocalDateTime value={result.fetchedAt} preset="detailed" />.
          </p>
          <p className="text-xs text-muted-foreground">
            This reflects the current public-alert query only.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (result.state === "degraded") {
    const age = formatCacheAge(result.cacheAgeSeconds);
    return (
      <Card className="border-orange-500/40 bg-orange-500/5" data-alert-notice="degraded">
        <CardContent className="space-y-1 py-4">
          <p className="text-sm font-medium">{ALERT_DEGRADED_HEADLINE}</p>
          <p className="text-sm text-muted-foreground">
            {ALERT_DEGRADED_DETAIL_PREFIX}{" "}
            {result.lastSuccessfulAt ? (
              <LocalDateTime value={result.lastSuccessfulAt} preset="detailed" />
            ) : (
              "unknown"
            )}
            .
          </p>
          <p className="text-xs text-muted-foreground">
            Cached record{age ? ` · ${age}` : ""} · not live
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-red-500/40 bg-red-500/5" data-alert-notice="unavailable">
      <CardContent className="space-y-3 py-8 text-center">
        <div className="space-y-1">
          <p className="text-sm font-medium">{ALERT_UNAVAILABLE_HEADLINE}</p>
          <p className="text-sm text-muted-foreground">{ALERT_UNAVAILABLE_DETAIL}</p>
          <p className="text-xs text-muted-foreground">
            Last checked <LocalDateTime value={result.fetchedAt} preset="detailed" />.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          {/* A plain link re-issues the same read-only page request. */}
          <Link href="/alerts" prefetch={false}>
            Retry
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

/**
 * Detail-page banner shown when SCE could not confirm this alert's current
 * state. Distinct from Next's `notFound()`, which is reserved for a successful
 * lookup of an id that does not exist.
 */
export function AlertDetailUnavailableView({ fetchedAt }: { fetchedAt: string }) {
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 sm:px-6" data-alert-state="unavailable">
      <div role="status" aria-live="polite">
        <Card className="border-red-500/40 bg-red-500/5" data-alert-notice="unavailable">
          <CardHeader>
            <CardTitle className="text-base">{ALERT_DETAIL_UNAVAILABLE_HEADLINE}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{ALERT_DETAIL_UNAVAILABLE_DETAIL}</p>
            <p className="text-xs text-muted-foreground">
              Last checked <LocalDateTime value={fetchedAt} preset="detailed" />.
            </p>
            <Button variant="outline" size="sm" asChild>
              <Link href="/alerts" prefetch={false}>
                Back to the public record
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/** Stale banner rendered above a detail page served from last-confirmed data. */
export function AlertDetailDegradedNotice({
  lastSuccessfulAt,
  cacheAgeSeconds,
}: {
  lastSuccessfulAt?: string;
  cacheAgeSeconds?: number;
}) {
  const age = formatCacheAge(cacheAgeSeconds);
  return (
    <div role="status" aria-live="polite">
      <Card className="border-orange-500/40 bg-orange-500/5" data-alert-notice="degraded">
        <CardContent className="space-y-1 py-4">
          <p className="text-sm font-medium">{ALERT_DEGRADED_HEADLINE}</p>
          <p className="text-sm text-muted-foreground">
            {ALERT_DEGRADED_DETAIL_PREFIX}{" "}
            {lastSuccessfulAt ? (
              <LocalDateTime value={lastSuccessfulAt} preset="detailed" />
            ) : (
              "unknown"
            )}
            .
          </p>
          <p className="text-xs text-muted-foreground">
            Cached record{age ? ` · ${age}` : ""} · not live
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function AlertCard({ alert, stale }: { alert: PublicRadarAlert; stale: boolean }) {
  return (
    <Card className="border-border/60">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={severityVariant(alert.severity)}>{alert.severity}</Badge>
          <Badge variant="secondary">{alert.monitorType}</Badge>
          <Badge variant={statusVariant(alert.status)}>{statusLabel(alert.status)}</Badge>
          {stale && <Badge variant="secondary">cached</Badge>}
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
  );
}

/**
 * Public alert list, rendered from an explicit data state.
 *
 * `data-alert-state` is a stable contract for browser synthetics: the nightly
 * scan asserts on it rather than on HTTP 200, so an SCE outage cannot pass as a
 * healthy page.
 */
export function PublicAlertsView({
  result,
}: {
  result: AlertCollectionResult<PublicRadarAlert>;
}) {
  const stale = result.state === "degraded";

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 sm:px-6" data-alert-state={result.state}>
      <section className="space-y-3">
        <Badge variant="secondary">Public Record</Badge>
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">{PUBLIC_ALERTS_HEADING}</h1>
          <p className="max-w-3xl text-sm text-muted-foreground sm:text-base">
            Alerts from the last 24 hours across crypto infrastructure. Open any alert
            for its public-safe detail page and evidence-backed state changes.
          </p>
        </div>
      </section>

      <div role="status" aria-live="polite" className="space-y-3">
        <AlertStateNotice result={result} />
      </div>

      {result.alerts.length > 0 && (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {result.alerts.map((alert) => (
            <AlertCard key={alert.id} alert={alert} stale={stale} />
          ))}
        </section>
      )}
    </div>
  );
}
