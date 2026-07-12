"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Bell, Eye } from "lucide-react";
import { useAccount } from "@/lib/account-context";
import { getRadarCatalog, listAlerts } from "@/lib/api";
import { isCoverageGapAlert } from "@/lib/alert-classification";
import {
  allowsPrivateWatchlists,
  canConfigurePrivateDestinations,
  getPlanLabel,
  getPrivateHistoryDays,
  resolvePlan,
} from "@/lib/plan-limits";
import {
  EMPTY_DASHBOARD_ALERT_SUMMARY,
  loadDashboardAlertSummary,
} from "@/lib/alert-feed";
import { formatAlertLifecycle } from "@/lib/alert-time";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LocalDateTime } from "@/components/local-time";

function SeverityBadge({ severity }: { severity: string }) {
  const variant =
    severity === "critical" ? "critical" : severity === "warning" ? "warning" : "watch";
  return <Badge variant={variant as "critical" | "warning" | "watch"}>{severity}</Badge>;
}

function StatusBadge({ status }: { status: string }) {
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

function CoverageStatusBadge({ status }: { status: string }) {
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

type ObservabilityState = {
  totalObjects: number;
  observableObjects: number;
  activeCoverageGaps: number;
} | null;

export default function DashboardPage() {
  const { account } = useAccount();
  const resolvedPlan = resolvePlan(account.plan);
  const privateHistoryDays = getPrivateHistoryDays(account.plan);
  const [alertSummary, setAlertSummary] = useState(EMPTY_DASHBOARD_ALERT_SUMMARY);
  const [observability, setObservability] = useState<ObservabilityState>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void Promise.allSettled([
      loadDashboardAlertSummary(listAlerts),
      getRadarCatalog(),
      listAlerts({
        status: "active",
        limit: 200,
      }),
    ])
      .then(([summaryResult, catalogResult, activeAlertsResult]) => {
        if (cancelled) return;

        if (summaryResult.status === "fulfilled") {
          setAlertSummary(summaryResult.value);
        }

        if (
          catalogResult.status === "fulfilled" &&
          activeAlertsResult.status === "fulfilled"
        ) {
          const activeCoverageGaps = activeAlertsResult.value.filter((alert) =>
            isCoverageGapAlert(alert),
          ).length;
          setObservability({
            totalObjects: catalogResult.value.objects.length,
            observableObjects: Math.max(
              0,
              catalogResult.value.objects.length - activeCoverageGaps,
            ),
            activeCoverageGaps,
          });
        } else {
          setObservability(null);
        }
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) setObservability(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const { criticalCount, recentActivity, totalActiveAlerts, warningCount, watchCount } =
    alertSummary;

  if (loading) return <div className="text-sm text-muted-foreground">Loading...</div>;

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {account.name || "Your account"} -{" "}
          <span className="font-medium">{getPlanLabel(account.plan)}</span>
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
              Observability
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {observability ? `${observability.observableObjects}/${observability.totalObjects}` : "n/a"}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {observability
                ? `${observability.activeCoverageGaps} active coverage gap${
                    observability.activeCoverageGaps === 1 ? "" : "s"
                  }`
                : "Catalog coverage unavailable"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Plan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{getPlanLabel(account.plan)}</div>
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
              {privateHistoryDays === null ? "Contract" : privateHistoryDays}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {privateHistoryDays === null ? "history window" : "days"}
            </div>
          </CardContent>
        </Card>
      </div>

      {resolvedPlan !== "desk" &&
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
              "Track up to 5 private objects and receive direct push alerts.",
            ],
            radar_signal: [
              "Upgrade to Signal",
              "Correlate private exposure across up to 25 objects with webhook delivery and 90-day history.",
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

      {!allowsPrivateWatchlists(account.plan) && (
        <Card className="border-border/60">
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Private object monitoring starts on Watch. Public Record and Intel do not include private watchlists.
          </CardContent>
        </Card>
      )}

      <div>
        <div className="mb-3 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold">Recent alert activity</h2>
            {recentActivity.length > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                Showing the latest openings and recoveries across your visible history
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
              <Card key={alert.id} className="border-border/60">
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

      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="border-border/60 transition-colors hover:border-violet-600/40">
          <Link href="/dashboard/watchlists">
            <CardContent className="flex items-center gap-3 pb-4 pt-4">
              <Eye className="h-5 w-5 text-violet-500" />
              <div>
                <p className="text-sm font-medium">Manage watchlists</p>
                <p className="text-xs text-muted-foreground">Organize your private monitored objects</p>
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
                  {canConfigurePrivateDestinations(account.plan)
                    ? "Configure Discord, Telegram, or webhook delivery"
                    : "Available on private monitoring plans"}
                </p>
              </div>
            </CardContent>
          </Link>
        </Card>
      </div>
    </div>
  );
}
