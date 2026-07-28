import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { getAdminViewPlanFromRequest } from "@/lib/admin-plan-override-server";
import {
  fetchSceAlerts,
  SceAlertsError,
} from "@/lib/sce-alerts";
import type { RadarAlertPage } from "@/lib/api-types";
import {
  canAccessDashboardAlerts,
  getDashboardAlertHistoryDays,
  resolvePlan,
} from "@/lib/plan-limits";
import { bootstrapRadarAccount } from "@/lib/radar-api-backend";
import {
  fetchLedgerHistory,
  isWithinHistoryWindow,
  parseLedgerWindow,
  toRadarAlert,
  toRadarAlertFromLedger,
  windowStartForLedger,
} from "@/lib/radar-alert-data";

const DEFAULT_LEDGER_LIMIT = 5000;
const MAX_LEDGER_LIMIT = 5000;

export async function GET(request: NextRequest) {
  const session = await auth0.getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await bootstrapRadarAccount(session);
  const adminViewPlan = account.isAdmin ? getAdminViewPlanFromRequest(request) : null;
  if (!canAccessDashboardAlerts(account.plan, account.isAdmin, adminViewPlan)) {
    const resolvedPlan = resolvePlan(account.plan, account.isAdmin, adminViewPlan);
    return NextResponse.json(
      {
        error:
          resolvedPlan === "public_record"
            ? "Dashboard alert history requires a Watch, Intel, Signal, or Desk plan."
            : "Dashboard alert history is unavailable for this plan.",
      },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? undefined;
  const severity = searchParams.get("severity") ?? undefined;
  const monitorType = searchParams.get("monitor_type") ?? undefined;
  const historyMode = searchParams.get("history_mode") === "ledger" ? "ledger" : "snapshot";
  const limitParam = Number(
    searchParams.get("limit") ?? (historyMode === "ledger" ? String(DEFAULT_LEDGER_LIMIT) : "100"),
  );
  const limit = Number.isFinite(limitParam)
    ? Math.max(1, Math.min(limitParam, historyMode === "ledger" ? MAX_LEDGER_LIMIT : 200))
    : historyMode === "ledger"
      ? DEFAULT_LEDGER_LIMIT
      : 100;

  try {
    const historyDays = getDashboardAlertHistoryDays(
      account.plan,
      account.isAdmin,
      adminViewPlan,
    );
    const now = new Date();
    let responseBody: RadarAlertPage;

    if (historyMode === "ledger") {
      const ledger = await fetchLedgerHistory({
        since: windowStartForLedger({
          window: parseLedgerWindow(searchParams.get("window")),
          historyDays,
          accountCreatedAt: account.createdAt,
          now,
        }),
        until: now.toISOString(),
        limit,
        monitorType,
        status,
      });
      const alerts = ledger.events
        .map(toRadarAlertFromLedger)
        .filter((alert) => (severity ? alert.severity === severity : true));

      responseBody = {
        alerts,
        count: severity ? alerts.length : ledger.count,
        pageCount: alerts.length,
      };
    } else {
      const alerts = (await fetchSceAlerts({ status, limit }))
        .filter((alert) => (severity ? alert.severity === severity : true))
        .filter((alert) => (monitorType ? alert.monitorType === monitorType : true))
        .filter((alert) =>
          historyDays === null ? true : isWithinHistoryWindow(alert, historyDays, now),
        )
        .map(toRadarAlert);

      responseBody = {
        alerts,
        count: alerts.length,
        pageCount: alerts.length,
      };
    }

    return NextResponse.json(responseBody, {
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
