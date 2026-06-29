"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Bell, Eye } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { listAlerts, getClientEntitlements, listWatchlists } from "@/lib/api";
import type { RadarAlert, RadarClientEntitlementSummary, RadarWatchlist } from "@/lib/api-types";
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
  const { me } = useAuth();
  const clientId = me?.activeAccount?.id ?? me?.memberships[0]?.account?.id ?? "";

  const [alerts, setAlerts] = useState<RadarAlert[]>([]);
  const [entitlements, setEntitlements] = useState<RadarClientEntitlementSummary | null>(null);
  const [watchlists, setWatchlists] = useState<RadarWatchlist[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientId) return;
    Promise.all([
      listAlerts({ status: "active", limit: 5 }),
      getClientEntitlements(clientId),
      listWatchlists(clientId),
    ])
      .then(([a, e, w]) => {
        setAlerts(a);
        setEntitlements(e);
        setWatchlists(w);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [clientId]);

  const criticalCount = alerts.filter((a) => a.severity === "critical").length;
  const warningCount = alerts.filter((a) => a.severity === "warning").length;
  const watchCount = alerts.filter((a) => a.severity === "watch").length;

  if (loading) {
    return <div className="text-muted-foreground text-sm">Loading…</div>;
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {me?.activeAccount?.name ?? "Your account"} · Plan:{" "}
          <span className="font-medium capitalize">
            {entitlements?.plan.replace("_", " ") ?? "—"}
          </span>
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{alerts.length}</div>
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Watchlists</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{watchlists.length}</div>
            {entitlements?.watchlistsLimit != null && (
              <div className="text-xs text-muted-foreground mt-1">
                of {entitlements.watchlistsLimit} limit
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Delivery channels
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1 mt-1">
              {entitlements?.discordEnabled && <Badge variant="secondary">Discord</Badge>}
              {entitlements?.telegramEnabled && <Badge variant="secondary">Telegram</Badge>}
              {entitlements?.webhookEnabled && <Badge variant="secondary">Webhook</Badge>}
              {!entitlements?.liveDeliveryEnabled && (
                <span className="text-xs text-muted-foreground">Not enabled on this plan</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Alert history
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{entitlements?.alertHistoryDays ?? 1}</div>
            <div className="text-xs text-muted-foreground mt-1">days</div>
          </CardContent>
        </Card>
      </div>

      {/* Upgrade CTA for free plan */}
      {entitlements?.plan === "free" && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="flex items-center justify-between pt-6">
            <div>
              <p className="font-medium text-sm">Upgrade to Radar Live</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Get watchlists, real-time Discord and Telegram delivery.
              </p>
            </div>
            <Button size="sm" asChild>
              <Link href="/dashboard/settings/billing">
                Upgrade <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Recent alerts */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Recent alerts</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/alerts">
              View all <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </div>
        {alerts.length === 0 ? (
          <Card className="border-border/60">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No active alerts — all infrastructure is healthy.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {alerts.slice(0, 5).map((alert) => (
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

      {/* Quick links */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="border-border/60 hover:border-primary/40 transition-colors">
          <Link href="/dashboard/watchlists">
            <CardContent className="flex items-center gap-3 pt-4 pb-4">
              <Eye className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Manage watchlists</p>
                <p className="text-xs text-muted-foreground">Filter alerts to your dependencies</p>
              </div>
            </CardContent>
          </Link>
        </Card>
        <Card className="border-border/60 hover:border-primary/40 transition-colors">
          <Link href="/dashboard/destinations">
            <CardContent className="flex items-center gap-3 pt-4 pb-4">
              <Bell className="h-5 w-5 text-primary" />
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
