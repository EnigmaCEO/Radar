"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { listAlerts } from "@/lib/api";
import type { RadarAlert, RadarSeverity, RadarMonitorType } from "@/lib/api-types";
import { sortAlertsBySeverityAndCreatedAt } from "@/lib/alert-feed";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { formatDate } from "@/lib/utils";

function SeverityBadge({ severity }: { severity: RadarSeverity }) {
  const variant = severity === "critical" ? "critical" : severity === "warning" ? "warning" : "watch";
  return <Badge variant={variant as "critical" | "warning" | "watch"}>{severity}</Badge>;
}

function MonitorTypeBadge({ type }: { type: RadarMonitorType }) {
  return <Badge variant="secondary" className="font-mono text-xs">{type}</Badge>;
}

const SEVERITY_CARD_CLASSES: Record<RadarSeverity, string> = {
  critical: "border-l-4 border-l-red-500 bg-red-50/50 dark:bg-red-950/20 border-y-border/60 border-r-border/60",
  warning: "border-l-4 border-l-orange-500 bg-orange-50/40 dark:bg-orange-950/10 border-y-border/60 border-r-border/60",
  watch: "border-l-4 border-l-yellow-500 border-y-border/60 border-r-border/60",
};

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<RadarAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [severity, setSeverity] = useState<string>("");
  const [monitorType, setMonitorType] = useState<string>("");
  const [status, setStatus] = useState<string>("active");

  async function load() {
    setLoading(true);
    try {
      const data = await listAlerts({
        status: status || undefined,
        severity: severity || undefined,
        monitorType: monitorType || undefined,
        limit: 100,
      });
      setAlerts(sortAlertsBySeverityAndCreatedAt(data));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [severity, monitorType, status]);

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Alerts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {alerts.length} alert{alerts.length !== 1 ? "s" : ""} matching filters
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`mr-2 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
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

      {/* Alert list */}
      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : alerts.length === 0 ? (
        <Card className="border-border/60">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No alerts match the current filters.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <Card key={alert.id} className={SEVERITY_CARD_CLASSES[alert.severity]}>
              <CardContent className="py-4 px-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <AlertTriangle
                      className={`mt-0.5 h-4 w-4 shrink-0 ${
                        alert.severity === "critical"
                          ? "text-red-500"
                          : alert.severity === "warning"
                          ? "text-orange-500"
                          : "text-yellow-500"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{alert.summary}</p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {alert.oracle && (
                          <span className="text-xs text-muted-foreground">
                            Oracle: {alert.oracle}
                          </span>
                        )}
                        {alert.bridge && (
                          <span className="text-xs text-muted-foreground">
                            Bridge: {alert.bridge}
                          </span>
                        )}
                        {alert.asset && (
                          <span className="text-xs text-muted-foreground">
                            Asset: {alert.asset}
                          </span>
                        )}
                        {alert.chain && (
                          <span className="text-xs text-muted-foreground">
                            Chain: {alert.chain}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <span className="text-xs text-muted-foreground">
                          {formatDate(alert.createdAt)}
                        </span>
                        {alert.evidenceUrl && (
                          <a
                            href={alert.evidenceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary underline underline-offset-4"
                          >
                            Evidence
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <SeverityBadge severity={alert.severity} />
                    <MonitorTypeBadge type={alert.monitorType} />
                    <span
                      className={`text-xs ${
                        alert.status === "active"
                          ? "text-primary"
                          : "text-muted-foreground"
                      }`}
                    >
                      {alert.status}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
