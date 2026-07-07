"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Bell, Eye } from "lucide-react";
import { useAccount } from "@/lib/account-context";
import { listAlerts } from "@/lib/api";
import {
  EMPTY_DASHBOARD_ALERT_SUMMARY,
  loadDashboardAlertSummary,
} from "@/lib/alert-feed";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

function SeverityBadge({ severity }: { severity: string }) {
  const variant =
    severity === "critical" ? "critical" : severity === "warning" ? "warning" : "watch";
  return <Badge variant={variant as "critical" | "warning" | "watch"}>{severity}</Badge>;
}

export default function DashboardPage() {
  const { account } = useAccount();
  const [alertSummary, setAlertSummary] = useState(EMPTY_DASHBOARD_ALERT_SUMMARY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardAlertSummary(listAlerts)
      .then(setAlertSummary)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const { criticalCount, recentAlerts, totalActiveAlerts, warningCount, watchCount } = alertSummary;

  if (loading) return <div className="text-muted-foreground text-sm">Loading...</div>;

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {account.name || "Your account"} ·{" "}
          <span className="font-medium capitalize">{account.plan.replace("_", " ")}</span>
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalActiveAlerts}</div>
            <div className="flex gap-2 mt-1">
              {criticalCount > 0 && (
                <span className="text-xs text-red-500">{criticalCount} critical</span>
              )}
              {warningCount > 0 && (
                <span className="text-xs text-orange-500">{warningCount} warning</span>
              )}
              {watchCount > 0 && (
                <span className="text-xs text-yellow-500">{watchCount} watch</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Plan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold capitalize">{account.plan.replace("_", " ")}</div>
            <div className="text-xs text-muted-foreground mt-1 capitalize">{account.status}</div>
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
              {account.plan === "managed"
                ? 365
                : account.plan === "radar_pro"
                  ? 30
                  : account.plan === "radar_live"
                    ? 7
                    : 1}
            </div>
            <div className="text-xs text-muted-foreground mt-1">days</div>
          </CardContent>
        </Card>
      </div>

      {account.plan !== "managed" &&
        (() => {
          const next =
            account.plan === "free"
              ? "radar_live"
              : account.plan === "radar_live"
                ? "radar_pro"
                : "managed";
          const labels: Record<string, [string, string]> = {
            radar_live: [
              "Upgrade to Radar Live",
              "Get watchlists, real-time Discord and Telegram delivery.",
            ],
            radar_pro: [
              "Upgrade to Radar Pro",
              "10 watchlists, 10 destinations, webhooks, 30-day history.",
            ],
            managed: [
              "Managed plan",
              "Unlimited everything, 365-day history, dedicated support.",
            ],
          };
          const [title, desc] = labels[next];

          return (
            <Card className="border-violet-600/40 bg-violet-600/5">
              <CardContent className="flex items-center justify-between pt-6">
                <div>
                  <p className="font-medium text-sm">{title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                </div>
                {next === "managed" ? (
                  <Button
                    size="sm"
                    className="bg-violet-600 hover:bg-violet-700 text-white"
                    asChild
                  >
                    <a href="mailto:hello@sagitta.systems?subject=Radar Managed Plan">
                      Talk to us <ArrowRight className="ml-1 h-3 w-3" />
                    </a>
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="bg-violet-600 hover:bg-violet-700 text-white"
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

      <div>
        <div className="flex items-center justify-between mb-3 gap-4">
          <div>
            <h2 className="font-semibold">Recent alerts</h2>
            {totalActiveAlerts > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {recentAlerts.length < totalActiveAlerts
                  ? `Showing ${recentAlerts.length} of ${totalActiveAlerts} active alerts`
                  : `Showing all ${totalActiveAlerts} active alerts`}
              </p>
            )}
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/alerts">
              View all <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </div>
        {totalActiveAlerts === 0 ? (
          <Card className="border-border/60">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No active alerts - all infrastructure is healthy.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {recentAlerts.map((alert) => (
              <Card key={alert.id} className="border-border/60">
                <CardContent className="py-3 px-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <AlertTriangle
                      className={`h-4 w-4 shrink-0 ${
                        alert.severity === "critical"
                          ? "text-red-500"
                          : alert.severity === "warning"
                            ? "text-orange-500"
                            : "text-yellow-500"
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{alert.summary}</p>
                      <p className="text-xs text-muted-foreground">
                        {alert.monitorType} · {formatDate(alert.createdAt)}
                      </p>
                    </div>
                  </div>
                  <SeverityBadge severity={alert.severity} />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="border-border/60 hover:border-violet-600/40 transition-colors">
          <Link href="/dashboard/watchlists">
            <CardContent className="flex items-center gap-3 pt-4 pb-4">
              <Eye className="h-5 w-5 text-violet-500" />
              <div>
                <p className="text-sm font-medium">Manage watchlists</p>
                <p className="text-xs text-muted-foreground">Filter alerts to your dependencies</p>
              </div>
            </CardContent>
          </Link>
        </Card>
        <Card className="border-border/60 hover:border-violet-600/40 transition-colors">
          <Link href="/dashboard/destinations">
            <CardContent className="flex items-center gap-3 pt-4 pb-4">
              <Bell className="h-5 w-5 text-violet-500" />
              <div>
                <p className="text-sm font-medium">Delivery destinations</p>
                <p className="text-xs text-muted-foreground">
                  Configure Discord, Telegram, or webhook
                </p>
              </div>
            </CardContent>
          </Link>
        </Card>
      </div>
    </div>
  );
}
