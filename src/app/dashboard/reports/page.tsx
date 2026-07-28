"use client";

import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  FileText,
  Printer,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import type { RadarAlert } from "@/lib/api-types";
import { isCoverageGapAlert } from "@/lib/alert-classification";
import {
  buildInfrastructureHealthSummary,
  buildIntelAlertsAggregation,
  buildProviderReliabilityRowsWithOptions,
  type IntelSummaryBucket,
  type ProviderReliabilityRow,
} from "@/lib/intel-analytics";
import { useRadarLedgerHistory } from "@/lib/radar-ledger-context";
import {
  filterLedgerAlertsByWindow,
  RADAR_LEDGER_WINDOW_OPTIONS,
  type RadarLedgerWindow,
} from "@/lib/radar-ledger";
import { getProviderBrand } from "@/lib/provider-branding";
import { cn, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

const DEFAULT_REPORT_WINDOW: RadarLedgerWindow = "30d";
const DEFAULT_RANK_LIMIT = 5;
const RANK_LIMIT_OPTIONS = [5, 10, 15] as const;

type ReportAudience = "executive" | "operations" | "provider";
type ReportSectionKey = "overview" | "hotspots" | "providerHealth" | "activity";

const AUDIENCE_OPTIONS: Array<{ value: ReportAudience; label: string; helper: string }> = [
  {
    value: "executive",
    label: "Executive",
    helper: "Top-level risk, concentration, and overall provider condition.",
  },
  {
    value: "operations",
    label: "Operations",
    helper: "Incoming activity, recovery velocity, and unresolved pressure.",
  },
  {
    value: "provider",
    label: "Provider",
    helper: "Condition, observability, and burden by provider.",
  },
];

const SECTION_OPTIONS: Array<{ key: ReportSectionKey; label: string; helper: string }> = [
  {
    key: "overview",
    label: "Overview",
    helper: "Headline metrics, report metadata, and the generated narrative.",
  },
  {
    key: "hotspots",
    label: "Hotspots",
    helper: "Top providers, chains, monitor mix, and object hotspots.",
  },
  {
    key: "providerHealth",
    label: "Provider health",
    helper: "Condition mix and the most burdened provider rows.",
  },
  {
    key: "activity",
    label: "Activity snapshot",
    helper: "Openings, recoveries, backlog, and coverage interruptions.",
  },
];

type ReportSectionsState = Record<ReportSectionKey, boolean>;
type StatusTone = "info" | "success" | "error";

const DEFAULT_SECTIONS: ReportSectionsState = {
  overview: true,
  hotspots: true,
  providerHealth: true,
  activity: true,
};

interface ExportStatus {
  message: string;
  tone: StatusTone;
}

interface ReportSummary {
  totalAlerts: number;
  activeAlerts: number;
  resolvedAlerts: number;
  criticalAlerts: number;
  warningAlerts: number;
  watchAlerts: number;
  coverageAlerts: number;
  providersTracked: number;
  topProviders: IntelSummaryBucket[];
  topChains: IntelSummaryBucket[];
  topMonitorTypes: IntelSummaryBucket[];
}

interface ProviderHealthSummary {
  trackedProviders: number;
  criticalProviders: number;
  degradedProviders: number;
  stableProviders: number;
  noActiveIssueProviders: number;
  healthyProviders: number;
  providersWithActiveIssues: number;
}

function providerName(alert: RadarAlert): string {
  const value =
    alert.source ||
    alert.oracle ||
    alert.bridge ||
    alert.affectedProtocol ||
    "Unknown provider";
  const trimmed = value.trim();
  return getProviderBrand(trimmed.length > 0 ? trimmed : "Unknown provider").displayName;
}

function countBuckets(values: string[], limit: number): IntelSummaryBucket[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    counts.set(trimmed, (counts.get(trimmed) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => (b[1] === a[1] ? a[0].localeCompare(b[0]) : b[1] - a[1]))
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

function summarizeReport(alerts: RadarAlert[], rankLimit: number): ReportSummary {
  return {
    totalAlerts: alerts.length,
    activeAlerts: alerts.filter((alert) => alert.status === "active").length,
    resolvedAlerts: alerts.filter((alert) => alert.status === "resolved").length,
    criticalAlerts: alerts.filter((alert) => alert.severity === "critical").length,
    warningAlerts: alerts.filter((alert) => alert.severity === "warning").length,
    watchAlerts: alerts.filter((alert) => alert.severity === "watch").length,
    coverageAlerts: alerts.filter((alert) => isCoverageGapAlert(alert)).length,
    providersTracked: new Set(alerts.map(providerName)).size,
    topProviders: countBuckets(alerts.map(providerName), rankLimit),
    topChains: countBuckets(
      alerts
        .map((alert) => alert.chain?.trim())
        .filter((value): value is string => Boolean(value)),
      rankLimit,
    ),
    topMonitorTypes: countBuckets(
      alerts.map((alert) => (isCoverageGapAlert(alert) ? "coverage" : alert.monitorType)),
      rankLimit,
    ),
  };
}

function summarizeProviderHealth(rows: ProviderReliabilityRow[]): ProviderHealthSummary {
  const criticalProviders = rows.filter((row) => row.currentCondition === "Critical").length;
  const degradedProviders = rows.filter((row) => row.currentCondition === "Degraded").length;
  const stableProviders = rows.filter((row) => row.currentCondition === "Stable").length;
  const noActiveIssueProviders = rows.filter(
    (row) => row.currentCondition === "No active issues",
  ).length;

  return {
    trackedProviders: rows.length,
    criticalProviders,
    degradedProviders,
    stableProviders,
    noActiveIssueProviders,
    healthyProviders: stableProviders + noActiveIssueProviders,
    providersWithActiveIssues: criticalProviders + degradedProviders,
  };
}

function windowLabel(window: RadarLedgerWindow): string {
  return RADAR_LEDGER_WINDOW_OPTIONS.find((option) => option.value === window)?.label ?? window;
}

function windowDescription(window: RadarLedgerWindow): string {
  if (window === "all") return "the full visible ledger history";
  return `the last ${window.slice(0, -1)} days of visible ledger history`;
}

function topBucketLabel(buckets: IntelSummaryBucket[]): string {
  return buckets[0]?.label ?? "No dominant source";
}

function providerDisplayName(value: string): string {
  return getProviderBrand(value).displayName;
}

function formatPercent(value: number): string {
  return `${value}%`;
}

function buildNarrativeBrief(input: {
  audience: ReportAudience;
  reportTitle: string;
  reportWindow: RadarLedgerWindow;
  summary: ReportSummary;
  providerHealth: ProviderHealthSummary;
  providerRows: ProviderReliabilityRow[];
  activitySummary: ReturnType<typeof buildInfrastructureHealthSummary>;
}): string {
  const topProvider = topBucketLabel(input.summary.topProviders);
  const topChain = topBucketLabel(input.summary.topChains);
  const topMonitor = topBucketLabel(input.summary.topMonitorTypes);
  const weakestProvider = input.providerRows[0]?.provider
    ? providerDisplayName(input.providerRows[0].provider)
    : "no provider";
  const weakestCondition = input.providerRows[0]?.currentCondition ?? "No active issues";

  if (input.audience === "executive") {
    return `${input.reportTitle} covers ${windowDescription(input.reportWindow)} and records ${input.summary.totalAlerts} visible alerts across ${input.summary.providersTracked} tracked providers. ${input.summary.activeAlerts} alerts remain active, with ${input.summary.criticalAlerts} at critical severity. Provider pressure is concentrated around ${topProvider}, while ${input.providerHealth.providersWithActiveIssues} providers currently show active condition issues and ${input.providerHealth.healthyProviders} remain healthy. ${topChain} is the most burdened chain and ${topMonitor} is the dominant signal class in this reporting window.`;
  }

  if (input.audience === "operations") {
    return `${input.reportTitle} focuses on operating pressure across ${windowDescription(input.reportWindow)}. The ledger shows ${input.activitySummary.findingsOpenedTotal} findings opened, ${input.activitySummary.resolvedFindingsTotal} findings resolved, and an active backlog of ${input.activitySummary.activeBacklogTotal} unresolved findings at the end of the visible window. Coverage interruptions contributed ${input.activitySummary.coverageIncidentsTotal} incidents, with the highest alert concentration around ${topProvider} on ${topChain}. The main monitor burden comes from ${topMonitor}.`;
  }

  return `${input.reportTitle} summarizes provider condition across ${windowDescription(input.reportWindow)}. ${input.providerHealth.trackedProviders} providers were attributed in the visible report set, with ${input.providerHealth.criticalProviders} currently critical and ${input.providerHealth.degradedProviders} degraded. ${weakestProvider} currently ranks as the weakest provider row with a ${weakestCondition} condition label, while Radar observability incidents total ${input.summary.coverageAlerts} coverage-side records in the same window.`;
}

function buildReportPayload(input: {
  reportTitle: string;
  audience: ReportAudience;
  reportWindow: RadarLedgerWindow;
  rankLimit: number;
  includedSections: ReportSectionsState;
  generatedAt: string;
  truncated: boolean;
  summary: ReportSummary;
  providerHealth: ProviderHealthSummary;
  providerRows: ProviderReliabilityRow[];
  hotspots: ReturnType<typeof buildIntelAlertsAggregation>;
  activitySummary: ReturnType<typeof buildInfrastructureHealthSummary>;
  narrative: string;
}) {
  const brandedProviderRows = input.providerRows.slice(0, input.rankLimit).map((row) => ({
    ...row,
    provider: providerDisplayName(row.provider),
  }));

  return {
    metadata: {
      title: input.reportTitle,
      audience: input.audience,
      window: input.reportWindow,
      windowLabel: windowLabel(input.reportWindow),
      generatedAt: input.generatedAt,
      rankLimit: input.rankLimit,
      truncatedVisibleHistory: input.truncated,
      includedSections: input.includedSections,
    },
    narrative: input.narrative,
    summary: input.summary,
    providerHealth: input.providerHealth,
    hotspots: {
      providers: input.summary.topProviders,
      chains: input.summary.topChains,
      monitorMix: input.summary.topMonitorTypes,
      objects: input.hotspots.byObject.slice(0, input.rankLimit),
    },
    activity: {
      recordedActivityTotal: input.activitySummary.recordedActivityTotal,
      findingsOpenedTotal: input.activitySummary.findingsOpenedTotal,
      resolvedFindingsTotal: input.activitySummary.resolvedFindingsTotal,
      activeBacklogTotal: input.activitySummary.activeBacklogTotal,
      coverageIncidentsTotal: input.activitySummary.coverageIncidentsTotal,
      timelineWindowStart: input.activitySummary.windowStartDateKey,
      timelineWindowEnd: input.activitySummary.windowEndDateKey,
    },
    providerRows: brandedProviderRows,
  };
}

function buildCsvFromPayload(payload: ReturnType<typeof buildReportPayload>): string {
  const rows: Array<Record<string, string | number | boolean>> = [];

  rows.push(
    { section: "metadata", metric: "title", value: payload.metadata.title },
    { section: "metadata", metric: "audience", value: payload.metadata.audience },
    { section: "metadata", metric: "window", value: payload.metadata.windowLabel },
    { section: "metadata", metric: "generated_at", value: payload.metadata.generatedAt },
    {
      section: "metadata",
      metric: "truncated_visible_history",
      value: payload.metadata.truncatedVisibleHistory,
    },
    { section: "summary", metric: "total_alerts", value: payload.summary.totalAlerts },
    { section: "summary", metric: "active_alerts", value: payload.summary.activeAlerts },
    { section: "summary", metric: "resolved_alerts", value: payload.summary.resolvedAlerts },
    { section: "summary", metric: "critical_alerts", value: payload.summary.criticalAlerts },
    { section: "summary", metric: "warning_alerts", value: payload.summary.warningAlerts },
    { section: "summary", metric: "watch_alerts", value: payload.summary.watchAlerts },
    { section: "summary", metric: "coverage_alerts", value: payload.summary.coverageAlerts },
    { section: "summary", metric: "providers_tracked", value: payload.summary.providersTracked },
    {
      section: "provider_health",
      metric: "tracked_providers",
      value: payload.providerHealth.trackedProviders,
    },
    {
      section: "provider_health",
      metric: "providers_with_active_issues",
      value: payload.providerHealth.providersWithActiveIssues,
    },
    {
      section: "provider_health",
      metric: "critical_providers",
      value: payload.providerHealth.criticalProviders,
    },
    {
      section: "provider_health",
      metric: "degraded_providers",
      value: payload.providerHealth.degradedProviders,
    },
    {
      section: "activity",
      metric: "recorded_activity_total",
      value: payload.activity.recordedActivityTotal,
    },
    {
      section: "activity",
      metric: "findings_opened_total",
      value: payload.activity.findingsOpenedTotal,
    },
    {
      section: "activity",
      metric: "resolved_findings_total",
      value: payload.activity.resolvedFindingsTotal,
    },
    {
      section: "activity",
      metric: "active_backlog_total",
      value: payload.activity.activeBacklogTotal,
    },
    {
      section: "activity",
      metric: "coverage_incidents_total",
      value: payload.activity.coverageIncidentsTotal,
    },
  );

  payload.hotspots.providers.forEach((bucket, index) => {
    rows.push({
      section: "top_providers",
      rank: index + 1,
      label: bucket.label,
      count: bucket.count,
    });
  });
  payload.hotspots.chains.forEach((bucket, index) => {
    rows.push({
      section: "top_chains",
      rank: index + 1,
      label: bucket.label,
      count: bucket.count,
    });
  });
  payload.hotspots.monitorMix.forEach((bucket, index) => {
    rows.push({
      section: "monitor_mix",
      rank: index + 1,
      label: bucket.label,
      count: bucket.count,
    });
  });
  payload.hotspots.objects.forEach((row, index) => {
    rows.push({
      section: "top_objects",
      rank: index + 1,
      label: row.label,
      total_alerts: row.totalAlerts,
      active_alerts: row.activeAlerts,
      critical_alerts: row.criticalAlerts,
      coverage_alerts: row.coverageAlerts,
    });
  });
  payload.providerRows.forEach((row, index) => {
    rows.push({
      section: "provider_rows",
      rank: index + 1,
      provider: row.provider,
      current_condition: row.currentCondition,
      pattern_label: row.patternLabel,
      observability_score: row.observabilityScore,
      active_incidents: row.activeIncidents,
      critical_findings: row.criticalFindings,
      coverage_incidents: row.coverageIncidents,
      recovery_rate: row.recoveryRate,
      recurrence_rate: row.recurrenceRate,
    });
  });

  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const escape = (value: string | number | boolean | undefined) => {
    const stringValue = value === undefined ? "" : String(value);
    return /[",\n]/.test(stringValue)
      ? `"${stringValue.replace(/"/g, "\"\"")}"`
      : stringValue;
  };

  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escape(row[header])).join(",")),
  ].join("\n");
}

function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  downloadBlobFile(filename, blob);
}

function downloadBlobFile(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function MetricCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string | number;
  helper: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-black/10 px-4 py-4">
      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/80">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
    </div>
  );
}

function SectionToggle({
  label,
  helper,
  checked,
  onChange,
}: {
  label: string;
  helper: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/60 bg-black/10 px-3 py-3">
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 rounded border-input bg-background text-primary"
        checked={checked}
        onChange={onChange}
      />
      <span className="space-y-1">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{helper}</span>
      </span>
    </label>
  );
}

function RankedList({
  title,
  buckets,
  emptyLabel,
  accentClassName = "bg-primary",
}: {
  title: string;
  buckets: IntelSummaryBucket[];
  emptyLabel: string;
  accentClassName?: string;
}) {
  const maxCount = buckets.reduce((max, bucket) => Math.max(max, bucket.count), 0);

  return (
    <div className="space-y-3 rounded-xl border border-border/60 bg-black/10 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Ranked
        </span>
      </div>
      {buckets.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="space-y-3">
          {buckets.map((bucket, index) => {
            const widthPct = maxCount > 0 ? Math.max(8, (bucket.count / maxCount) * 100) : 0;
            return (
              <div key={bucket.label} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate">
                    <span className="mr-2 font-mono text-xs text-muted-foreground">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {title === "Top providers" ? providerDisplayName(bucket.label) : bucket.label}
                  </span>
                  <span className="shrink-0 text-muted-foreground">{bucket.count}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted/50">
                  <div className={cn("h-full rounded-full", accentClassName)} style={{ width: `${widthPct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function conditionClassName(condition: ProviderReliabilityRow["currentCondition"]): string {
  if (condition === "Critical") return "border-red-500/20 bg-red-500/10 text-red-300";
  if (condition === "Degraded") return "border-amber-500/20 bg-amber-500/10 text-amber-200";
  if (condition === "Stable") return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  return "border-border/70 bg-muted/20 text-muted-foreground";
}

function ProviderHealthTable({
  rows,
}: {
  rows: ProviderReliabilityRow[];
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-black/10">
      <div className="grid grid-cols-[minmax(0,1.5fr)_0.8fr_0.8fr_0.8fr_0.7fr] gap-3 border-b border-border/60 px-4 py-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground/80">
        <span>Provider</span>
        <span>Condition</span>
        <span>Observability</span>
        <span>Active issues</span>
        <span>Coverage</span>
      </div>
      {rows.length === 0 ? (
        <div className="px-4 py-6 text-sm text-muted-foreground">
          No provider rows were attributed in this report window.
        </div>
      ) : (
        rows.map((row) => (
          <div
            key={row.provider}
            className="grid grid-cols-[minmax(0,1.5fr)_0.8fr_0.8fr_0.8fr_0.7fr] gap-3 border-t border-border/40 px-4 py-3 text-sm first:border-t-0"
          >
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">
                {providerDisplayName(row.provider)}
              </p>
              <p className="text-xs text-muted-foreground">
                {row.criticalFindings} critical findings · {row.recoveryRate}% recovery
              </p>
            </div>
            <div>
              <span
                className={cn(
                  "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium",
                  conditionClassName(row.currentCondition),
                )}
              >
                {row.currentCondition}
              </span>
            </div>
            <div className="text-muted-foreground">{formatPercent(row.observabilityScore)}</div>
            <div className="text-muted-foreground">{row.activeIncidents}</div>
            <div className="text-muted-foreground">{row.coverageIncidents}</div>
          </div>
        ))
      )}
    </div>
  );
}

function ExportToast({ status }: { status: ExportStatus }) {
  const toneClassName =
    status.tone === "error"
      ? "border-red-500/30 bg-red-500/15 text-red-100"
      : status.tone === "success"
        ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-50"
        : "border-violet-500/30 bg-violet-500/15 text-violet-50";
  const Icon = status.tone === "error" ? AlertTriangle : CheckCircle2;

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-sm">
      <div
        className={cn(
          "rounded-xl border px-4 py-3 shadow-2xl backdrop-blur-md",
          toneClassName,
        )}
        role="status"
        aria-live="polite"
      >
        <div className="flex items-start gap-3">
          <Icon className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="space-y-1">
            <p className="text-sm font-medium">
              {status.tone === "error" ? "Export blocked" : "Report export"}
            </p>
            <p className="text-sm leading-5">{status.message}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const { page, loading, loaded, error } = useRadarLedgerHistory();
  const [reportTitle, setReportTitle] = useState("Radar Intel Situational Report");
  const [reportWindow, setReportWindow] = useState<RadarLedgerWindow>(DEFAULT_REPORT_WINDOW);
  const [audience, setAudience] = useState<ReportAudience>("executive");
  const [rankLimit, setRankLimit] = useState<number>(DEFAULT_RANK_LIMIT);
  const [sections, setSections] = useState<ReportSectionsState>(DEFAULT_SECTIONS);
  const [status, setStatus] = useState<ExportStatus | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);

  const filteredAlerts = filterLedgerAlertsByWindow(page.alerts, reportWindow);
  const summary = summarizeReport(filteredAlerts, rankLimit);
  const providerRows = buildProviderReliabilityRowsWithOptions(filteredAlerts, {
    scoringWindowLabel: `${windowLabel(reportWindow)} report window`,
  }).slice(0, rankLimit);
  const fullProviderRows = buildProviderReliabilityRowsWithOptions(filteredAlerts, {
    scoringWindowLabel: `${windowLabel(reportWindow)} report window`,
  });
  const providerHealth = summarizeProviderHealth(fullProviderRows);
  const hotspots = buildIntelAlertsAggregation(filteredAlerts);
  const activitySummary = buildInfrastructureHealthSummary(filteredAlerts, null);
  const generatedAt = new Date().toISOString();
  const narrative = buildNarrativeBrief({
    audience,
    reportTitle,
    reportWindow,
    summary,
    providerHealth,
    providerRows: fullProviderRows,
    activitySummary,
  });
  const reportPayload = buildReportPayload({
    reportTitle,
    audience,
    reportWindow,
    rankLimit,
    includedSections: sections,
    generatedAt,
    truncated: page.count > page.pageCount,
    summary,
    providerHealth,
    providerRows: fullProviderRows,
    hotspots,
    activitySummary,
    narrative,
  });
  const exportBaseName = `${reportTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "radar-report"}-${reportWindow}-${generatedAt.slice(0, 10)}`;
  const activeAudienceHelper =
    AUDIENCE_OPTIONS.find((option) => option.value === audience)?.helper ?? "";

  function announce(message: string, tone: StatusTone = "success") {
    setStatus({ message, tone });
    window.setTimeout(() => {
      setStatus((current) =>
        current?.message === message && current?.tone === tone ? null : current,
      );
    }, 2400);
  }

  function toggleSection(section: ReportSectionKey) {
    setSections((current) => ({
      ...current,
      [section]: !current[section],
    }));
  }

  function exportJson() {
    downloadFile(
      `${exportBaseName}.json`,
      JSON.stringify(reportPayload, null, 2),
      "application/json;charset=utf-8",
    );
    announce("JSON export downloaded.", "success");
  }

  function exportCsv() {
    downloadFile(
      `${exportBaseName}.csv`,
      buildCsvFromPayload(reportPayload),
      "text/csv;charset=utf-8",
    );
    announce("CSV export downloaded.", "success");
  }

  async function copyBrief() {
    try {
      await navigator.clipboard.writeText(narrative);
      announce("Narrative copied to clipboard.", "success");
    } catch {
      announce("Clipboard copy failed.", "error");
    }
  }

  async function exportPdf() {
    if (exportingPdf) return;

    setExportingPdf(true);
    announce("Preparing branded PDF export...", "info");

    try {
      const response = await fetch("/api/reports/pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(reportPayload),
      });

      if (!response.ok) {
        const detail = (await response.text().catch(() => "")).trim();
        throw new Error(detail || `Request failed with status ${response.status}`);
      }

      const pdfBlob = await response.blob();
      downloadBlobFile(`${exportBaseName}.pdf`, pdfBlob);
      announce("PDF export downloaded.", "success");
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? `PDF export failed: ${error.message}`
          : "PDF export failed.";
      announce(message, "error");
    } finally {
      setExportingPdf(false);
    }
  }

  if (loading || !loaded) return <div className="text-sm text-muted-foreground">Loading...</div>;
  if (error) return <div className="text-sm text-muted-foreground">{error}</div>;

  return (
    <div className="max-w-7xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Build exportable Intel reports from the current visible ledger history. Tune the window,
          audience, ranking depth, and included sections, then export a machine-readable package.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <Card className="border-border/60 bg-card/80 xl:sticky xl:top-4 xl:self-start">
          <CardHeader className="space-y-2">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              <Settings2 className="h-3.5 w-3.5" />
              Report builder
            </div>
            <CardTitle className="text-lg">Customize this report pack</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="report-title">Report title</Label>
              <Input
                id="report-title"
                value={reportTitle}
                onChange={(event) => setReportTitle(event.target.value)}
                placeholder="Radar Intel Situational Report"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <div className="space-y-2">
                <Label htmlFor="report-window">History window</Label>
                <Select
                  id="report-window"
                  value={reportWindow}
                  onChange={(event) => setReportWindow(event.target.value as RadarLedgerWindow)}
                >
                  {RADAR_LEDGER_WINDOW_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="report-audience">Audience</Label>
                <Select
                  id="report-audience"
                  value={audience}
                  onChange={(event) => setAudience(event.target.value as ReportAudience)}
                >
                  {AUDIENCE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
                <p className="text-xs text-muted-foreground">{activeAudienceHelper}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rank-limit">Ranking depth</Label>
              <Select
                id="rank-limit"
                value={String(rankLimit)}
                onChange={(event) => setRankLimit(Number(event.target.value))}
              >
                {RANK_LIMIT_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    Top {option}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-3">
              <Label>Sections included</Label>
              <div className="space-y-2">
                {SECTION_OPTIONS.map((section) => (
                  <SectionToggle
                    key={section.key}
                    label={section.label}
                    helper={section.helper}
                    checked={sections[section.key]}
                    onChange={() => toggleSection(section.key)}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2 rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
              <p className="text-sm font-medium text-foreground">Export actions</p>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                <Button variant="outline" onClick={exportJson}>
                  <Download className="h-4 w-4" />
                  Export JSON
                </Button>
                <Button variant="outline" onClick={exportCsv}>
                  <FileText className="h-4 w-4" />
                  Export CSV
                </Button>
                <Button variant="outline" onClick={copyBrief}>
                  <Copy className="h-4 w-4" />
                  Copy brief
                </Button>
                <Button variant="outline" onClick={exportPdf} disabled={exportingPdf}>
                  <Printer className="h-4 w-4" />
                  {exportingPdf ? "Generating PDF..." : "Export PDF"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {status?.message ?? "Exports include the currently visible report scope and settings."}
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="overflow-hidden border-border/60 bg-[radial-gradient(circle_at_top_left,rgba(167,139,250,0.18),transparent_45%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0))]">
            <CardContent className="space-y-6 p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    <FileText className="h-3.5 w-3.5" />
                    Report preview
                  </div>
                  <div>
                    <h2 className="text-3xl font-semibold tracking-tight text-foreground">
                      {reportTitle}
                    </h2>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                      {narrative}
                    </p>
                  </div>
                </div>
                <div className="grid shrink-0 gap-2 text-sm text-muted-foreground">
                  <div className="rounded-lg border border-border/60 bg-black/10 px-3 py-2">
                    Window: <span className="font-medium text-foreground">{windowLabel(reportWindow)}</span>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-black/10 px-3 py-2">
                    Audience: <span className="font-medium text-foreground capitalize">{audience}</span>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-black/10 px-3 py-2">
                    Generated: <span className="font-medium text-foreground">{formatDate(generatedAt)}</span>
                  </div>
                </div>
              </div>

              {page.count > page.pageCount && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                  This report reflects the currently loaded visible ledger slice. The backend reports
                  more records than are loaded into this client session, so exported results may be a
                  partial report pack.
                </div>
              )}
            </CardContent>
          </Card>

          {sections.overview && (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <MetricCard
                label="Alerts in scope"
                value={summary.totalAlerts}
                helper={windowDescription(reportWindow)}
              />
              <MetricCard
                label="Providers tracked"
                value={summary.providersTracked}
                helper="Unique providers attributed in the report set"
              />
              <MetricCard
                label="Active alerts"
                value={summary.activeAlerts}
                helper="Still open in the visible report scope"
              />
              <MetricCard
                label="Critical alerts"
                value={summary.criticalAlerts}
                helper="Highest-severity findings in the report scope"
              />
              <MetricCard
                label="Coverage incidents"
                value={summary.coverageAlerts}
                helper="Radar-side observability interruptions"
              />
              <MetricCard
                label="Providers with active issues"
                value={providerHealth.providersWithActiveIssues}
                helper={`${providerHealth.healthyProviders} providers currently healthy`}
              />
            </div>
          )}

          {sections.hotspots && (
            <Card className="border-border/60">
              <CardHeader className="space-y-2">
                <CardTitle className="text-lg">Hotspots and concentration</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Ranked concentration across providers, chains, monitor mix, and individual object
                  hotspots.
                </p>
              </CardHeader>
              <CardContent className="grid gap-4 xl:grid-cols-2">
                <RankedList
                  title="Top providers"
                  buckets={summary.topProviders}
                  emptyLabel="No provider activity in this report window."
                  accentClassName="bg-violet-500"
                />
                <RankedList
                  title="Top chains"
                  buckets={summary.topChains}
                  emptyLabel="No chain activity in this report window."
                  accentClassName="bg-blue-500"
                />
                <RankedList
                  title="Monitor mix"
                  buckets={summary.topMonitorTypes}
                  emptyLabel="No monitor activity in this report window."
                  accentClassName="bg-amber-500"
                />
                <RankedList
                  title="Object hotspots"
                  buckets={hotspots.byObject.slice(0, rankLimit).map((row) => ({
                    label: row.label,
                    count: row.totalAlerts,
                  }))}
                  emptyLabel="No object hotspots in this report window."
                  accentClassName="bg-emerald-500"
                />
              </CardContent>
            </Card>
          )}

          {sections.providerHealth && (
            <Card className="border-border/60">
              <CardHeader className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 p-2 text-emerald-300">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Provider health panel</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Current condition and observability-ranked provider rows for the report scope.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-red-300">
                    {providerHealth.criticalProviders} critical
                  </span>
                  <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-amber-200">
                    {providerHealth.degradedProviders} degraded
                  </span>
                  <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-emerald-300">
                    {providerHealth.healthyProviders} healthy
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ProviderHealthTable rows={providerRows} />
              </CardContent>
            </Card>
          )}

          {sections.activity && (
            <Card className="border-border/60">
              <CardHeader className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="rounded-full border border-blue-500/20 bg-blue-500/10 p-2 text-blue-300">
                    <Activity className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Activity snapshot</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Flow and carry-over metrics from the visible report ledger slice.
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  label="Recorded activity"
                  value={activitySummary.recordedActivityTotal}
                  helper="Total visible ledger records in scope"
                />
                <MetricCard
                  label="Findings opened"
                  value={activitySummary.findingsOpenedTotal}
                  helper="New findings opened in the timeline"
                />
                <MetricCard
                  label="Resolved findings"
                  value={activitySummary.resolvedFindingsTotal}
                  helper="Findings that closed inside the report scope"
                />
                <MetricCard
                  label="Active backlog"
                  value={activitySummary.activeBacklogTotal}
                  helper="Unresolved findings at the end of the report window"
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {status && <ExportToast status={status} />}
    </div>
  );
}
