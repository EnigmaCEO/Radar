"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { listAlertPage } from "@/lib/api";
import type {
  RadarAlert,
  RadarAlertPage,
  RadarMonitorType,
  RadarSeverity,
  RadarStatus,
} from "@/lib/api-types";
import { useAccount } from "@/lib/account-context";
import { useRadarLedgerHistory } from "@/lib/radar-ledger-context";
import {
  coverageGapBadgeLabel,
  getCoverageGapTier,
  humanizeReasonCode,
  isCoverageGapAlert,
} from "@/lib/alert-classification";
import {
  coverageGapHeadlineLabel,
  coverageGapStatusLabel,
  isDisabledAlertStatus,
  isSupersededAlertStatus,
} from "@/lib/alert-status";
import { extractAlertEvidenceDetails } from "@/lib/alert-evidence-display";
import { formatThresholdValueWithRule, humanizeThresholdRule } from "@/lib/alert-threshold-display";
import { correlateAlerts, type CorrelatedAlertGroup, type CorrelatedAlertListItem } from "@/lib/alert-correlation";
import { groupCoverageGapAlerts, type CoverageGapGroup } from "@/lib/coverage-gap-grouping";
import { sortAlertsByUpdatedAt } from "@/lib/alert-feed";
import { formatAlertLifecycle, formatDurationBetween } from "@/lib/alert-time";
import { resolvePlan } from "@/lib/plan-limits";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LocalDateTime, LocalDateWindow } from "@/components/local-time";
import { Select } from "@/components/ui/select";

export const INTEL_AGGREGATE_HEADING = "Radar Intel: Aggregate History";
export const INTEL_AGGREGATE_SUBTITLE =
  "Aggregate view of Radar’s alert record by burden, duration, chain, provider, and signal type.";

export const AGGREGATE_WINDOW_OPTIONS = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
  { value: "all", label: "All" },
] as const;

export type AggregateWindow = (typeof AGGREGATE_WINDOW_OPTIONS)[number]["value"];

export const DEFAULT_AGGREGATE_WINDOW: AggregateWindow = "30d";

const DEFAULT_ALERT_PAGE: RadarAlertPage = {
  alerts: [],
  count: 0,
  pageCount: 0,
};

const AGGREGATE_WINDOW_MS: Record<Exclude<AggregateWindow, "all">, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  "90d": 90 * 24 * 60 * 60 * 1000,
};

function buildCurrentAlertRequestParams(options: {
  isIntelView: boolean;
  status: string;
  severity: string;
  monitorType: string;
  aggregateWindow: AggregateWindow;
}) {
  return {
    status: options.status || undefined,
    severity: options.severity || undefined,
    monitorType: options.monitorType || undefined,
    limit: options.isIntelView ? 5000 : 100,
    historyMode: options.isIntelView ? ("ledger" as const) : ("snapshot" as const),
    window: options.isIntelView ? options.aggregateWindow : undefined,
  };
}

function filterAlertsByDashboardControls(
  alerts: RadarAlert[],
  {
    status,
    severity,
    monitorType,
  }: {
    status: string;
    severity: string;
    monitorType: string;
  },
): RadarAlert[] {
  return alerts.filter((alert) => {
    if (status && alert.status !== status) return false;
    if (severity && alert.severity !== severity) return false;
    if (monitorType && alert.monitorType !== monitorType) return false;
    return true;
  });
}

interface IntelAggregateSummary {
  totalFindings: number;
  activeFindings: number;
  resolvedFindings: number;
  criticalFindings: number;
  coverageIncidents: number;
  medianResolutionTimeMs: number | null;
  medianResolutionTimeLabel: string;
}

interface IntelBurdenAggregateRow {
  label: string;
  totalUnits: number;
  activeUnits: number;
  resolvedUnits: number;
  criticalUnits: number;
  latestAt: string | null;
}

interface IntelBurdenAggregation {
  byObject: IntelBurdenAggregateRow[];
  byChain: IntelBurdenAggregateRow[];
  byProvider: IntelBurdenAggregateRow[];
  byType: IntelBurdenAggregateRow[];
}

type IntelBurdenTabKey = "object" | "chain" | "provider" | "type";

const INTEL_BURDEN_TABS: Array<{
  key: IntelBurdenTabKey;
  label: string;
  title: string;
  description: string;
}> = [
  {
    key: "object",
    label: "Objects",
    title: "Top objects by burden",
    description: "Correlated findings and coverage incidents carrying the most burden.",
  },
  {
    key: "chain",
    label: "Chains",
    title: "Top chains by burden",
    description: "Chain-level burden from findings and real coverage incidents.",
  },
  {
    key: "provider",
    label: "Providers",
    title: "Top providers by burden",
    description: "Findings and coverage incidents attributed to the reporting provider.",
  },
  {
    key: "type",
    label: "Signal types",
    title: "Top signal types by burden",
    description: "Customer-facing signal categories for the current aggregate history.",
  },
] as const;

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

const CLOSED_STATUS_CLASS = "border border-slate-500/20 bg-slate-500/10 text-slate-300";

function StatusBadge({ status }: { status: RadarStatus }) {
  const className =
    status === "resolved"
      ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
      : status === "superseded" || status === "disabled"
        ? CLOSED_STATUS_CLASS
        : "border border-primary/20 bg-primary/10 text-primary";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${className}`}>{status}</span>
  );
}

function CoverageStatusBadge({ status }: { status: RadarStatus }) {
  const label = coverageGapStatusLabel(status);
  const className =
    status === "resolved"
      ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
      : status === "superseded" || isDisabledAlertStatus(status)
        ? CLOSED_STATUS_CLASS
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

function mergedEvidenceDetails(alert: RadarAlert) {
  const parsed = extractAlertEvidenceDetails(alert.evidenceExplanation);
  return {
    thresholdSourceLabel: alert.thresholdSourceLabel?.trim() || parsed.thresholdSourceLabel,
    expectedHeartbeat:
      formatSecondsLabel(alert.declaredHeartbeatSeconds) ?? parsed.expectedHeartbeat,
    warningThreshold: parsed.warningThreshold,
    criticalThreshold: parsed.criticalThreshold,
    evidenceState:
      humanizeContractState(alert.evidenceState) ??
      humanizeContractState(parsed.evidenceState ?? undefined),
    publicVerificationState:
      humanizeContractState(alert.publicVerificationState) ??
      humanizeContractState(parsed.publicVerificationState ?? undefined),
  };
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
  const details = mergedEvidenceDetails(alert);
  const parts: string[] = [];

  if (details.publicVerificationState) {
    parts.push(`Public verification: ${details.publicVerificationState}`);
  }
  if (details.evidenceState) parts.push(`Evidence: ${details.evidenceState}`);
  if (details.thresholdSourceLabel) {
    parts.push(`Threshold source: ${details.thresholdSourceLabel}`);
  }

  return parts;
}

function thresholdContractLine(alert: RadarAlert): Array<string> {
  const details = mergedEvidenceDetails(alert);
  const parts: string[] = [];
  const declaredHeartbeat = details.expectedHeartbeat;
  const appliedThreshold = formatSecondsLabel(alert.appliedThresholdSeconds);
  const appliedThresholdKind =
    humanizeThresholdRule(alert.appliedThresholdKind) ??
    humanizeContractState(alert.appliedThresholdKind);
  const displayedRule =
    humanizeThresholdRule(alert.thresholdName) ??
    humanizeThresholdRule(alert.appliedThresholdKind) ??
    "";
  const displayedRuleLower = displayedRule.toLowerCase();

  if (declaredHeartbeat) parts.push(`Declared heartbeat: ${declaredHeartbeat}`);
  if (details.warningThreshold && !displayedRuleLower.includes("warning")) {
    parts.push(`Warning threshold: ${details.warningThreshold}`);
  }
  if (details.criticalThreshold && !displayedRuleLower.includes("critical")) {
    parts.push(`Critical threshold: ${details.criticalThreshold}`);
  }
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
  const lifecycle = formatAlertLifecycle({
    status: group.status,
    createdAt: group.openedAt,
    openedAt: group.openedAt,
    resolvedAt: group.resolvedAt,
  });

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
                    key={alert.dedupeKey}
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
                <p className="text-sm font-medium">
                  {coverageGapHeadlineLabel(alert.status)} - {objectName(alert)}
                </p>
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
                    key={alert.dedupeKey}
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
  if (isCoverageGapAlert(row.item)) return <CoverageGapCard key={row.item.dedupeKey} alert={row.item} />;
  return <FindingAlertCard key={row.item.dedupeKey} alert={row.item} />;
}

function toTimestamp(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function aggregateWindowAnchor(alert: RadarAlert): string {
  return alert.resolvedAt ?? alert.updatedAt ?? alert.openedAt ?? alert.createdAt;
}

function formatDurationMs(durationMs: number): string {
  let remainingMinutes = Math.floor(durationMs / 60000);
  const days = Math.floor(remainingMinutes / (24 * 60));
  remainingMinutes -= days * 24 * 60;
  const hours = Math.floor(remainingMinutes / 60);
  remainingMinutes -= hours * 60;
  const minutes = remainingMinutes;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);
  return parts.join(" ");
}

function resolutionDurationMs(openedAt: string, resolvedAt: string | undefined): number | null {
  if (!resolvedAt) return null;
  const openedTimestamp = toTimestamp(openedAt);
  const resolvedTimestamp = toTimestamp(resolvedAt);
  if (openedTimestamp === null || resolvedTimestamp === null || resolvedTimestamp <= openedTimestamp) {
    return null;
  }
  return resolvedTimestamp - openedTimestamp;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] ?? null;
  const lower = sorted[middle - 1];
  const upper = sorted[middle];
  if (lower === undefined || upper === undefined) return null;
  return Math.round((lower + upper) / 2);
}

export function filterRadarIntelAlertsByWindow(
  alerts: RadarAlert[],
  window: AggregateWindow,
  now = new Date(),
): RadarAlert[] {
  if (window === "all") return alerts;

  const cutoff = now.getTime() - AGGREGATE_WINDOW_MS[window];
  return alerts.filter((alert) => {
    const anchor = toTimestamp(aggregateWindowAnchor(alert));
    return anchor !== null && anchor >= cutoff;
  });
}

function rowStatus(row: CorrelatedAlertListItem): RadarStatus {
  return row.kind === "group" ? row.item.status : row.item.status;
}

function rowSeverity(row: CorrelatedAlertListItem): RadarSeverity {
  return row.kind === "group" ? row.item.severity : row.item.severity;
}

function rowOpenedAt(row: CorrelatedAlertListItem): string {
  return row.kind === "group" ? row.item.openedAt : row.item.openedAt ?? row.item.createdAt;
}

function rowResolvedAt(row: CorrelatedAlertListItem): string | undefined {
  return row.kind === "group" ? row.item.resolvedAt : row.item.resolvedAt;
}

export function summarizeRadarIntelAggregateHistory(
  alerts: RadarAlert[],
  window: AggregateWindow,
  now = new Date(),
): IntelAggregateSummary {
  const filteredAlerts = filterRadarIntelAlertsByWindow(alerts, window, now);
  const rows = correlateAlerts(filteredAlerts);
  const { findings, coverageGaps } = splitRows(rows);
  const coverageGroups = groupCoverageGapAlerts(coverageGaps);
  const resolvedDurations = findings
    .filter((row) => rowStatus(row) === "resolved")
    .map((row) => resolutionDurationMs(rowOpenedAt(row), rowResolvedAt(row)))
    .filter((value): value is number => value !== null);
  const medianResolutionTimeMs = median(resolvedDurations);

  return {
    totalFindings: findings.length,
    activeFindings: findings.filter((row) => rowStatus(row) === "active").length,
    resolvedFindings: findings.filter((row) => rowStatus(row) === "resolved").length,
    criticalFindings: findings.filter((row) => rowSeverity(row) === "critical").length,
    coverageIncidents: coverageGroups.length,
    medianResolutionTimeMs,
    medianResolutionTimeLabel:
      medianResolutionTimeMs === null
        ? "Not enough resolved data"
        : formatDurationMs(medianResolutionTimeMs),
  };
}

interface ChartSegment {
  key: string;
  label: string;
  value: number;
  /** Tailwind background class for the bar/dot fill. */
  fill: string;
}

const STATUS_SEGMENT_STYLE: Record<"active" | "resolved" | "closed", string> = {
  active: "bg-primary",
  resolved: "bg-emerald-500",
  closed: "bg-slate-500/60",
};

const SEVERITY_SEGMENT_STYLE: Record<RadarSeverity, string> = {
  critical: "bg-red-500",
  warning: "bg-orange-500",
  watch: "bg-blue-500",
};

/** Small colored dot + label used as the shared identity channel for a chart. */
function ChartLegend({
  segments,
  withValues = false,
}: {
  segments: ChartSegment[];
  withValues?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {segments.map((seg) => (
        <span key={seg.key} className="inline-flex items-center gap-1.5">
          <span className={`h-2 w-2 shrink-0 rounded-full ${seg.fill}`} aria-hidden />
          <span>{seg.label}</span>
          {withValues && (
            <span className="font-medium tabular-nums text-foreground">{seg.value}</span>
          )}
        </span>
      ))}
    </div>
  );
}

/** Horizontal part-to-whole bar. Segments are separated by a 2px surface gap. */
function StackedBar({
  segments,
  ariaLabel,
  heightClass = "h-2.5",
}: {
  segments: ChartSegment[];
  ariaLabel: string;
  heightClass?: string;
}) {
  const total = segments.reduce((sum, seg) => sum + seg.value, 0);
  const visible = segments.filter((seg) => seg.value > 0);
  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className={`flex w-full gap-0.5 overflow-hidden rounded-full bg-muted/60 ${heightClass}`}
    >
      {total > 0 &&
        visible.map((seg) => (
          <div
            key={seg.key}
            className={`h-full ${seg.fill}`}
            style={{ width: `${(seg.value / total) * 100}%` }}
          />
        ))}
    </div>
  );
}

/** A labeled stacked bar with its own legend — used for the composition summary. */
function CompositionBlock({
  title,
  segments,
}: {
  title: string;
  segments: ChartSegment[];
}) {
  const total = segments.reduce((sum, seg) => sum + seg.value, 0);
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-sm font-medium">{title}</p>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{total} total</span>
      </div>
      <StackedBar segments={segments} ariaLabel={title} />
      <ChartLegend segments={segments} withValues />
    </div>
  );
}

function statusMixSegments(rows: CorrelatedAlertListItem[]): ChartSegment[] {
  const active = rows.filter((row) => rowStatus(row) === "active").length;
  const resolved = rows.filter((row) => rowStatus(row) === "resolved").length;
  const closed = Math.max(0, rows.length - active - resolved);
  return [
    { key: "active", label: "Active", value: active, fill: STATUS_SEGMENT_STYLE.active },
    { key: "resolved", label: "Resolved", value: resolved, fill: STATUS_SEGMENT_STYLE.resolved },
    { key: "closed", label: "Closed", value: closed, fill: STATUS_SEGMENT_STYLE.closed },
  ];
}

function severityMixSegments(rows: CorrelatedAlertListItem[]): ChartSegment[] {
  const critical = rows.filter((row) => rowSeverity(row) === "critical").length;
  const warning = rows.filter((row) => rowSeverity(row) === "warning").length;
  const watch = rows.filter((row) => rowSeverity(row) === "watch").length;
  return [
    { key: "critical", label: "Critical", value: critical, fill: SEVERITY_SEGMENT_STYLE.critical },
    { key: "warning", label: "Warning", value: warning, fill: SEVERITY_SEGMENT_STYLE.warning },
    { key: "watch", label: "Watch", value: watch, fill: SEVERITY_SEGMENT_STYLE.watch },
  ];
}

/** Status split for a single burden row, expressed as bar segments. */
function burdenRowSegments(row: IntelBurdenAggregateRow): ChartSegment[] {
  const closed = Math.max(0, row.totalUnits - row.activeUnits - row.resolvedUnits);
  return [
    { key: "active", label: "Active", value: row.activeUnits, fill: STATUS_SEGMENT_STYLE.active },
    { key: "resolved", label: "Resolved", value: row.resolvedUnits, fill: STATUS_SEGMENT_STYLE.resolved },
    { key: "closed", label: "Closed", value: closed, fill: STATUS_SEGMENT_STYLE.closed },
  ];
}

/**
 * Ranked magnitude bar: length compares totals across rows, inner segments show the
 * status split. Left-aligned fill inside a full-width track.
 */
function BurdenBar({ row, maxTotal }: { row: IntelBurdenAggregateRow; maxTotal: number }) {
  const segments = burdenRowSegments(row).filter((seg) => seg.value > 0);
  const fillPct = maxTotal > 0 ? Math.max(4, (row.totalUnits / maxTotal) * 100) : 0;
  return (
    <div
      role="img"
      aria-label={`${row.label}: ${row.totalUnits} total, ${row.activeUnits} active, ${row.resolvedUnits} resolved`}
      className="h-2 w-full overflow-hidden rounded-full bg-muted/60"
    >
      <div className="flex h-full gap-0.5" style={{ width: `${fillPct}%` }}>
        {segments.map((seg) => (
          <div
            key={seg.key}
            className={`h-full ${seg.fill}`}
            style={{ width: `${(seg.value / row.totalUnits) * 100}%` }}
          />
        ))}
      </div>
    </div>
  );
}

/** Single-hue proportion bar for the ledger → findings → incidents funnel. */
function FunnelBar({
  label,
  value,
  maxValue,
  baseValue,
}: {
  label: string;
  value: number;
  maxValue: number;
  baseValue: number;
}) {
  const widthPct = maxValue > 0 ? Math.max(value > 0 ? 4 : 0, (value / maxValue) * 100) : 0;
  const share = baseValue > 0 ? (value / baseValue) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-4 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums text-foreground">
          <span className="font-semibold">{value.toLocaleString()}</span>
          <span className="ml-2 text-muted-foreground">{share.toFixed(share < 10 ? 1 : 0)}%</span>
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted/60">
        <div className="h-full rounded-full bg-primary" style={{ width: `${widthPct}%` }} />
      </div>
    </div>
  );
}

function AggregateBucketList({
  title,
  description,
  rows,
}: {
  title: string;
  description: string;
  rows: IntelBurdenAggregateRow[];
}) {
  const visibleRows = rows.slice(0, 8);
  const maxTotal = visibleRows.reduce((max, row) => Math.max(max, row.totalUnits), 0);
  const legendSegments: ChartSegment[] = [
    { key: "active", label: "Active", value: 0, fill: STATUS_SEGMENT_STYLE.active },
    { key: "resolved", label: "Resolved", value: 0, fill: STATUS_SEGMENT_STYLE.resolved },
    { key: "closed", label: "Closed", value: 0, fill: STATUS_SEGMENT_STYLE.closed },
  ];

  return (
    <Card className="border-border/60">
      <CardHeader className="space-y-2">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        {visibleRows.length > 0 && <ChartLegend segments={legendSegments} />}
      </CardHeader>
      <CardContent className="space-y-3">
        {visibleRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No matching aggregate rows.</p>
        ) : (
          visibleRows.map((row) => (
            <div
              key={row.label}
              className="rounded-md border border-border/60 bg-background/50 px-3 py-3"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{row.label}</p>
                  <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span>{row.totalUnits} total</span>
                    <span>{row.activeUnits} active</span>
                    <span>{row.resolvedUnits} resolved</span>
                    <span className={row.criticalUnits > 0 ? "text-red-500" : undefined}>
                      {row.criticalUnits} critical
                    </span>
                  </div>
                </div>
                {row.latestAt && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    <LocalDateTime value={row.latestAt} preset="compact" />
                  </span>
                )}
              </div>
              <div className="mt-3">
                <BurdenBar row={row} maxTotal={maxTotal} />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function topLabelByCount(values: Array<string | null | undefined>, fallback: string): string {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (typeof value !== "string") continue;
    const label = value.trim();
    if (!label) continue;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  const top = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  return top?.[0] ?? fallback;
}

function latestCoverageSeenAt(alerts: RadarAlert[]): string | null {
  const timestamps = alerts
    .map((alert) => alert.resolvedAt ?? alert.updatedAt ?? alert.openedAt ?? alert.createdAt)
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => Date.parse(b) - Date.parse(a));
  return timestamps[0] ?? null;
}

function SummaryMetricCard({
  title,
  value,
}: {
  title: string;
  value: string | number;
}) {
  const isLongValue = typeof value === "string" && value.length > 18;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={isLongValue ? "text-sm font-semibold leading-6" : "text-3xl font-bold"}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

function severityRank(severity: RadarSeverity): number {
  if (severity === "critical") return 0;
  if (severity === "warning") return 1;
  return 2;
}

function signalTypeBurdenLabel(reasonCode: string, monitorType: RadarMonitorType): string {
  const normalizedReason = reasonCode.trim().toUpperCase();
  if (normalizedReason === "LP_LIQUIDITY_DROP") return "LP liquidity drop";
  if (normalizedReason === "LP_POOL_IMBALANCE") return "LP imbalance";
  if (normalizedReason === "ORACLE_REFERENCE_DEVIATION") return "Oracle reference deviation";
  if (normalizedReason === "ORACLE_STALE") return "Oracle freshness";
  if (
    normalizedReason === "BRIDGE_ROUTE_LATENCY" ||
    normalizedReason === "BRIDGE_ROUTE_DELAYED"
  ) {
    return "Bridge latency";
  }
  if (monitorType === "lp") return "LP";
  if (monitorType === "oracle") return "Oracle";
  if (monitorType === "bridge") return "Bridge";
  return humanizeReasonCode(reasonCode);
}

function findingRepresentativeAlert(row: CorrelatedAlertListItem): RadarAlert {
  return row.kind === "group" ? row.item.alerts[0] : row.item;
}

function burdenLabelForFinding(row: CorrelatedAlertListItem): string {
  if (row.kind === "group") return row.item.title;
  return objectName(row.item);
}

function chainLabelForFinding(row: CorrelatedAlertListItem): string | null {
  const representative = findingRepresentativeAlert(row);
  return row.kind === "group"
    ? row.item.chain ?? representative.chain ?? null
    : representative.chain ?? null;
}

function latestAtForFinding(row: CorrelatedAlertListItem): string | null {
  if (row.kind === "group") {
    return row.item.resolvedAt ?? row.item.updatedAt ?? row.item.openedAt;
  }
  return row.item.resolvedAt ?? row.item.updatedAt ?? row.item.openedAt ?? row.item.createdAt;
}

function severityForCoverageGroup(group: CoverageGapGroup): RadarSeverity {
  return [...group.alerts].sort((a, b) => severityRank(a.severity) - severityRank(b.severity))[0]
    ?.severity ?? "warning";
}

function latestAtForCoverageGroup(group: CoverageGapGroup): string | null {
  return (
    [...group.alerts]
      .map((alert) => alert.resolvedAt ?? alert.updatedAt ?? alert.openedAt ?? alert.createdAt)
      .filter((value): value is string => Boolean(value))
      .sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null
  );
}

function chainLabelForCoverageGroup(group: CoverageGapGroup): string | null {
  return topLabelByCount(group.alerts.map((alert) => alert.chain), "Unspecified chain");
}

function providerBurdenLabel(source: string | null | undefined): string {
  const trimmed = source?.trim();
  if (!trimmed) return "Unknown provider";
  // Keep already-branded casing (e.g. LayerZero); title-case snake/lower values.
  if (/[A-Z]/.test(trimmed)) return trimmed;
  return trimmed.replace(/[_-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function providerLabelForFinding(row: CorrelatedAlertListItem): string {
  return providerBurdenLabel(findingRepresentativeAlert(row).source);
}

function providerLabelForCoverageGroup(group: CoverageGapGroup): string {
  return providerBurdenLabel(
    group.source || topLabelByCount(group.alerts.map((alert) => alert.source), "Unknown provider"),
  );
}

function buildBurdenAggregateRows(
  units: Array<{
    label: string | null;
    status: RadarStatus;
    severity: RadarSeverity;
    latestAt: string | null;
  }>,
): IntelBurdenAggregateRow[] {
  const grouped = new Map<string, typeof units>();

  for (const unit of units) {
    const label = unit.label?.trim();
    if (!label) continue;
    grouped.set(label, [...(grouped.get(label) ?? []), unit]);
  }

  return [...grouped.entries()]
    .map(([label, bucket]) => ({
      label,
      totalUnits: bucket.length,
      activeUnits: bucket.filter((unit) => unit.status === "active").length,
      resolvedUnits: bucket.filter((unit) => unit.status === "resolved").length,
      criticalUnits: bucket.filter((unit) => unit.severity === "critical").length,
      latestAt:
        bucket
          .map((unit) => unit.latestAt)
          .filter((value): value is string => Boolean(value))
          .sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null,
    }))
    .sort((a, b) => {
      if (a.activeUnits !== b.activeUnits) return b.activeUnits - a.activeUnits;
      if (a.totalUnits !== b.totalUnits) return b.totalUnits - a.totalUnits;
      const latestA = a.latestAt ? Date.parse(a.latestAt) : 0;
      const latestB = b.latestAt ? Date.parse(b.latestAt) : 0;
      if (latestA !== latestB) return latestB - latestA;
      return a.label.localeCompare(b.label);
    });
}

export function buildIntelBurdenAggregation(
  findings: CorrelatedAlertListItem[],
  coverageGroups: CoverageGapGroup[],
): IntelBurdenAggregation {
  return {
    byObject: buildBurdenAggregateRows([
      ...findings.map((row) => ({
        label: burdenLabelForFinding(row),
        status: rowStatus(row),
        severity: rowSeverity(row),
        latestAt: latestAtForFinding(row),
      })),
      ...coverageGroups.map((group) => ({
        label: group.title,
        status: group.status,
        severity: severityForCoverageGroup(group),
        latestAt: latestAtForCoverageGroup(group),
      })),
    ]),
    byChain: buildBurdenAggregateRows([
      ...findings.map((row) => ({
        label: chainLabelForFinding(row) ?? "Unspecified chain",
        status: rowStatus(row),
        severity: rowSeverity(row),
        latestAt: latestAtForFinding(row),
      })),
      ...coverageGroups.map((group) => ({
        label: chainLabelForCoverageGroup(group),
        status: group.status,
        severity: severityForCoverageGroup(group),
        latestAt: latestAtForCoverageGroup(group),
      })),
    ]),
    byProvider: buildBurdenAggregateRows([
      ...findings.map((row) => ({
        label: providerLabelForFinding(row),
        status: rowStatus(row),
        severity: rowSeverity(row),
        latestAt: latestAtForFinding(row),
      })),
      ...coverageGroups.map((group) => ({
        label: providerLabelForCoverageGroup(group),
        status: group.status,
        severity: severityForCoverageGroup(group),
        latestAt: latestAtForCoverageGroup(group),
      })),
    ]),
    byType: buildBurdenAggregateRows([
      ...findings.map((row) => {
        const representative = findingRepresentativeAlert(row);
        return {
          label: signalTypeBurdenLabel(representative.reasonCode, representative.monitorType),
          status: rowStatus(row),
          severity: rowSeverity(row),
          latestAt: latestAtForFinding(row),
        };
      }),
      ...coverageGroups.map((group) => ({
        label: "Coverage incident",
        status: group.status,
        severity: severityForCoverageGroup(group),
        latestAt: latestAtForCoverageGroup(group),
      })),
    ]),
  };
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

type IntelTimelineGranularity = "hour" | "day";

export interface IntelTimelineBucket {
  key: string;
  label: string;
  watch: number;
  warning: number;
  critical: number;
  coverage: number;
  total: number;
}

export interface IntelFindingsTimeline {
  granularity: IntelTimelineGranularity;
  buckets: IntelTimelineBucket[];
  maxTotal: number;
}

const TIMELINE_SERIES: Array<{
  key: "critical" | "warning" | "watch" | "coverage";
  label: string;
  fill: string;
}> = [
  { key: "critical", label: "Critical", fill: SEVERITY_SEGMENT_STYLE.critical },
  { key: "warning", label: "Warning", fill: SEVERITY_SEGMENT_STYLE.warning },
  { key: "watch", label: "Watch", fill: SEVERITY_SEGMENT_STYLE.watch },
  { key: "coverage", label: "Coverage", fill: "bg-slate-500/70" },
];

function timelineConfigForWindow(window: AggregateWindow): {
  granularity: IntelTimelineGranularity;
  bucketCount: number;
} {
  if (window === "24h") return { granularity: "hour", bucketCount: 24 };
  if (window === "7d") return { granularity: "day", bucketCount: 7 };
  if (window === "30d") return { granularity: "day", bucketCount: 30 };
  // 90d and "all" cap at a 90-day daily view so the column chart stays readable.
  return { granularity: "day", bucketCount: 90 };
}

function timelineBucketKey(timestamp: number, granularity: IntelTimelineGranularity): string {
  // Hour buckets: YYYY-MM-DDTHH (UTC). Day buckets: YYYY-MM-DD (UTC).
  return new Date(timestamp).toISOString().slice(0, granularity === "hour" ? 13 : 10);
}

function timelineBucketLabel(timestamp: number, granularity: IntelTimelineGranularity): string {
  const date = new Date(timestamp);
  if (granularity === "hour") {
    return date.toLocaleTimeString("en-US", { hour: "numeric", hour12: true, timeZone: "UTC" });
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function buildIntelFindingsTimeline(
  findings: CorrelatedAlertListItem[],
  coverageGroups: CoverageGapGroup[],
  window: AggregateWindow,
  now = new Date(),
): IntelFindingsTimeline {
  const { granularity, bucketCount } = timelineConfigForWindow(window);
  const stepMs = granularity === "hour" ? HOUR_MS : DAY_MS;
  const anchor =
    granularity === "hour"
      ? Math.floor(now.getTime() / HOUR_MS) * HOUR_MS
      : Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  const buckets: IntelTimelineBucket[] = [];
  const byKey = new Map<string, IntelTimelineBucket>();
  for (let offset = bucketCount - 1; offset >= 0; offset -= 1) {
    const timestamp = anchor - offset * stepMs;
    const bucket: IntelTimelineBucket = {
      key: timelineBucketKey(timestamp, granularity),
      label: timelineBucketLabel(timestamp, granularity),
      watch: 0,
      warning: 0,
      critical: 0,
      coverage: 0,
      total: 0,
    };
    buckets.push(bucket);
    byKey.set(bucket.key, bucket);
  }

  for (const row of findings) {
    const openedAt = toTimestamp(rowOpenedAt(row));
    if (openedAt === null) continue;
    const bucket = byKey.get(timelineBucketKey(openedAt, granularity));
    if (!bucket) continue;
    const severity = rowSeverity(row);
    if (severity === "critical") bucket.critical += 1;
    else if (severity === "warning") bucket.warning += 1;
    else bucket.watch += 1;
    bucket.total += 1;
  }

  for (const group of coverageGroups) {
    const openedAt = toTimestamp(group.openedAt);
    if (openedAt === null) continue;
    const bucket = byKey.get(timelineBucketKey(openedAt, granularity));
    if (!bucket) continue;
    bucket.coverage += 1;
    bucket.total += 1;
  }

  const maxTotal = buckets.reduce((max, bucket) => Math.max(max, bucket.total), 0);
  return { granularity, buckets, maxTotal };
}

export interface IntelDurationBucket {
  key: string;
  label: string;
  count: number;
}

export interface IntelResolutionDistribution {
  buckets: IntelDurationBucket[];
  resolvedCount: number;
  ongoingCount: number;
  reconciledCount: number;
  maxCount: number;
}

const DURATION_BUCKETS: Array<{ key: string; label: string; maxMs: number }> = [
  { key: "lt5m", label: "< 5m", maxMs: 5 * 60 * 1000 },
  { key: "5-30m", label: "5–30m", maxMs: 30 * 60 * 1000 },
  { key: "30m-2h", label: "30m–2h", maxMs: 2 * HOUR_MS },
  { key: "2-12h", label: "2–12h", maxMs: 12 * HOUR_MS },
  { key: "12-24h", label: "12–24h", maxMs: 24 * HOUR_MS },
  { key: "gt24h", label: "> 24h", maxMs: Number.POSITIVE_INFINITY },
];

/**
 * A finding whose closure was a doctrine reconciliation (superseded / quarantined) rather
 * than a real recovery — its open→close span is reconciliation lag, not incident duration,
 * so it is excluded from the duration histogram.
 */
function isReconciledFinding(row: CorrelatedAlertListItem): boolean {
  if (isSupersededAlertStatus(rowStatus(row))) return true;
  const representative = findingRepresentativeAlert(row);
  const text = `${representative.summary} ${representative.radarStatus ?? ""}`.toLowerCase();
  return text.includes("superseded") || text.includes("quarantined");
}

export function buildIntelResolutionDistribution(
  findings: CorrelatedAlertListItem[],
): IntelResolutionDistribution {
  const buckets: IntelDurationBucket[] = DURATION_BUCKETS.map((bucket) => ({
    key: bucket.key,
    label: bucket.label,
    count: 0,
  }));
  let resolvedCount = 0;
  let ongoingCount = 0;
  let reconciledCount = 0;

  for (const row of findings) {
    if (isReconciledFinding(row)) {
      reconciledCount += 1;
      continue;
    }
    if (rowStatus(row) !== "resolved") {
      ongoingCount += 1;
      continue;
    }
    const durationMs = resolutionDurationMs(rowOpenedAt(row), rowResolvedAt(row));
    if (durationMs === null) continue;
    resolvedCount += 1;
    const index = DURATION_BUCKETS.findIndex((bucket) => durationMs < bucket.maxMs);
    const target = buckets[index === -1 ? buckets.length - 1 : index];
    target.count += 1;
  }

  const maxCount = buckets.reduce((max, bucket) => Math.max(max, bucket.count), 0);
  return { buckets, resolvedCount, ongoingCount, reconciledCount, maxCount };
}

type IntelEvidenceTierKey =
  | "verified_public"
  | "config_verified"
  | "pending"
  | "quarantined"
  | "diagnostic";

export interface IntelEvidenceTier {
  key: IntelEvidenceTierKey;
  label: string;
  count: number;
}

export interface IntelEvidenceQuality {
  tiers: IntelEvidenceTier[];
  total: number;
  maxCount: number;
}

// Ordered most-trusted → least; drives bar order in the chart.
const EVIDENCE_TIERS: Array<{ key: IntelEvidenceTierKey; label: string }> = [
  { key: "verified_public", label: "Verified (public)" },
  { key: "config_verified", label: "Config-verified" },
  { key: "pending", label: "Pending verification" },
  { key: "quarantined", label: "Quarantined" },
  { key: "diagnostic", label: "Diagnostic" },
];

/** Classify a single finding's trust tier from its verification/evidence signals. */
function evidenceTierForFinding(row: CorrelatedAlertListItem): IntelEvidenceTierKey {
  const representative = findingRepresentativeAlert(row);
  const lifecycleText = `${representative.summary} ${representative.radarStatus ?? ""}`.toLowerCase();
  if (lifecycleText.includes("quarantined")) return "quarantined";
  if (representative.signalClass === "diagnostic" || isCoverageGapAlert(representative)) {
    return "diagnostic";
  }

  const details = mergedEvidenceDetails(representative);
  const publicState = (details.publicVerificationState ?? "").toLowerCase();
  const evidenceState = (details.evidenceState ?? "").toLowerCase();
  const explanation = (representative.evidenceExplanation ?? "").toLowerCase();

  if (
    (publicState.includes("verified") && publicState.includes("public")) ||
    (evidenceState.includes("complete") && evidenceState.includes("observed"))
  ) {
    return "verified_public";
  }
  // Calibration-backed thresholds (LP baselines) are config-verified, not public-verified.
  if (explanation.includes("baseline_configured")) return "config_verified";
  return "pending";
}

export function buildIntelEvidenceQuality(
  findings: CorrelatedAlertListItem[],
  coverageGroups: CoverageGapGroup[],
): IntelEvidenceQuality {
  const counts = new Map<IntelEvidenceTierKey, number>(
    EVIDENCE_TIERS.map((tier) => [tier.key, 0]),
  );

  for (const row of findings) {
    const key = evidenceTierForFinding(row);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  // Coverage incidents are unobservable states, not verified market conditions.
  counts.set("diagnostic", (counts.get("diagnostic") ?? 0) + coverageGroups.length);

  const tiers = EVIDENCE_TIERS.map((tier) => ({
    key: tier.key,
    label: tier.label,
    count: counts.get(tier.key) ?? 0,
  }));
  const total = tiers.reduce((sum, tier) => sum + tier.count, 0);
  const maxCount = tiers.reduce((max, tier) => Math.max(max, tier.count), 0);
  return { tiers, total, maxCount };
}

/** Single-hue magnitude bar with a label and value — used for categorical/ordered rankings. */
function MagnitudeBarRow({
  label,
  value,
  maxValue,
  emphasizeLabel = false,
}: {
  label: string;
  value: number;
  maxValue: number;
  emphasizeLabel?: boolean;
}) {
  const widthPct = maxValue > 0 ? Math.max(value > 0 ? 3 : 0, (value / maxValue) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className={`min-w-0 truncate ${emphasizeLabel ? "font-medium" : ""}`}>{label}</span>
        <span className="shrink-0 tabular-nums text-muted-foreground">{value}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted/60">
        <div className="h-full rounded-full bg-primary" style={{ width: `${widthPct}%` }} />
      </div>
    </div>
  );
}

// Validated categorical hues (dataviz palette, light + dark steps) exposed as CSS
// variables so the donut and its legend swap together on theme change. Slot 6 is the
// muted "Other" fold. See scripts/validate_palette.js — passes both modes; the light
// contrast WARN is covered by the always-present legend + % labels (relief rule).
const CATEGORY_DONUT_VARS =
  "[--cat-1:#2a78d6] [--cat-2:#008300] [--cat-3:#e87ba4] [--cat-4:#eda100] [--cat-5:#1baf7a] [--cat-6:#a3a29b] " +
  "dark:[--cat-1:#3987e5] dark:[--cat-2:#008300] dark:[--cat-3:#d55181] dark:[--cat-4:#c98500] dark:[--cat-5:#199e70] dark:[--cat-6:#6b6a64]";

interface DonutSegment {
  label: string;
  value: number;
  cssVar: string;
}

export function categoryDonutSegments(rows: IntelBurdenAggregateRow[]): DonutSegment[] {
  const sorted = [...rows].sort((a, b) => b.totalUnits - a.totalUnits);
  const top = sorted.slice(0, 5).filter((row) => row.totalUnits > 0);
  const otherTotal = sorted.slice(5).reduce((sum, row) => sum + row.totalUnits, 0);
  const segments: DonutSegment[] = top.map((row, index) => ({
    label: row.label,
    value: row.totalUnits,
    cssVar: `--cat-${index + 1}`,
  }));
  if (otherTotal > 0) segments.push({ label: "Other", value: otherTotal, cssVar: "--cat-6" });
  return segments;
}

/** Chart 1 — which signal categories dominated the window (part-to-whole donut). */
function CategoryMixChart({ rows }: { rows: IntelBurdenAggregateRow[] }) {
  const segments = categoryDonutSegments(rows);
  const total = segments.reduce((sum, seg) => sum + seg.value, 0);

  // Donut geometry: stroke-based ring, 2px surface gap between arcs.
  const radius = 35;
  const circumference = 2 * Math.PI * radius;
  const gap = total > 1 ? 2 : 0;
  const donutArcs = segments.reduce<{
    circles: ReactNode[];
    offset: number;
  }>(
    (state, seg) => {
      const arc = total > 0 ? (seg.value / total) * circumference : 0;
      const dash = Math.max(0.001, arc - gap);
      return {
        offset: state.offset + arc,
        circles: [
          ...state.circles,
          <circle
            key={seg.label}
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={`var(${seg.cssVar})`}
            strokeWidth="16"
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeDashoffset={-state.offset}
          />,
        ],
      };
    },
    { circles: [], offset: 0 },
  ).circles;

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="text-base">Signal mix by category</CardTitle>
        <p className="text-xs text-muted-foreground">
          What kind of conditions dominated this window — share of total findings and coverage
          incidents.
        </p>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="text-sm text-muted-foreground">No categorized findings in this window.</p>
        ) : (
          <div className={`flex flex-col items-center gap-6 sm:flex-row ${CATEGORY_DONUT_VARS}`}>
            <div className="relative h-40 w-40 shrink-0">
              <svg
                viewBox="0 0 100 100"
                className="h-full w-full"
                role="img"
                aria-label={`Signal mix: ${segments
                  .map((seg) => `${seg.label} ${seg.value}`)
                  .join(", ")}`}
              >
                <g transform="rotate(-90 50 50)">
                  {donutArcs}
                </g>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold tabular-nums">{total}</span>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  findings
                </span>
              </div>
            </div>
            <ul className="w-full flex-1 space-y-2">
              {segments.map((seg) => {
                const pct = Math.round((seg.value / total) * 100);
                return (
                  <li key={seg.label} className="flex items-center gap-2 text-sm">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                      style={{ backgroundColor: `var(${seg.cssVar})` }}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate">{seg.label}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {seg.value} · {pct}%
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Chart 2 — findings opened over time, stacked by severity plus coverage incidents. */
function FindingsTimelineChart({ timeline }: { timeline: IntelFindingsTimeline }) {
  const { buckets, maxTotal, granularity } = timeline;
  const legendSegments: ChartSegment[] = TIMELINE_SERIES.map((series) => ({
    key: series.key,
    label: series.label,
    value: 0,
    fill: series.fill,
  }));
  const labelEvery = Math.max(1, Math.ceil(buckets.length / 8));

  return (
    <Card className="border-border/60">
      <CardHeader className="space-y-2">
        <div>
          <CardTitle className="text-base">Findings over time</CardTitle>
          <p className="text-xs text-muted-foreground">
            Was this window calm, noisy, or clustered? Findings are bucketed by{" "}
            {granularity === "hour" ? "hour" : "day"} of first observation.
          </p>
        </div>
        <ChartLegend segments={legendSegments} />
      </CardHeader>
      <CardContent className="space-y-2">
        {maxTotal === 0 ? (
          <p className="text-sm text-muted-foreground">No findings were opened in this window.</p>
        ) : (
          <>
            <div className="flex h-40 items-end gap-0.5" role="img" aria-label="Findings opened over time">
              {buckets.map((bucket) => {
                const heightPct = maxTotal > 0 ? (bucket.total / maxTotal) * 100 : 0;
                return (
                  <div
                    key={bucket.key}
                    className="flex h-full min-w-0 flex-1 flex-col justify-end"
                    title={`${bucket.label}: ${bucket.total} finding${bucket.total === 1 ? "" : "s"}`}
                  >
                    <div
                      className="flex w-full flex-col-reverse gap-px overflow-hidden rounded-t-[3px]"
                      style={{ height: `${heightPct}%` }}
                    >
                      {TIMELINE_SERIES.map((series) => {
                        const value = bucket[series.key];
                        if (value <= 0) return null;
                        return (
                          <div
                            key={series.key}
                            className={series.fill}
                            style={{ height: `${(value / bucket.total) * 100}%` }}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-0.5" aria-hidden>
              {buckets.map((bucket, index) => (
                <div
                  key={bucket.key}
                  className="min-w-0 flex-1 truncate text-center text-[10px] text-muted-foreground"
                >
                  {index % labelEvery === 0 ? bucket.label : ""}
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** Chart 4 — how long resolved conditions lasted, as an ordered duration histogram. */
function ResolutionDistributionChart({
  distribution,
}: {
  distribution: IntelResolutionDistribution;
}) {
  const { buckets, resolvedCount, ongoingCount, reconciledCount, maxCount } = distribution;

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="text-base">Resolution duration</CardTitle>
        <p className="text-xs text-muted-foreground">
          How long resolved conditions lasted, from first observation to recovery.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {resolvedCount === 0 ? (
          <p className="text-sm text-muted-foreground">
            No genuinely resolved findings with a measurable duration in this window.
          </p>
        ) : (
          buckets.map((bucket) => (
            <MagnitudeBarRow
              key={bucket.key}
              label={bucket.label}
              value={bucket.count}
              maxValue={maxCount}
            />
          ))
        )}
        <p className="border-t border-border/60 pt-3 text-xs text-muted-foreground">
          {resolvedCount} resolved finding{resolvedCount === 1 ? "" : "s"} shown
          {ongoingCount > 0 ? ` · ${ongoingCount} still open` : ""}
          {reconciledCount > 0
            ? ` · ${reconciledCount} superseded/quarantined excluded`
            : ""}
          .
        </p>
      </CardContent>
    </Card>
  );
}

/** Chart 5 — how trustworthy the window is, by verification/evidence tier (ordered most-trusted first). */
function EvidenceQualityChart({ quality }: { quality: IntelEvidenceQuality }) {
  const { tiers, total, maxCount } = quality;

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="text-base">Evidence quality</CardTitle>
        <p className="text-xs text-muted-foreground">
          How trustworthy is this window — findings and incidents by verification state, most
          trusted first.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {total === 0 ? (
          <p className="text-sm text-muted-foreground">
            No findings with an evidence signal in this window.
          </p>
        ) : (
          <>
            {tiers.map((tier) => (
              <MagnitudeBarRow
                key={tier.key}
                label={tier.label}
                value={tier.count}
                maxValue={maxCount}
              />
            ))}
            <p className="border-t border-border/60 pt-3 text-xs text-muted-foreground">
              {total} finding{total === 1 ? "" : "s"} classified. Quarantined and diagnostic records
              are surfaced separately so they never inflate the verified record.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function IntelAggregateHistoryHeader({
  activeWindow,
  onSelectWindow,
}: {
  activeWindow: AggregateWindow;
  onSelectWindow?: (window: AggregateWindow) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{INTEL_AGGREGATE_HEADING}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{INTEL_AGGREGATE_SUBTITLE}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2" aria-label="Time window">
        {AGGREGATE_WINDOW_OPTIONS.map((option) => (
          <Button
            key={option.value}
            type="button"
            size="sm"
            variant={activeWindow === option.value ? "default" : "outline"}
            aria-pressed={activeWindow === option.value}
            onClick={() => onSelectWindow?.(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

export default function AlertsPage() {
  const { account } = useAccount();
  const {
    ledgerPage,
    loading: bootstrapLoading,
    loaded: bootstrapLoaded,
    error: bootstrapError,
    reload: reloadBootstrap,
  } = useRadarLedgerHistory();
  const [alertPage, setAlertPage] = useState<RadarAlertPage>(DEFAULT_ALERT_PAGE);
  const [loading, setLoading] = useState(true);
  const [severity, setSeverity] = useState<string>("");
  const [monitorType, setMonitorType] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [aggregateWindow, setAggregateWindow] =
    useState<AggregateWindow>(DEFAULT_AGGREGATE_WINDOW);
  const [activeBurdenTab, setActiveBurdenTab] = useState<IntelBurdenTabKey>("object");
  const resolvedPlan = resolvePlan(account.plan, account.isAdmin, account.adminViewPlan);
  const isIntelView = resolvedPlan === "radar_intel";

  async function load() {
    if (isIntelView) {
      await reloadBootstrap();
      return;
    }
    setLoading(true);
    try {
      const data = await listAlertPage(
        buildCurrentAlertRequestParams({
          isIntelView,
          status,
          severity,
          monitorType,
          aggregateWindow,
        }),
      );
      setAlertPage({
        ...data,
        alerts: sortAlertsByUpdatedAt(data.alerts),
      });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isIntelView) {
      return;
    }

    let cancelled = false;

    void (async () => {
      setLoading(true);
      try {
        const data = await listAlertPage(
          buildCurrentAlertRequestParams({
            isIntelView,
            status,
            severity,
            monitorType,
            aggregateWindow,
          }),
        );
        if (!cancelled) {
          setAlertPage({
            ...data,
            alerts: sortAlertsByUpdatedAt(data.alerts),
          });
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
  }, [aggregateWindow, isIntelView, monitorType, severity, status]);

  const fieldFilteredLedgerAlerts = filterAlertsByDashboardControls(ledgerPage.alerts, {
    status,
    severity,
    monitorType,
  });
  const intelWindowAlerts = filterRadarIntelAlertsByWindow(fieldFilteredLedgerAlerts, aggregateWindow);
  const alerts = isIntelView ? intelWindowAlerts : alertPage.alerts;
  const visibleAlerts = alerts;
  const rows = correlateAlerts(visibleAlerts);
  const { findings, coverageGaps } = splitRows(rows);
  const coverageGroups = groupCoverageGapAlerts(coverageGaps);
  const intelSummary = isIntelView
    ? summarizeRadarIntelAggregateHistory(fieldFilteredLedgerAlerts, aggregateWindow)
    : null;
  const resolvedAlerts = intelSummary?.resolvedFindings ?? alerts.filter((alert) => alert.status === "resolved").length;
  const activeAlerts = intelSummary?.activeFindings ?? alerts.filter((alert) => alert.status === "active").length;
  const criticalAlerts = intelSummary?.criticalFindings ?? alerts.filter((alert) => alert.severity === "critical").length;
  const totalFindings = intelSummary?.totalFindings ?? findings.length;
  const coverageIncidents = intelSummary?.coverageIncidents ?? coverageGroups.length;
  const ledgerRowsLoaded = isIntelView ? intelWindowAlerts.length : alertPage.pageCount;
  const coverageCheckEvents = coverageGaps.length;
  const intelAggregation = buildIntelBurdenAggregation(findings, coverageGroups);
  const topCoverageProvider = topLabelByCount(
    coverageGaps.map((alert) => alert.source),
    "No affected provider",
  );
  const topCoverageChain = topLabelByCount(
    coverageGaps.map((alert) => alert.chain),
    "No affected chain",
  );
  const coverageLastSeenAt = latestCoverageSeenAt(coverageGaps);
  const findingsTimeline = buildIntelFindingsTimeline(findings, coverageGroups, aggregateWindow);
  const resolutionDistribution = buildIntelResolutionDistribution(findings);
  const evidenceQuality = buildIntelEvidenceQuality(findings, coverageGroups);
  const activeBurdenSection =
    INTEL_BURDEN_TABS.find((tab) => tab.key === activeBurdenTab) ?? INTEL_BURDEN_TABS[0];
  const activeBurdenRows =
    activeBurdenTab === "chain"
      ? intelAggregation.byChain
      : activeBurdenTab === "provider"
        ? intelAggregation.byProvider
        : activeBurdenTab === "type"
          ? intelAggregation.byType
          : intelAggregation.byObject;
  const pageLoading = isIntelView ? bootstrapLoading || !bootstrapLoaded : loading;

  if (isIntelView && bootstrapError) {
    return <div className="text-sm text-muted-foreground">{bootstrapError}</div>;
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        {isIntelView ? (
          <div className="space-y-3">
            <IntelAggregateHistoryHeader
              activeWindow={aggregateWindow}
              onSelectWindow={setAggregateWindow}
            />
            <p className="text-sm text-muted-foreground">
              {ledgerRowsLoaded} ledger event{ledgerRowsLoaded === 1 ? "" : "s"} loaded into this
              view, producing {totalFindings} correlated finding
              {totalFindings === 1 ? "" : "s"} and {coverageIncidents} coverage incident
              {coverageIncidents === 1 ? "" : "s"}.
            </p>
          </div>
        ) : (
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Alerts</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {findings.length} finding row{findings.length !== 1 ? "s" : ""}, {coverageGroups.length} coverage incident
              {coverageGroups.length !== 1 ? "s" : ""} from {alerts.length} visible alert
              {alerts.length !== 1 ? "s" : ""} matching filters
            </p>
          </div>
        )}
        <Button variant="outline" size="sm" onClick={load} disabled={pageLoading}>
          <RefreshCw
            className={`mr-2 h-3.5 w-3.5 ${pageLoading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {isIntelView ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          <SummaryMetricCard title="Ledger events loaded" value={ledgerRowsLoaded} />
          <SummaryMetricCard title="Correlated findings" value={totalFindings} />
          <SummaryMetricCard title="Active findings" value={activeAlerts} />
          <SummaryMetricCard title="Resolved findings" value={resolvedAlerts} />
          <SummaryMetricCard title="Critical findings" value={criticalAlerts} />
          <SummaryMetricCard title="Coverage incidents" value={coverageIncidents} />
          <SummaryMetricCard
            title="Median resolution time"
            value={intelSummary?.medianResolutionTimeLabel ?? "Not enough resolved data"}
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryMetricCard title="Active alerts" value={activeAlerts} />
          <SummaryMetricCard title="Resolved alerts" value={resolvedAlerts} />
          <SummaryMetricCard title="Critical alerts" value={criticalAlerts} />
          <SummaryMetricCard title="Coverage incidents" value={coverageIncidents} />
        </div>
      )}

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
          <option value="disabled">Disabled</option>
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

      {pageLoading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : rows.length === 0 ? (
        <Card className="border-border/60">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No {isIntelView ? "aggregate findings" : "alerts"} match the current filters.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {isIntelView && findings.length > 0 && (
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-base">Finding composition</CardTitle>
                <p className="text-xs text-muted-foreground">
                  How the {totalFindings} correlated finding{totalFindings === 1 ? "" : "s"} in this
                  window break down by lifecycle status and severity.
                </p>
              </CardHeader>
              <CardContent className="grid gap-6 lg:grid-cols-2">
                <CompositionBlock title="Status mix" segments={statusMixSegments(findings)} />
                <CompositionBlock title="Severity mix" segments={severityMixSegments(findings)} />
              </CardContent>
            </Card>
          )}

          {isIntelView && <FindingsTimelineChart timeline={findingsTimeline} />}

          {isIntelView && (
            <div className="grid gap-6 lg:grid-cols-2">
              <CategoryMixChart rows={intelAggregation.byType} />
              <ResolutionDistributionChart distribution={resolutionDistribution} />
            </div>
          )}

          {isIntelView && <EvidenceQualityChart quality={evidenceQuality} />}

          {isIntelView && (
            <section className="space-y-3">
              <div>
                <h2 className="font-semibold">Signal burden</h2>
                <p className="text-xs text-muted-foreground">
                  Rankings are based on correlated findings and real coverage incidents only.
                </p>
              </div>
              <div className="space-y-4">
                <div
                  role="tablist"
                  aria-label="Signal burden views"
                  className="flex flex-wrap gap-2"
                >
                  {INTEL_BURDEN_TABS.map((tab) => {
                    const isActive = activeBurdenTab === tab.key;
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        role="tab"
                        id={`signal-burden-tab-${tab.key}`}
                        aria-selected={isActive}
                        aria-controls={`signal-burden-panel-${tab.key}`}
                        onClick={() => setActiveBurdenTab(tab.key)}
                        className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                          isActive
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : "border-border/60 bg-background/40 text-muted-foreground hover:bg-background/70 hover:text-foreground"
                        }`}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
                <div
                  role="tabpanel"
                  id={`signal-burden-panel-${activeBurdenSection.key}`}
                  aria-labelledby={`signal-burden-tab-${activeBurdenSection.key}`}
                >
                  <AggregateBucketList
                    title={activeBurdenSection.title}
                    description={activeBurdenSection.description}
                    rows={activeBurdenRows}
                  />
                </div>
              </div>
            </section>
          )}

          {isIntelView && (
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-base">Ledger activity</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Raw ledger volume is tracked separately from burden rankings.
                </p>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-md border border-border/60 bg-background/50 px-3 py-3">
                    <p className="text-xs text-muted-foreground">Events loaded</p>
                    <p className="mt-1 text-lg font-semibold">{ledgerRowsLoaded}</p>
                  </div>
                  <div className="rounded-md border border-border/60 bg-background/50 px-3 py-3">
                    <p className="text-xs text-muted-foreground">Correlated findings</p>
                    <p className="mt-1 text-lg font-semibold">{totalFindings}</p>
                  </div>
                  <div className="rounded-md border border-border/60 bg-background/50 px-3 py-3">
                    <p className="text-xs text-muted-foreground">Coverage/check events</p>
                    <p className="mt-1 text-lg font-semibold">{coverageCheckEvents}</p>
                  </div>
                  <div className="rounded-md border border-border/60 bg-background/50 px-3 py-3">
                    <p className="text-xs text-muted-foreground">Coverage incidents</p>
                    <p className="mt-1 text-lg font-semibold">{coverageIncidents}</p>
                  </div>
                </div>
                <div className="space-y-3 border-t border-border/60 pt-4">
                  <p className="text-xs text-muted-foreground">
                    Signal funnel — share of loaded ledger events reaching each stage.
                  </p>
                  <FunnelBar
                    label="Ledger events loaded"
                    value={ledgerRowsLoaded}
                    maxValue={ledgerRowsLoaded}
                    baseValue={ledgerRowsLoaded}
                  />
                  <FunnelBar
                    label="Correlated findings"
                    value={totalFindings}
                    maxValue={ledgerRowsLoaded}
                    baseValue={ledgerRowsLoaded}
                  />
                  <FunnelBar
                    label="Coverage incidents"
                    value={coverageIncidents}
                    maxValue={ledgerRowsLoaded}
                    baseValue={ledgerRowsLoaded}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {isIntelView ? (
            <>
              <details className="rounded-lg border border-border/60 bg-background/40">
                <summary className="cursor-pointer list-none px-4 py-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h2 className="font-semibold">Coverage incidents</h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Coverage, source, and read-path incidents separated from the burden rankings.
                      </p>
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">View details</span>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-md border border-border/60 bg-background/50 px-3 py-3">
                      <p className="text-xs text-muted-foreground">Total coverage incidents</p>
                      <p className="mt-1 text-lg font-semibold">{coverageIncidents}</p>
                    </div>
                    <div className="rounded-md border border-border/60 bg-background/50 px-3 py-3">
                      <p className="text-xs text-muted-foreground">Top affected provider</p>
                      <p className="mt-1 text-sm font-semibold">{topCoverageProvider}</p>
                    </div>
                    <div className="rounded-md border border-border/60 bg-background/50 px-3 py-3">
                      <p className="text-xs text-muted-foreground">Top affected chain</p>
                      <p className="mt-1 text-sm font-semibold">{topCoverageChain}</p>
                    </div>
                    <div className="rounded-md border border-border/60 bg-background/50 px-3 py-3">
                      <p className="text-xs text-muted-foreground">Last seen</p>
                      <p className="mt-1 text-sm font-semibold">
                        {coverageLastSeenAt ? (
                          <LocalDateTime value={coverageLastSeenAt} preset="compact" />
                        ) : (
                          "No incidents"
                        )}
                      </p>
                    </div>
                  </div>
                </summary>
                <div className="space-y-3 border-t border-border/60 px-4 py-4">
                  {coverageGroups.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No coverage gaps match the current filters.
                    </p>
                  ) : (
                    coverageGroups.map((group) => (
                      <CoverageGapGroupCard key={group.id} group={group} />
                    ))
                  )}
                </div>
              </details>

              <details className="rounded-lg border border-border/60 bg-background/40">
                <summary className="cursor-pointer list-none px-4 py-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h2 className="font-semibold">Underlying findings</h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Correlated finding rows derived from the loaded ledger events.
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>
                        {totalFindings} finding row{totalFindings === 1 ? "" : "s"} from{" "}
                        {ledgerRowsLoaded} loaded ledger event{ledgerRowsLoaded === 1 ? "" : "s"}
                      </span>
                      <span className="font-medium">View details</span>
                    </div>
                  </div>
                </summary>
                <div className="space-y-3 border-t border-border/60 px-4 py-4">
                  {findings.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No finding rows match the current filters.
                    </p>
                  ) : (
                    findings.map(renderRow)
                  )}
                </div>
              </details>
            </>
          ) : (
            <>
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
                      No coverage gaps match the current filters.
                    </CardContent>
                  </Card>
                ) : (
                  coverageGroups.map((group) => (
                    <CoverageGapGroupCard key={group.id} group={group} />
                  ))
                )}
              </section>
            </>
          )}
        </div>
      )}
    </div>
  );
}
