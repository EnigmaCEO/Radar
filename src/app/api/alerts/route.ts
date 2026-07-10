import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { fetchSceAlerts, SceAlertsError, type SceAlert } from "@/lib/sce-alerts";
import type { RadarAlert, RadarMonitorType, RadarSeverity, RadarStatus } from "@/lib/api-types";

function toSeverity(value: string): RadarSeverity {
  if (value === "critical" || value === "warning" || value === "watch") {
    return value;
  }
  return "watch";
}

function toStatus(value: string): RadarStatus {
  if (value === "active" || value === "resolved" || value === "superseded") {
    return value;
  }
  return "active";
}

function toMonitorType(value: string): RadarMonitorType {
  if (
    value === "oracle" ||
    value === "bridge" ||
    value === "governance" ||
    value === "sce_heartbeat" ||
    value === "dependency" ||
    value === "lp"
  ) {
    return value;
  }
  return "dependency";
}

function toRadarAlert(alert: SceAlert): RadarAlert {
  return {
    id: alert.id,
    dedupeKey: alert.id,
    monitorType: toMonitorType(alert.monitorType),
    source: alert.provider,
    severity: toSeverity(alert.severity),
    status: toStatus(alert.status),
    confidence: 1,
    summary: alert.publicSummary ?? alert.summary,
    reasonCode: alert.reasonCode,
    visibility: "private",
    provenance: "live",
    signalClass: alert.signalClass ?? undefined,
    createdAt: alert.createdAt,
    updatedAt: alert.updatedAt,
    publicSummary: alert.publicSummary ?? undefined,
    oracle: alert.monitorType === "oracle" ? alert.provider : undefined,
    bridge: alert.monitorType === "bridge" ? alert.provider : undefined,
    asset: alert.asset ?? undefined,
    assetPair: alert.assetPair ?? undefined,
    chain: alert.chain ?? undefined,
    route: alert.route ?? undefined,
    poolName: alert.poolName ?? undefined,
    objectId: alert.objectId ?? undefined,
    thresholdName: alert.thresholdName ?? undefined,
    observedValueLabel: alert.observedValueLabel ?? undefined,
    thresholdValueLabel: alert.thresholdValueLabel ?? undefined,
    whatHappened: alert.whatHappened ?? undefined,
    whyItMatters: alert.whyItMatters ?? undefined,
    radarStatus: alert.radarStatus ?? undefined,
    evidenceExplanation: alert.evidenceExplanation ?? undefined,
    lastSuccessfulObservationAt: alert.lastSuccessfulObservationAt ?? undefined,
    lastObservationAttemptAt: alert.lastObservationAttemptAt ?? undefined,
    consecutiveFailedCycles: alert.consecutiveFailedCycles ?? undefined,
    objectState: alert.objectState ?? undefined,
    failureCause: alert.failureCause ?? undefined,
    coverageTier: alert.coverageTier ?? undefined,
    openedAt: alert.openedAt ?? undefined,
    resolvedAt: alert.resolvedAt ?? undefined,
  };
}

export async function GET(request: NextRequest) {
  const session = await auth0.getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? undefined;
  const severity = searchParams.get("severity") ?? undefined;
  const monitorType = searchParams.get("monitor_type") ?? undefined;
  const limitParam = Number(searchParams.get("limit") ?? "100");
  const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(limitParam, 200)) : 100;

  try {
    const alerts = await fetchSceAlerts({ status, limit });
    const filtered = alerts
      .filter((alert) => (severity ? alert.severity === severity : true))
      .filter((alert) => (monitorType ? alert.monitorType === monitorType : true))
      .map(toRadarAlert);

    return NextResponse.json(filtered, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof SceAlertsError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    console.error("Alerts proxy error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
