"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { listAlerts } from "@/lib/api";
import type { RadarAlert, RadarMonitorType, RadarSeverity, RadarStatus } from "@/lib/api-types";
import {
  coverageGapBadgeLabel,
  getCoverageGapTier,
  humanizeReasonCode,
  isCoverageGapAlert,
} from "@/lib/alert-classification";
import { formatThresholdValueWithRule, humanizeThresholdRule } from "@/lib/alert-threshold-display";
import { correlateAlerts, type CorrelatedAlertGroup, type CorrelatedAlertListItem } from "@/lib/alert-correlation";
import { groupCoverageGapAlerts, type CoverageGapGroup } from "@/lib/coverage-gap-grouping";
import { sortAlertsByUpdatedAt } from "@/lib/alert-feed";
import { formatAlertLifecycle, formatDurationBetween } from "@/lib/alert-time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LocalDateTime, LocalDateWindow } from "@/components/local-time";
import { Select } from "@/components/ui/select";

function firstString(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return null;
}

function SeverityBadge({ severity }: { severity: RadarSeverity }) {
  const variant =
    severity === "critical" ? "critical" : severity === "warning" ? "warning" : "watch";
  return <Badge variant={variant}>{severity}</Badge>;
}

function MonitorTypeBadge({ type }: { type: RadarMonitorType }) {
  return (
    <Badge variant="secondary" className="font-mono text-xs">
      {type}
    </Badge>
  );
}

function StatusBadge({ status }: { status: RadarStatus }) {
  const className =
    status === "resolved"
      ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
      : status === "superseded"
        ? "border border-slate-500/20 bg-slate-500/10 text-slate-300"
        : "border border-primary/20 bg-primary/10 text-primary";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${className}`}>{status}</span>
  );
}

function CoverageStatusBadge({ status }: { status: RadarStatus }) {
  const label = status === "resolved" ? "restored" : status === "superseded" ? "superseded" : "active";
  const className =
    status === "resolved"
      ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
      : status === "superseded"
        ? "border border-slate-500/20 bg-slate-500/10 text-slate-300"
        : "border border-primary/20 bg-primary/10 text-primary";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${className}`}>{label}</span>
  );
}

const FINDING_CARD_CLASSES: Record<RadarSeverity, string> = {
  critical:
    "border-l-4 border-l-red-500 bg-red-50/50 dark:bg-red-950/20 border-y-border/60 border-r-border/60",
  warning:
    "border-l-4 border-l-orange-500 bg-orange-50/40 dark:bg-orange-950/10 border-y-border/60 border-r-border/60",
  watch: "border-l-4 border-l-blue-500 border-y-border/60 border-r-border/60",
};

const COVERAGE_CARD_CLASSES = {
  unresolved: "border-l-4 border-l-slate-400 border-y-border/60 border-r-border/60 bg-slate-500/5",
  coverage_warning:
    "border-l-4 border-l-slate-300 border-y-border/60 border-r-border/60 bg-slate-400/10",
  coverage_critical:
    "border-l-4 border-l-zinc-100 border-y-border/60 border-r-border/60 bg-zinc-500/10",
} as const;

function FindingIcon({ severity }: { severity: RadarSeverity }) {
  return (
    <AlertTriangle
      className={`mt-0.5 h-4 w-4 shrink-0 ${
        severity === "critical"
          ? "text-red-500"
          : severity === "warning"
            ? "text-orange-500"
            : "text-blue-500"
      }`}
    />
  );
}

function CoverageGapBadge({ alert }: { alert: RadarAlert }) {
  const tier = getCoverageGapTier(alert);
  return (
    <span className="rounded-full border border-slate-500/30 bg-slate-500/10 px-2 py-0.5 text-xs text-slate-200">
      {coverageGapBadgeLabel(tier)}
    </span>
  );
}

function findingObjectLine(alert: RadarAlert): Array<string> {
  const parts: string[] = [];
  if (alert.oracle) parts.push(`Oracle: ${alert.oracle}`);
  if (alert.bridge) parts.push(`Bridge: ${alert.bridge}`);
  if (alert.poolName) parts.push(`Pool: ${alert.poolName}`);
  if (alert.assetPair) parts.push(`Asset pair: ${alert.assetPair}`);
  else if (alert.asset) parts.push(`Asset: ${alert.asset}`);
  if (alert.chain) parts.push(`Chain: ${alert.chain}`);
  return parts;
}

function objectName(alert: RadarAlert): string {
  if (alert.bridge || alert.route) {
    return [alert.bridge, alert.asset, alert.route].filter(Boolean).join(" ");
  }
  return (
    firstString(alert.route, alert.poolName, alert.assetPair, alert.asset, alert.summary) ??
    alert.summary
  );
}

function coverageLead(alert: RadarAlert): string {
  return (
    firstString(alert.whatHappened, alert.evidenceExplanation, alert.radarStatus) ??
    "Radar could not observe this object."
  );
}

function coverageCause(alert: RadarAlert): string {
  if (alert.failureCause) return humanizeReasonCode(alert.failureCause);
  const summary = alert.summary.toLowerCase();
  if (summary.includes("source unavailable")) return "status source unavailable";
  return humanizeReasonCode(alert.reasonCode);
}

function alertMetricLine(alert: RadarAlert): Array<string> {
  const parts: string[] = [];
  if (alert.observedValueLabel) parts.push(alert.observedValueLabel);
  const thresholdValueWithRule = formatThresholdValueWithRule({
    thresholdValueLabel: alert.thresholdValueLabel,
    thresholdName: alert.thresholdName,
    appliedThresholdKind: alert.appliedThresholdKind,
  });
  if (thresholdValueWithRule) parts.push(thresholdValueWithRule);
  return parts;
}

function humanizeContractState(value: string | undefined): string | null {
  if (!value) return null;
  return value.replace(/_/g, " ").trim();
}

function formatSecondsLabel(value: number | undefined): string | null {
  if (value === undefined || !Number.isFinite(value) || value < 0) return null;
  if (value < 60) return `${value}s`;
  const totalMinutes = Math.floor(value / 60);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);
  return parts.join(" ");
}

function verificationSummaryLine(alert: RadarAlert): Array<string> {
  const parts: string[] = [];
  const publicVerificationState = humanizeContractState(alert.publicVerificationState);
  const evidenceState = humanizeContractState(alert.evidenceState);
  const thresholdSourceLabel = alert.thresholdSourceLabel?.trim();

  if (publicVerificationState) parts.push(`Public verification: ${publicVerificationState}`);
  if (evidenceState) parts.push(`Evidence: ${evidenceState}`);
  if (thresholdSourceLabel) parts.push(`Threshold source: ${thresholdSourceLabel}`);

  return parts;
}

function thresholdContractLine(alert: RadarAlert): Array<string> {
  const parts: string[] = [];
  const declaredHeartbeat = formatSecondsLabel(alert.declaredHeartbeatSeconds);
  const appliedThreshold = formatSecondsLabel(alert.appliedThresholdSeconds);
  const appliedThresholdKind =
    humanizeThresholdRule(alert.appliedThresholdKind) ??
    humanizeContractState(alert.appliedThresholdKind);

  if (declaredHeartbeat) parts.push(`Declared heartbeat: ${declaredHeartbeat}`);
  if (appliedThreshold) {
    parts.push(
      appliedThresholdKind
        ? `${appliedThresholdKind}: ${appliedThreshold}`
        : `Applied threshold: ${appliedThreshold}`,
    );
  }

  return parts;
}

function GroupCard({ group }: { group: CorrelatedAlertGroup }) {
  const firstOpenedAt = group.alerts[0]?.openedAt ?? group.alerts[0]?.createdAt ?? group.openedAt;
  const lastOpenedAt =
    group.alerts[group.alerts.length - 1]?.openedAt ??
    group.alerts[group.alerts.length - 1]?.createdAt ??
    group.openedAt;
  const lifecycle =
    group.status === "resolved" && group.resolvedAt
      ? `resolved in ${formatAlertLifecycle({
          status: "resolved",
          createdAt: group.openedAt,
          openedAt: group.openedAt,
          resolvedAt: group.resolvedAt,
        }).replace(/^resolved in /, "")}`
      : `open for ${formatAlertLifecycle({
          status: "active",
          createdAt: group.openedAt,
          openedAt: group.openedAt,
        }).replace(/^open for /, "")}`;

  return (
    <Card className={FINDING_CARD_CLASSES[group.severity]}>
      <CardContent className="px-4 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <FindingIcon severity={group.severity} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium">{group.title}</p>
                <span className="text-xs text-muted-foreground">
                  {group.alertCount} alert{group.alertCount === 1 ? "" : "s"}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>{group.reasonCode}</span>
                {group.chain && <span>{group.chain}</span>}
                <span>{lifecycle}</span>
                <span>
                  <LocalDateWindow start={firstOpenedAt} end={lastOpenedAt} />
                </span>
              </div>
              <div className="mt-3 space-y-2">
                {group.alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="rounded-md border border-border/60 bg-background/50 px-3 py-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Link
                        href={`/alerts/${alert.id}`}
                        className="text-sm font-medium underline-offset-4 hover:underline"
                      >
                        {alert.poolName ?? alert.assetPair ?? alert.asset ?? alert.summary}
                      </Link>
                      <span className="text-xs text-muted-foreground">
                        {formatAlertLifecycle(alert)}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {findingObjectLine(alert).map((value) => (
                        <span key={value}>{value}</span>
                      ))}
                    </div>
                    {alertMetricLine(alert).length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {alertMetricLine(alert).map((value) => (
                          <span key={value}>{value}</span>
                        ))}
                      </div>
                    )}
                    {(verificationSummaryLine(alert).length > 0 ||
                      thresholdContractLine(alert).length > 0) && (
                      <div className="mt-1 space-y-1 text-xs text-muted-foreground">
                        {verificationSummaryLine(alert).length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {verificationSummaryLine(alert).map((value) => (
                              <span key={value}>{value}</span>
                            ))}
                          </div>
                        )}
                        {thresholdContractLine(alert).length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {thresholdContractLine(alert).map((value) => (
                              <span key={value}>{value}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <SeverityBadge severity={group.severity} />
            <MonitorTypeBadge type={group.monitorType} />
            <StatusBadge status={group.status} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FindingAlertCard({ alert }: { alert: RadarAlert }) {
  return (
    <Card className={FINDING_CARD_CLASSES[alert.severity]}>
      <CardContent className="px-4 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <FindingIcon severity={alert.severity} />
            <div className="min-w-0 flex-1">
              <Link
                href={`/alerts/${alert.id}`}
                className="text-sm font-medium underline-offset-4 hover:underline"
              >
                {alert.summary}
              </Link>
              <div className="mt-1 flex flex-wrap gap-2">
                {findingObjectLine(alert).map((value) => (
                  <span key={value} className="text-xs text-muted-foreground">
                    {value}
                  </span>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>
                  <LocalDateTime value={alert.openedAt ?? alert.createdAt} preset="compact" />
                </span>
                <span>{formatAlertLifecycle(alert)}</span>
                {alertMetricLine(alert).map((value) => (
                  <span key={value}>{value}</span>
                ))}
              </div>
              {(verificationSummaryLine(alert).length > 0 ||
                thresholdContractLine(alert).length > 0) && (
                <div className="mt-1 space-y-1 text-xs text-muted-foreground">
                  {verificationSummaryLine(alert).length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {verificationSummaryLine(alert).map((value) => (
                        <span key={value}>{value}</span>
                      ))}
                    </div>
                  )}
                  {thresholdContractLine(alert).length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {thresholdContractLine(alert).map((value) => (
                        <span key={value}>{value}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <SeverityBadge severity={alert.severity} />
            <MonitorTypeBadge type={alert.monitorType} />
            <StatusBadge status={alert.status} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CoverageGapCard({ alert }: { alert: RadarAlert }) {
  const tier = getCoverageGapTier(alert);
  const lastObserved = firstString(alert.lastSuccessfulObservationAt);
  const objectState = alert.objectState ?? "unknown";
  const restorationLine =
    alert.status === "resolved" && alert.resolvedAt
      ? `Observation restored after ${formatDurationBetween(alert.openedAt ?? alert.createdAt, alert.resolvedAt)}`
      : null;

  return (
    <Card className={COVERAGE_CARD_CLASSES[tier]}>
      <CardContent className="px-4 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium">Unresolved - {objectName(alert)}</p>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{coverageLead(alert)}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                {alert.bridge && <span>Bridge: {alert.bridge}</span>}
                {alert.asset && <span>Asset: {alert.asset}</span>}
                {alert.chain && <span>Chain: {alert.chain}</span>}
                {alert.route && <span>Route: {alert.route}</span>}
              </div>
              <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                <p>Cause: {coverageCause(alert)}</p>
                {lastObserved && (
                  <p>
                    Last successful observation: <LocalDateTime value={lastObserved} preset="compact" /> (
                    {formatDurationBetween(lastObserved)} ago)
                  </p>
                )}
                {alert.consecutiveFailedCycles !== undefined && (
                  <p>Consecutive failed cycles: {alert.consecutiveFailedCycles}</p>
                )}
                <p>Object state: {objectState}</p>
                {restorationLine ? (
                  <p>{restorationLine}</p>
                ) : (
                  <p>
                    Opened <LocalDateTime value={alert.openedAt ?? alert.createdAt} preset="compact" /> -{" "}
                    {formatAlertLifecycle(alert)}
                  </p>
                )}
                {alert.status === "resolved" && <p>Object state during gap: never observed.</p>}
              </div>
              <div className="mt-3">
                <Link
                  href={`/alerts/${alert.id}`}
                  className="text-xs text-foreground underline underline-offset-4"
                >
                  Open detail
                </Link>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <CoverageGapBadge alert={alert} />
            <MonitorTypeBadge type={alert.monitorType} />
            <CoverageStatusBadge status={alert.status} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CoverageGapGroupCard({ group }: { group: CoverageGapGroup }) {
  const representative = group.alerts[0];
  const tier = getCoverageGapTier({
    signalClass: representative?.signalClass,
    reasonCode: representative?.reasonCode ?? "",
    summary: representative?.summary ?? "",
    openedAt: group.openedAt,
    createdAt: group.openedAt,
    coverageTier: representative?.coverageTier,
  });
  const statusLabel =
    group.status === "resolved"
      ? `all restored within ${group.summary.replace(/^all restored within /, "")}`
      : group.summary;

  return (
    <Card className={COVERAGE_CARD_CLASSES[tier]}>
      <CardContent className="px-4 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium">{group.title}</p>
              </div>
              <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>
                  {group.routeCount} route{group.routeCount === 1 ? "" : "s"} unobservable
                </span>
                <span>
                  first opened <LocalDateTime value={group.openedAt} preset="compact" />
                </span>
                <span>{statusLabel}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                {group.routes.map((route) => (
                  <span key={route}>{route}</span>
                ))}
              </div>
              <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                <p>Cause: {group.cause}</p>
                <p>Object state: unknown during the blind window.</p>
              </div>
              <div className="mt-3 space-y-1">
                {group.alerts.map((alert) => (
                  <Link
                    key={alert.id}
                    href={`/alerts/${alert.id}`}
                    className="block text-xs text-foreground underline underline-offset-4"
                  >
                    {alert.route ?? alert.summary}
                  </Link>
                ))}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <span className="rounded-full border border-slate-500/30 bg-slate-500/10 px-2 py-0.5 text-xs text-slate-200">
              {coverageGapBadgeLabel(tier)}
            </span>
            <MonitorTypeBadge type={representative?.monitorType ?? "bridge"} />
            <CoverageStatusBadge status={group.status} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function splitRows(rows: CorrelatedAlertListItem[]) {
  const findings: CorrelatedAlertListItem[] = [];
  const coverageGaps: RadarAlert[] = [];

  for (const row of rows) {
    const sample = row.kind === "group" ? row.item.alerts[0] : row.item;
    if (sample && isCoverageGapAlert(sample)) {
      if (row.kind === "group") {
        coverageGaps.push(...row.item.alerts);
      } else {
        coverageGaps.push(row.item);
      }
    } else {
      findings.push(row);
    }
  }

  return { findings, coverageGaps };
}

function renderRow(row: CorrelatedAlertListItem) {
  if (row.kind === "group") return <GroupCard key={row.item.id} group={row.item} />;
  if (isCoverageGapAlert(row.item)) return <CoverageGapCard key={row.item.id} alert={row.item} />;
  return <FindingAlertCard key={row.item.id} alert={row.item} />;
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<RadarAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [severity, setSeverity] = useState<string>("");
  const [monitorType, setMonitorType] = useState<string>("");
  const [status, setStatus] = useState<string>("");

  async function load() {
    setLoading(true);
    try {
      const data = await listAlerts({
        status: status || undefined,
        severity: severity || undefined,
        monitorType: monitorType || undefined,
        limit: 100,
      });
      setAlerts(sortAlertsByUpdatedAt(data));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      try {
        const data = await listAlerts({
          status: status || undefined,
          severity: severity || undefined,
          monitorType: monitorType || undefined,
          limit: 100,
        });
        if (!cancelled) {
          setAlerts(sortAlertsByUpdatedAt(data));
        }
      } catch (error) {
        console.error(error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [severity, monitorType, status]);

  const rows = correlateAlerts(alerts);
  const { findings, coverageGaps } = splitRows(rows);
  const coverageGroups = groupCoverageGapAlerts(coverageGaps);

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Alerts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {findings.length} finding row{findings.length !== 1 ? "s" : ""}, {coverageGroups.length} coverage incident
            {coverageGroups.length !== 1 ? "s" : ""} from {alerts.length} alert
            {alerts.length !== 1 ? "s" : ""} matching filters
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`mr-2 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-40"
          aria-label="Status"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="resolved">Resolved</option>
          <option value="superseded">Superseded</option>
        </Select>

        <Select
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
          className="w-40"
          aria-label="Severity"
        >
          <option value="">All severities</option>
          <option value="critical">Critical</option>
          <option value="warning">Warning</option>
          <option value="watch">Watch</option>
        </Select>

        <Select
          value={monitorType}
          onChange={(e) => setMonitorType(e.target.value)}
          className="w-44"
          aria-label="Monitor type"
        >
          <option value="">All types</option>
          <option value="oracle">Oracle</option>
          <option value="bridge">Bridge</option>
          <option value="lp">LP</option>
          <option value="governance">Governance</option>
          <option value="dependency">Dependency</option>
          <option value="sce_heartbeat">SCE heartbeat</option>
        </Select>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : rows.length === 0 ? (
        <Card className="border-border/60">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No alerts match the current filters.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <section className="space-y-2">
            <div>
              <h2 className="font-semibold">Findings</h2>
              <p className="text-xs text-muted-foreground">
                Observed conditions on monitored objects.
              </p>
            </div>
            {findings.length === 0 ? (
              <Card className="border-border/60">
                <CardContent className="py-6 text-sm text-muted-foreground">
                  No finding rows match the current filters.
                </CardContent>
              </Card>
            ) : (
              findings.map(renderRow)
            )}
          </section>

          <section className="space-y-2">
            <div>
              <h2 className="font-semibold">Coverage gaps</h2>
              <p className="text-xs text-muted-foreground">
                Radar could not observe these objects, so object state is currently unknown.
              </p>
            </div>
            {coverageGroups.length === 0 ? (
              <Card className="border-border/60">
                <CardContent className="py-6 text-sm text-muted-foreground">
                  No active coverage gaps match the current filters.
                </CardContent>
              </Card>
            ) : (
              coverageGroups.map((group) => <CoverageGapGroupCard key={group.id} group={group} />)
            )}
          </section>
        </div>
      )}
    </div>
  );
}
