"use client";

import Link from "next/link";
import { Activity, AlertTriangle, ArrowRight, Bell, Eye, FileText, ShieldCheck } from "lucide-react";
import { useAccount } from "@/lib/account-context";
import { isCoverageGapAlert } from "@/lib/alert-classification";
import { coverageGapStatusLabel, isDisabledAlertStatus } from "@/lib/alert-status";
import {
  allowsPrivateWatchlists,
  canConfigurePrivateDestinations,
  getDashboardAlertHistoryDays,
  getPlanLabel,
  resolvePlan,
} from "@/lib/plan-limits";
import {
  collapseAlertsToLatestState,
  summarizeDashboardAlerts,
} from "@/lib/alert-feed";
import { buildProviderReliabilityRowsWithOptions } from "@/lib/intel-analytics";
import { filterLedgerAlertsByWindow } from "@/lib/radar-ledger";
import { useRadarLedgerHistory } from "@/lib/radar-ledger-context";
import { formatAlertLifecycle } from "@/lib/alert-time";
import type { RadarAlert, RadarStatus } from "@/lib/api-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LocalDateTime } from "@/components/local-time";

const CLOSED_STATUS_CLASS = "border border-slate-500/20 bg-slate-500/10 text-slate-300";

function SeverityBadge({ severity }: { severity: string }) {
  const variant =
    severity === "critical" ? "critical" : severity === "warning" ? "warning" : "watch";
  return <Badge variant={variant as "critical" | "warning" | "watch"}>{severity}</Badge>;
}

function StatusBadge({ status }: { status: RadarStatus }) {
  const className =
    status === "resolved"
      ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
      : status === "superseded" || isDisabledAlertStatus(status)
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

type ObservabilityState = {
  totalObjects: number;
  observableObjects: number;
  activeCoverageGaps: number;
};

type ProviderHealthState = {
  trackedProviders: number;
  providersWithActiveIssues: number;
  criticalProviders: number;
  degradedProviders: number;
  healthyProviders: number;
};

function summarizeIntelProviderHealth(alerts: RadarAlert[]): ProviderHealthState {
  const rows = buildProviderReliabilityRowsWithOptions(
    filterLedgerAlertsByWindow(alerts, "30d"),
    { scoringWindowLabel: "30d history window" },
  );
  const criticalProviders = rows.filter((row) => row.currentCondition === "Critical").length;
  const degradedProviders = rows.filter((row) => row.currentCondition === "Degraded").length;
  const healthyProviders = rows.filter(
    (row) => row.currentCondition === "Stable" || row.currentCondition === "No active issues",
  ).length;

  return {
    trackedProviders: rows.length,
    providersWithActiveIssues: criticalProviders + degradedProviders,
    criticalProviders,
    degradedProviders,
    healthyProviders,
  };
}

export default function DashboardPage() {
  const { account } = useAccount();
  const { snapshotPage, ledgerPage, catalog, loading, loaded, error } = useRadarLedgerHistory();
  const resolvedPlan = resolvePlan(account.plan, account.isAdmin, account.adminViewPlan);
  const dashboardHistoryDays = getDashboardAlertHistoryDays(
    account.plan,
    account.isAdmin,
    account.adminViewPlan,
  );
  const isIntelView = resolvedPlan === "radar_intel";
  const overviewAlerts = isIntelView
    ? collapseAlertsToLatestState(ledgerPage.alerts)
    : snapshotPage.alerts;
  const activeAlerts = overviewAlerts.filter((alert) => alert.status === "active");
  const alertSummary = summarizeDashboardAlerts(activeAlerts, overviewAlerts);
  const observability: ObservabilityState = {
    totalObjects: catalog.objects.length,
    observableObjects: Math.max(
      0,
      catalog.objects.length - activeAlerts.filter((alert) => isCoverageGapAlert(alert)).length,
    ),
    activeCoverageGaps: activeAlerts.filter((alert) => isCoverageGapAlert(alert)).length,
  };
  const providerHealth = isIntelView
    ? summarizeIntelProviderHealth(ledgerPage.alerts)
    : null;
  const { criticalCount, recentActivity, totalActiveAlerts, warningCount, watchCount } = alertSummary;

  if (loading || !loaded) return <div className="text-sm text-muted-foreground">Loading...</div>;
  if (error) return <div className="text-sm text-muted-foreground">{error}</div>;

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {account.name || "Your account"} -{" "}
          <span className="font-medium">{getPlanLabel(account.plan, account.isAdmin, account.adminViewPlan)}</span>
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalActiveAlerts}</div>
            <div className="mt-1 flex gap-2">
              {criticalCount > 0 && <span className="text-xs text-red-500">{criticalCount} critical</span>}
              {warningCount > 0 && <span className="text-xs text-orange-500">{warningCount} warning</span>}
              {watchCount > 0 && <span className="text-xs text-blue-500">{watchCount} watch</span>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {isIntelView ? "Provider health" : "Observability"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isIntelView && providerHealth ? (
              <>
                <div className="text-3xl font-bold">
                  {providerHealth.trackedProviders === 0
                    ? "No data"
                    : `${providerHealth.healthyProviders}/${providerHealth.trackedProviders}`}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {providerHealth.trackedProviders === 0
                    ? "No provider condition data in the 30d history window"
                    : "healthy providers in the 30d history window"}
                </div>
                {providerHealth.trackedProviders > 0 && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    {`${providerHealth.criticalProviders} critical · ${providerHealth.degradedProviders} degraded · ${providerHealth.providersWithActiveIssues} with active issues`}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="text-3xl font-bold">
                  {`${observability.observableObjects}/${observability.totalObjects}`}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {`${observability.activeCoverageGaps} active coverage gap${
                    observability.activeCoverageGaps === 1 ? "" : "s"
                  }`}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Plan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{getPlanLabel(account.plan, account.isAdmin, account.adminViewPlan)}</div>
            <div className="mt-1 text-xs capitalize text-muted-foreground">{account.status}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Alert history
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {isIntelView
                ? "Aggregate"
                : dashboardHistoryDays === null
                  ? "Contract"
                  : dashboardHistoryDays}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {isIntelView
                ? "deep history"
                : dashboardHistoryDays === null
                  ? "history window"
                  : "days"}
            </div>
          </CardContent>
        </Card>
      </div>

      {resolvedPlan !== "desk" && resolvedPlan !== "internal" &&
        (() => {
          const next =
            resolvedPlan === "public_record"
              ? "watch"
              : resolvedPlan === "watch"
                ? "radar_signal"
                : "desk";
          const labels: Record<string, [string, string]> = {
            watch: [
              "Upgrade to Watch",
              "Monitor one asset lens or up to 5 exact objects with direct alerts and 30-day history.",
            ],
            radar_signal: [
              "Upgrade to Signal",
              "Monitor the full standard catalog with correlation, webhook delivery, and 90-day private history.",
            ],
            desk: [
              "Move to Desk",
              "Contracted monitoring, raw history, signed receipts, and human review.",
            ],
          };
          const [title, desc] = labels[next];

          return (
            <Card className="border-violet-600/40 bg-violet-600/5">
              <CardContent className="flex items-center justify-between pt-6">
                <div>
                  <p className="text-sm font-medium">{title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
                </div>
                {next === "desk" ? (
                  <Button
                    size="sm"
                    className="bg-violet-600 text-white hover:bg-violet-700"
                    asChild
                  >
                    <a href="mailto:radar@sagitta.systems?subject=Radar Desk Plan">
                      Talk to us <ArrowRight className="ml-1 h-3 w-3" />
                    </a>
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="bg-violet-600 text-white hover:bg-violet-700"
                    onClick={async () => {
                      const res = await fetch("/api/stripe/checkout", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ plan: next }),
                      });
                      const data = await res.json();
                      if (data.url) window.location.href = data.url;
                    }}
                  >
                    Upgrade <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })()}

      {!allowsPrivateWatchlists(account.plan, account.isAdmin, account.adminViewPlan) && (
        <Card className="border-border/60">
          <CardContent className="pt-6 text-sm text-muted-foreground">
            {isIntelView
              ? "Intel is aggregate-only. Private watchlists and private alert destinations start on Watch or Signal."
              : "Private monitoring starts on Watch. Public Record and Intel do not include private watchlists."}
          </CardContent>
        </Card>
      )}

      <div>
        <div className="mb-3 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold">Recent alert activity</h2>
            {recentActivity.length > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                Showing the latest openings and closures across your visible history
              </p>
            )}
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/alerts">
              View all <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </div>
        {recentActivity.length === 0 ? (
          <Card className="border-border/60">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No alert activity is visible in your current history window.
            </CardContent>
          </Card>
        ) : (
            <div className="space-y-2">
              {recentActivity.map((alert) => (
              <Card key={alert.dedupeKey} className="border-border/60">
                <CardContent className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <AlertTriangle
                      className={`h-4 w-4 shrink-0 ${
                        isCoverageGapAlert(alert)
                          ? "text-slate-300"
                          : alert.severity === "critical"
                            ? "text-red-500"
                            : alert.severity === "warning"
                              ? "text-orange-500"
                              : "text-blue-500"
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{alert.summary}</p>
                      <p className="text-xs text-muted-foreground">
                        {isCoverageGapAlert(alert) ? "coverage gap" : alert.monitorType} -{" "}
                        <LocalDateTime value={alert.openedAt ?? alert.createdAt} preset="compact" /> -{" "}
                        {formatAlertLifecycle(alert)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isCoverageGapAlert(alert) && <SeverityBadge severity={alert.severity} />}
                    {isCoverageGapAlert(alert) ? (
                      <CoverageStatusBadge status={alert.status} />
                    ) : (
                      <StatusBadge status={alert.status} />
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {isIntelView ? (
        <div className="grid gap-3 lg:grid-cols-3">
          <Card className="border-border/60 transition-colors hover:border-violet-600/40">
            <Link href="/dashboard/provider-reliability">
              <CardContent className="flex items-center gap-3 pb-4 pt-4">
                <ShieldCheck className="h-5 w-5 text-violet-500" />
                <div>
                  <p className="text-sm font-medium">Provider reliability</p>
                  <p className="text-xs text-muted-foreground">
                    Compare aggregate provider burden and active incident pressure
                  </p>
                </div>
              </CardContent>
            </Link>
          </Card>
          <Card className="border-border/60 transition-colors hover:border-violet-600/40">
            <Link href="/dashboard/infrastructure-health">
              <CardContent className="flex items-center gap-3 pb-4 pt-4">
                <Activity className="h-5 w-5 text-violet-500" />
                <div>
                  <p className="text-sm font-medium">Infrastructure health trends</p>
                  <p className="text-xs text-muted-foreground">
                    Track daily openings, recoveries, and coverage interruptions
                  </p>
                </div>
              </CardContent>
            </Link>
          </Card>
          <Card className="border-border/60 transition-colors hover:border-violet-600/40">
            <Link href="/dashboard/reports">
              <CardContent className="flex items-center gap-3 pb-4 pt-4">
                <FileText className="h-5 w-5 text-violet-500" />
                <div>
                  <p className="text-sm font-medium">Reports</p>
                  <p className="text-xs text-muted-foreground">
                    Weekly and monthly aggregate summaries across the visible history window
                  </p>
                </div>
              </CardContent>
            </Link>
          </Card>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Card className="border-border/60 transition-colors hover:border-violet-600/40">
            <Link href="/dashboard/watchlists">
              <CardContent className="flex items-center gap-3 pb-4 pt-4">
                <Eye className="h-5 w-5 text-violet-500" />
                <div>
                  <p className="text-sm font-medium">Manage watchlists</p>
                  <p className="text-xs text-muted-foreground">Choose focused scopes across assets, providers, chains, or the full catalog</p>
                </div>
              </CardContent>
            </Link>
          </Card>
          <Card className="border-border/60 transition-colors hover:border-violet-600/40">
            <Link href="/dashboard/destinations">
              <CardContent className="flex items-center gap-3 pb-4 pt-4">
                <Bell className="h-5 w-5 text-violet-500" />
                <div>
                  <p className="text-sm font-medium">Delivery destinations</p>
                  <p className="text-xs text-muted-foreground">
                    {canConfigurePrivateDestinations(account.plan, account.isAdmin, account.adminViewPlan)
                      ? "Configure Discord, Telegram, or webhook delivery"
                      : "Available on private monitoring plans"}
                  </p>
                </div>
              </CardContent>
            </Link>
          </Card>
        </div>
      )}
    </div>
  );
}
