"use client";

import { type ReactNode } from "react";
import { useAccount } from "@/lib/account-context";
import {
  buildProviderReliabilityRowsWithOptions,
  PROVIDER_RELIABILITY_DEFAULT_WINDOW_LABEL,
  type ProviderConditionPattern,
  type ProviderCurrentCondition,
  type ProviderReliabilityRow,
} from "@/lib/intel-analytics";
import { useRadarLedgerHistory } from "@/lib/radar-ledger-context";
import { filterLedgerAlertsByWindow } from "@/lib/radar-ledger";
import { getProviderBrand } from "@/lib/provider-branding";
import { getPlanLabel } from "@/lib/plan-limits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LocalDateTime } from "@/components/local-time";

export const PROVIDER_RELIABILITY_HISTORY_WINDOW = "30d" as const;
export const PROVIDER_RELIABILITY_DEGRADED_LABEL =
  "Providers with degraded condition history";

function observabilityTone(score: number): string {
  if (score >= 90) return "text-emerald-400 border-emerald-500/20 bg-emerald-500/10";
  if (score >= 70) return "text-amber-300 border-amber-500/20 bg-amber-500/10";
  return "text-red-400 border-red-500/20 bg-red-500/10";
}

function confidenceTone(confidence: ProviderReliabilityRow["confidence"]): string {
  if (confidence === "high") return "text-emerald-300";
  if (confidence === "medium") return "text-amber-300";
  return "text-slate-300";
}

function currentConditionTone(condition: ProviderCurrentCondition): string {
  if (condition === "Critical") {
    return "text-red-400 border-red-500/20 bg-red-500/10";
  }
  if (condition === "Degraded") {
    return "text-amber-300 border-amber-500/20 bg-amber-500/10";
  }
  if (condition === "Stable") {
    return "text-emerald-400 border-emerald-500/20 bg-emerald-500/10";
  }
  return "text-slate-300 border-border/70 bg-muted/30";
}

function patternTone(pattern: ProviderConditionPattern): string {
  if (pattern === "Persistent") {
    return "text-red-400 border-red-500/20 bg-red-500/10";
  }
  if (pattern === "Recurring") {
    return "text-amber-300 border-amber-500/20 bg-amber-500/10";
  }
  if (pattern === "Clean") {
    return "text-emerald-400 border-emerald-500/20 bg-emerald-500/10";
  }
  return "text-slate-300 border-border/70 bg-muted/30";
}

function formatPercent(value: number): string {
  return `${value}%`;
}

function formatDurationHours(value: number): string {
  if (value <= 0) return "0m";
  if (value < 1) return `${Math.max(1, Math.round(value * 60))}m`;
  if (value < 24) return `${Math.round(value * 10) / 10}h`;
  const days = Math.round((value / 24) * 10) / 10;
  return `${days}d`;
}

function MetricCell({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground/80">{label}</p>
      <p className={`mt-1 truncate text-xs ${valueClassName ?? "text-muted-foreground"}`}>{value}</p>
    </div>
  );
}

function ProviderIdentity({ provider }: { provider: string }) {
  const brand = getProviderBrand(provider);

  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/70 bg-background">
        {brand.iconSrc ? (
          <img
            src={brand.iconSrc}
            alt={`${brand.displayName} icon`}
            className="h-6 w-6 object-contain"
          />
        ) : (
          <span className="text-[11px] font-semibold tracking-[0.18em] text-muted-foreground">
            {brand.monogram}
          </span>
        )}
      </div>
      <p className="truncate text-sm font-medium">{brand.displayName}</p>
    </div>
  );
}

export function ProviderReliabilityView({
  loading,
  planLabel,
  rows,
}: {
  loading: boolean;
  planLabel: string;
  rows: ProviderReliabilityRow[];
}) {
  const patternAssessedProviders = rows.filter(
    (row) => row.patternLabel !== "Insufficient evidence",
  );
  const cleanPatternProviders = rows.filter((row) => row.patternLabel === "Clean").length;
  const degradedProviders = rows.filter(
    (row) => row.patternLabel === "Recurring" || row.patternLabel === "Persistent",
  ).length;

  if (loading) return <div className="text-sm text-muted-foreground">Loading...</div>;

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Provider reliability</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Historical provider condition evidence and Radar observability percentages across the{" "}
          <span className="font-medium">{PROVIDER_RELIABILITY_DEFAULT_WINDOW_LABEL}</span> visible
          to <span className="font-medium">{planLabel}</span>.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Providers tracked
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{rows.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pattern assessed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {patternAssessedProviders.length} of {rows.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Clean 30-day pattern
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{cleanPatternProviders}</div>
            <p className="mt-1 text-xs text-muted-foreground">Among providers with enough evidence</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {PROVIDER_RELIABILITY_DEGRADED_LABEL}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{degradedProviders}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60">
        <CardContent className="pt-6 text-sm text-muted-foreground">
          Provider conditions use only verified or approved provider-side findings. Coverage gaps,
          missing adapters, read failures, unavailable sources, unresolved metadata, and other
          Radar-side failures affect observability only and never degrade the provider condition
          labels.
        </CardContent>
      </Card>

      {rows.length === 0 ? (
        <Card className="border-border/60">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No provider condition or observability data is visible in the{" "}
            {PROVIDER_RELIABILITY_DEFAULT_WINDOW_LABEL}.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <Card key={row.provider} className="border-border/60">
              <CardContent className="space-y-4 px-4 py-4">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                  <div className="min-w-0 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <ProviderIdentity provider={row.provider} />
                      {row.dominantMonitorType && (
                        <span className="rounded-full border border-border/70 px-2 py-0.5 text-xs text-muted-foreground">
                          {row.dominantMonitorType}
                        </span>
                      )}
                    </div>
                    <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 xl:grid-cols-4">
                      <MetricCell
                        label="Verified findings"
                        value={String(row.verifiedFindings)}
                      />
                      <MetricCell
                        label="Approved findings"
                        value={String(row.approvedFindings)}
                      />
                      <MetricCell
                        label="Observations"
                        value={String(row.observationCount)}
                      />
                      <MetricCell
                        label="Confidence"
                        value={row.confidence}
                        valueClassName={confidenceTone(row.confidence)}
                      />
                      <MetricCell
                        label="Active incidents"
                        value={String(row.activeIncidents)}
                      />
                      <MetricCell
                        label="Critical findings"
                        value={String(row.criticalFindings)}
                      />
                      <MetricCell
                        label="Median duration"
                        value={formatDurationHours(row.medianDurationHours)}
                      />
                      <MetricCell
                        label="Longest duration"
                        value={formatDurationHours(row.longestDurationHours)}
                      />
                      <MetricCell
                        label="Recovery rate"
                        value={formatPercent(row.recoveryRate)}
                      />
                      <MetricCell
                        label="Recurrence"
                        value={formatPercent(row.recurrenceRate)}
                      />
                      <MetricCell
                        label="Coverage incidents"
                        value={String(row.coverageIncidents)}
                      />
                      <MetricCell
                        label="Window"
                        value={row.scoringWindowLabel}
                      />
                      {row.latestEventAt && (
                        <div className="sm:col-span-2 xl:col-span-4">
                          <MetricCell
                            label="Latest event"
                            value={<LocalDateTime value={row.latestEventAt} preset="compact" />}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-start gap-2 lg:min-w-[234px] lg:items-stretch">
                    <div
                      className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-sm font-medium ${currentConditionTone(row.currentCondition)}`}
                    >
                      Current condition: {row.currentCondition}
                    </div>
                    <div
                      className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-sm font-medium ${patternTone(row.patternLabel)}`}
                    >
                      30-day pattern: {row.patternLabel}
                    </div>
                    <div
                      className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-sm font-medium ${observabilityTone(row.observabilityScore)}`}
                    >
                      Observability: {formatPercent(row.observabilityScore)}
                    </div>
                  </div>
                </div>

                <details className="rounded-md border border-border/60 bg-muted/10 px-3 py-2 text-xs">
                  <summary className="cursor-pointer list-none font-medium text-foreground">
                    Evidence details
                  </summary>
                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    <div>
                      <p className="font-medium text-foreground">Condition evidence</p>
                      <ul className="mt-2 space-y-1 text-muted-foreground">
                        <li>current condition - {row.currentCondition}</li>
                        <li>30-day pattern - {row.patternLabel}</li>
                        <li>qualified findings - {row.findingsEvaluated}</li>
                        <li>resolved findings - {row.resolvedFindings}</li>
                        <li>median duration - {formatDurationHours(row.medianDurationHours)}</li>
                        <li>longest duration - {formatDurationHours(row.longestDurationHours)}</li>
                        <li>recovery rate - {formatPercent(row.recoveryRate)}</li>
                        <li>recurrence rate - {formatPercent(row.recurrenceRate)}</li>
                        <li>observations - {row.observationCount}</li>
                        <li>coverage incidents - {row.coverageIncidents}</li>
                        <li>excluded records - {row.excludedRecords}</li>
                      </ul>
                      {row.conditionFactors.length === 0 ? (
                        <p className="mt-2 text-muted-foreground">
                          No verified or approved provider-side findings were available in this
                          scoring window.
                        </p>
                      ) : null}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Observability evidence</p>
                      <ul className="mt-2 space-y-1 text-muted-foreground">
                        <li>observability score - {formatPercent(row.observabilityScore)}</li>
                        <li>expected observations - {row.observationCount}</li>
                        <li>successful observations - {row.successfulObservations}</li>
                        <li>failed or unknown observations - {row.failedObservations}</li>
                        <li>coverage incidents - {row.coverageIncidents}</li>
                        <li>excluded records - {row.excludedRecords}</li>
                      </ul>
                      {row.observabilityFactors.length === 0 ? (
                        <p className="mt-2 text-muted-foreground">
                          No attributed observability incidents were recorded in this scoring
                          window.
                        </p>
                      ) : null}
                    </div>
                  </div>
                </details>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProviderReliabilityPage() {
  const { account } = useAccount();
  const { page, loading, loaded } = useRadarLedgerHistory();
  const alerts = filterLedgerAlertsByWindow(page.alerts, PROVIDER_RELIABILITY_HISTORY_WINDOW);

  const rows = buildProviderReliabilityRowsWithOptions(alerts, {
    scoringWindowLabel: PROVIDER_RELIABILITY_DEFAULT_WINDOW_LABEL,
  });

  return (
    <ProviderReliabilityView
      loading={loading || !loaded}
      planLabel={getPlanLabel(account.plan, account.isAdmin, account.adminViewPlan)}
      rows={rows}
    />
  );
}
