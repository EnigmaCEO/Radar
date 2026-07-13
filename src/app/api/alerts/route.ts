import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { fetchSceAlerts, SceAlertsError, type SceAlert } from "@/lib/sce-alerts";
import type { RadarAlert, RadarMonitorType, RadarSeverity, RadarStatus } from "@/lib/api-types";
import { allowsPrivateWatchlists, getPrivateHistoryDays, resolvePlan } from "@/lib/plan-limits";
import { bootstrapRadarAccount } from "@/lib/radar-api-backend";

function toSeverity(value: string): RadarSeverity {
  if (value === "critical" || value === "warning" || value === "watch") {
    return value;
  }
  return "watch";
}

function toStatus(value: string): RadarStatus {
  if (value === "active" || value === "resolved" || value === "superseded" || value === "disabled") {
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
    declaredHeartbeatSeconds: alert.declaredHeartbeatSeconds ?? undefined,
    appliedThresholdSeconds: alert.appliedThresholdSeconds ?? undefined,
    appliedThresholdKind: alert.appliedThresholdKind ?? undefined,
    thresholdSourceLabel: alert.thresholdSourceLabel ?? undefined,
    evidenceState: alert.evidenceState ?? undefined,
    publicVerificationState: alert.publicVerificationState ?? undefined,
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

function isWithinHistoryWindow(alert: SceAlert, historyDays: number, now: Date): boolean {
  if (alert.status === "active") return true;

  const cutoff = now.getTime() - historyDays * 24 * 60 * 60 * 1000;
  const candidateTimestamp =
    alert.resolvedAt ??
    alert.updatedAt ??
    alert.openedAt ??
    alert.createdAt;
  const timestamp = new Date(candidateTimestamp).getTime();
  return Number.isFinite(timestamp) && timestamp >= cutoff;
}

export async function GET(request: NextRequest) {
  const session = await auth0.getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await bootstrapRadarAccount(session);
  if (!allowsPrivateWatchlists(account.plan, account.isAdmin)) {
    const resolvedPlan = resolvePlan(account.plan, account.isAdmin);
    return NextResponse.json(
      {
        error:
          resolvedPlan === "radar_intel"
            ? "Intel does not include private object alert history."
            : "Private alert history requires a Watch, Signal, or Desk plan.",
      },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? undefined;
  const severity = searchParams.get("severity") ?? undefined;
  const monitorType = searchParams.get("monitor_type") ?? undefined;
  const limitParam = Number(searchParams.get("limit") ?? "100");
  const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(limitParam, 200)) : 100;

  try {
    const historyDays = getPrivateHistoryDays(account.plan, account.isAdmin);
    const alerts = await fetchSceAlerts({ status, limit });
    const filtered = alerts
      .filter((alert) => (severity ? alert.severity === severity : true))
      .filter((alert) => (monitorType ? alert.monitorType === monitorType : true))
      .filter((alert) => (historyDays === null ? true : isWithinHistoryWindow(alert, historyDays, new Date())))
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
