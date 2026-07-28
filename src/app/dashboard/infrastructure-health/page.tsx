"use client";

import { useState } from "react";
import { buildInfrastructureHealthSummary, type InfrastructureHealthSummary, type IntelSummaryBucket } from "@/lib/intel-analytics";
import { useRadarLedgerHistory } from "@/lib/radar-ledger-context";
import { RADAR_LEDGER_WINDOW_OPTIONS, type RadarLedgerWindow } from "@/lib/radar-ledger";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const DEFAULT_INFRASTRUCTURE_WINDOW: RadarLedgerWindow = "14d";

const FINDINGS_TIMELINE_SERIES: Array<{
  key: "criticalOpened" | "warningOpened" | "watchOpened";
  label: string;
  fill: string;
}> = [
  { key: "criticalOpened", label: "Critical", fill: "bg-red-500" },
  { key: "warningOpened", label: "Warning", fill: "bg-orange-500" },
  { key: "watchOpened", label: "Watch", fill: "bg-blue-500" },
];

function longDayLabel(dateKey: string): string {
  return new Date(`${dateKey}T00:00:00.000Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function daysForWindow(window: RadarLedgerWindow): number | null {
  if (window === "all") return null;
  return Number.parseInt(window, 10);
}

function windowDescription(window: RadarLedgerWindow): string {
  if (window === "all") return "all visible recorded history";
  return `the last ${window.slice(0, -1)} days`;
}

function windowHistoryLabel(window: RadarLedgerWindow): string {
  if (window === "all") return "Visible history";
  return `${window} history`;
}

function buildBacklogTicks(maxValue: number): number[] {
  if (maxValue <= 0) return [0];

  const roughStep = Math.max(1, Math.ceil(maxValue / 4));
  const magnitude = 10 ** Math.max(0, Math.floor(Math.log10(roughStep)));
  const normalized = roughStep / magnitude;
  const niceStep =
    normalized <= 1
      ? 1
      : normalized <= 2
        ? 2
        : normalized <= 5
          ? 5
          : 10;
  const step = niceStep * magnitude;
  const ceiling = Math.ceil(maxValue / step) * step;
  const ticks: number[] = [];

  for (let value = ceiling; value >= 0; value -= step) {
    ticks.push(value);
  }

  if (ticks[ticks.length - 1] !== 0) ticks.push(0);
  return ticks;
}

function ChartLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {FINDINGS_TIMELINE_SERIES.map((series) => (
        <span key={series.key} className="inline-flex items-center gap-1.5">
          <span className={`h-2 w-2 shrink-0 rounded-full ${series.fill}`} aria-hidden />
          <span>{series.label}</span>
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span className="h-0.5 w-3 shrink-0 rounded-full bg-violet-400" aria-hidden />
        <span>Backlog</span>
      </span>
      <span>Coverage incidents stay in the summary cards above.</span>
    </div>
  );
}

function HistoryBucketList({
  title,
  buckets,
  emptyLabel,
}: {
  title: string;
  buckets: IntelSummaryBucket[];
  emptyLabel: string;
}) {
  const maxCount = buckets.reduce((max, bucket) => Math.max(max, bucket.count), 0);

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {buckets.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyLabel}</p>
        ) : (
          buckets.map((bucket) => {
            const widthPct = maxCount > 0 ? Math.max(4, (bucket.count / maxCount) * 100) : 0;
            return (
              <div key={bucket.label} className="space-y-1.5">
                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="truncate">{bucket.label}</span>
                  <span className="shrink-0 text-muted-foreground">{bucket.count}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted/60">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${widthPct}%` }} />
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

function InfrastructureTimelineChart({
  summary,
  truncated,
}: {
  summary: InfrastructureHealthSummary;
  truncated: boolean;
}) {
  const maxFindingsOpened = summary.timeline.reduce(
    (max, point) => Math.max(max, point.totalFindingsOpened),
    0,
  );
  const maxBacklog = summary.timeline.reduce(
    (max, point) => Math.max(max, point.backlogFindings),
    0,
  );
  const labelEvery = Math.max(1, Math.ceil(summary.timeline.length / 8));
  const historyStartIndex =
    summary.firstRecordedDateKey === null
      ? -1
      : summary.timeline.findIndex((point) => point.dateKey === summary.firstRecordedDateKey);
  const historyStartPct =
    historyStartIndex <= 0 || summary.timeline.length <= 1
      ? 0
      : (historyStartIndex / (summary.timeline.length - 1)) * 100;
  const backlogCoordinates = summary.timeline.map((point, index) => {
    const x = summary.timeline.length <= 1 ? 50 : (index / (summary.timeline.length - 1)) * 100;
    const y =
      maxBacklog > 0
        ? 100 - (point.backlogFindings / maxBacklog) * 100
        : 100;
    return { x, y, backlog: point.backlogFindings };
  });
  const backlogStepPath = backlogCoordinates.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`;
    return `${path} H ${point.x} V ${point.y}`;
  }, "");
  const historyStartStyle =
    historyStartPct <= 4
      ? { left: "0%", transform: "translateX(0)" }
      : historyStartPct >= 96
        ? { left: "100%", transform: "translateX(-100%)" }
        : { left: `${historyStartPct}%`, transform: "translateX(-50%)" };
  const backlogTicks = buildBacklogTicks(maxBacklog);
  const hasFindingsData = maxFindingsOpened > 0;
  const hasBacklogData = maxBacklog > 0;
  const hasChartData = hasFindingsData || hasBacklogData;

  return (
    <Card className="border-border/60">
      <CardHeader className="space-y-2">
        <div>
          <CardTitle className="text-base">Findings opened and backlog</CardTitle>
          <p className="text-xs text-muted-foreground">
            Findings opened are separated from the unresolved backlog so flow and remaining pressure
            read as two different signals.
          </p>
        </div>
        <ChartLegend />
      </CardHeader>
      <CardContent className="space-y-4">
        {hasChartData ? (
          <>
            <div className="space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-4 text-[11px] uppercase tracking-[0.16em] text-muted-foreground/80">
                  <span>Findings opened</span>
                  <span>{summary.findingsOpenedTotal} total</span>
                </div>
                <div className="relative">
                  <div
                    className="flex h-36 items-end gap-0.5"
                    role="img"
                    aria-label="Findings opened by severity over time"
                  >
                    {summary.timeline.map((point) => {
                      const heightPct =
                        maxFindingsOpened > 0 ? (point.totalFindingsOpened / maxFindingsOpened) * 100 : 0;
                      return (
                        <div
                          key={point.dateKey}
                          className="flex h-full min-w-0 flex-1 flex-col justify-end"
                          title={`${point.label}: ${point.totalFindingsOpened} findings opened, ${point.coverageOpened} coverage incidents, ${point.resolvedFindings} findings resolved, ${point.backlogFindings} active backlog`}
                        >
                          <div
                            className="flex w-full flex-col-reverse gap-px overflow-hidden rounded-t-[3px]"
                            style={{ height: `${heightPct}%` }}
                          >
                            {FINDINGS_TIMELINE_SERIES.map((series) => {
                              const value = point[series.key];
                              if (value <= 0 || point.totalFindingsOpened <= 0) return null;
                              return (
                                <div
                                  key={series.key}
                                  className={series.fill}
                                  style={{ height: `${(value / point.totalFindingsOpened) * 100}%` }}
                                />
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {historyStartIndex >= 0 && summary.firstRecordedLabel && (
                    <>
                      <div
                        className="pointer-events-none absolute inset-y-0 border-l border-dashed border-emerald-400/80"
                        style={{ left: `${historyStartPct}%` }}
                        aria-hidden
                      />
                      <div
                        className="pointer-events-none absolute -top-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300"
                        style={historyStartStyle}
                      >
                        History begins
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-4 text-[11px] uppercase tracking-[0.16em] text-muted-foreground/80">
                  <span>Active backlog</span>
                  <span>End-of-day unresolved findings, carried until the next change</span>
                </div>
                <div className="flex gap-3">
                  <div className="flex h-24 w-8 flex-col justify-between text-right text-[10px] text-muted-foreground">
                    {backlogTicks.map((tick) => (
                      <span key={tick}>{tick}</span>
                    ))}
                  </div>
                  <div className="relative h-24 flex-1 rounded-md border border-border/60 bg-muted/10 px-2 py-2">
                    {hasBacklogData ? (
                      <svg
                        viewBox="0 0 100 100"
                        preserveAspectRatio="none"
                        className="absolute inset-0 h-full w-full overflow-visible px-2 py-2"
                        role="img"
                        aria-label="Active backlog over time"
                      >
                        {backlogTicks.map((tick) => {
                          const y = maxBacklog > 0 ? 100 - (tick / maxBacklog) * 100 : 100;
                          return (
                            <line
                              key={tick}
                              x1="0"
                              y1={y}
                              x2="100"
                              y2={y}
                              stroke="rgba(148, 163, 184, 0.18)"
                              strokeWidth="0.8"
                              strokeDasharray={tick === 0 ? undefined : "2 2"}
                            />
                          );
                        })}
                        <path
                          d={backlogStepPath}
                          fill="none"
                          stroke="rgb(167 139 250)"
                          strokeWidth="2.5"
                          strokeLinejoin="round"
                          strokeLinecap="round"
                        />
                        {backlogCoordinates.map((point, index) => (
                          <circle
                            key={`${point.x}-${index}`}
                            cx={point.x}
                            cy={point.y}
                            r="1.1"
                            fill="rgb(167 139 250)"
                          >
                            <title>{`${summary.timeline[index]?.label ?? "Day"}: ${point.backlog} active backlog`}</title>
                          </circle>
                        ))}
                      </svg>
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                        No unresolved backlog in this window.
                      </div>
                    )}

                    {historyStartIndex >= 0 && summary.firstRecordedLabel && (
                      <div
                        className="pointer-events-none absolute inset-y-0 border-l border-dashed border-emerald-400/60"
                        style={{ left: `${historyStartPct}%` }}
                        aria-hidden
                      />
                    )}
                  </div>
                </div>
                {hasBacklogData && (
                  <div className="flex justify-end text-[10px] text-muted-foreground">
                    Max backlog: {maxBacklog}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-0.5" aria-hidden>
              {summary.timeline.map((point, index) => (
                <div
                  key={point.dateKey}
                  className="min-w-0 flex-1 truncate text-center text-[10px] text-muted-foreground"
                >
                  {index % labelEvery === 0 ? point.label : ""}
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No ledger activity is visible in this window.</p>
        )}

        <div className="border-t border-border/60 pt-3 text-xs text-muted-foreground">
          {summary.firstRecordedDateKey ? (
            <p>
              Recorded history begins on <span className="font-medium text-foreground">{longDayLabel(summary.firstRecordedDateKey)}</span>.
              {truncated ? " The loaded ledger is truncated, so earlier visible records may exist." : ""}
            </p>
          ) : (
            <p>No recorded history is currently visible.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function InfrastructureHealthPage() {
  const { page, loading, loaded, error } = useRadarLedgerHistory();
  const [window, setWindow] = useState<RadarLedgerWindow>(DEFAULT_INFRASTRUCTURE_WINDOW);
  const summary = buildInfrastructureHealthSummary(page.alerts, daysForWindow(window));
  const truncated = page.count > page.pageCount;

  if (loading || !loaded) return <div className="text-sm text-muted-foreground">Loading...</div>;
  if (error) return <div className="text-sm text-muted-foreground">{error}</div>;

  return (
    <div className="max-w-5xl space-y-6">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Infrastructure health trends</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Aggregate alert openings, recoveries, and coverage interruptions across{" "}
            {windowDescription(window)}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2" aria-label="Infrastructure history window">
          {RADAR_LEDGER_WINDOW_OPTIONS.map((option) => (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant={window === option.value ? "default" : "outline"}
              aria-pressed={window === option.value}
              onClick={() => setWindow(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Recorded activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{summary.recordedActivityTotal}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Findings opened
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{summary.findingsOpenedTotal}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active backlog
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{summary.activeBacklogTotal}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Coverage incidents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{summary.coverageIncidentsTotal}</div>
          </CardContent>
        </Card>
      </div>

      <InfrastructureTimelineChart summary={summary} truncated={truncated} />

      <div className="grid gap-4 lg:grid-cols-2">
        <HistoryBucketList
          title={`Recorded activity by monitor type (${windowHistoryLabel(window)})`}
          buckets={summary.historyByMonitor}
          emptyLabel="No monitor activity is visible in this window."
        />
        <HistoryBucketList
          title={`Recorded activity by chain (${windowHistoryLabel(window)})`}
          buckets={summary.historyByChain}
          emptyLabel="No chain activity is visible in this window."
        />
      </div>
    </div>
  );
}
