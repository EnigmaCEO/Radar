import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { getAdminViewPlanFromRequest } from "@/lib/admin-plan-override-server";
import type { RadarAlertPage } from "@/lib/api-types";
import { fetchSceAlerts, SceAlertsError } from "@/lib/sce-alerts";
import {
  canAccessDashboardAlerts,
  getDashboardAlertHistoryDays,
  resolvePlan,
} from "@/lib/plan-limits";
import {
  fetchLedgerHistory,
  isWithinHistoryWindow,
  parseLedgerWindow,
  toRadarAlert,
  toRadarAlertFromLedger,
  windowStartForLedger,
} from "@/lib/radar-alert-data";
import {
  bootstrapRadarAccount,
  forwardRadarApiRequest,
} from "@/lib/radar-api-backend";
import type { SceCatalogResponse } from "@/lib/sce-catalog-types";
import type { DashboardBootstrapPayload } from "@/lib/dashboard-bootstrap-types";

const SNAPSHOT_LIMIT = 200;
const LEDGER_LIMIT = 5000;
const EMPTY_ALERT_PAGE: RadarAlertPage = {
  alerts: [],
  count: 0,
  pageCount: 0,
};
const EMPTY_CATALOG: SceCatalogResponse = {
  objects: [],
  filters: {
    providers: [],
    chains: [],
    assets: [],
    tags: [],
    statuses: [],
  },
};

export async function GET(request: NextRequest) {
  try {
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

    const resolvedPlan = resolvePlan(account.plan, account.isAdmin, adminViewPlan);
    const historyDays = getDashboardAlertHistoryDays(
      account.plan,
      account.isAdmin,
      adminViewPlan,
    );
    const now = new Date();

    const shouldLoadLedger = resolvedPlan === "radar_intel";
    const shouldLoadSnapshot = resolvedPlan !== "radar_intel";

    const [snapshotResult, ledgerResult, catalogResult] = await Promise.allSettled([
      shouldLoadSnapshot ? fetchSceAlerts({ limit: SNAPSHOT_LIMIT }) : Promise.resolve([]),
      shouldLoadLedger
        ? fetchLedgerHistory({
            since: windowStartForLedger({
              window: parseLedgerWindow("all"),
              historyDays,
              accountCreatedAt: account.createdAt,
              now,
            }),
            until: now.toISOString(),
            limit: LEDGER_LIMIT,
          })
        : Promise.resolve({ events: [], count: 0 }),
      forwardRadarApiRequest("/v1/radar/catalog", {
        method: "GET",
        session,
      }),
    ]);

    const snapshotAlerts =
      snapshotResult.status === "fulfilled" ? snapshotResult.value : [];
    if (snapshotResult.status === "rejected") {
      console.warn("Dashboard bootstrap snapshot fetch failed:", snapshotResult.reason);
    }

    const ledger =
      ledgerResult.status === "fulfilled" ? ledgerResult.value : { events: [], count: 0 };
    if (ledgerResult.status === "rejected") {
      console.warn("Dashboard bootstrap ledger fetch failed:", ledgerResult.reason);
    }

    let catalog = EMPTY_CATALOG;
    if (catalogResult.status === "fulfilled") {
      const catalogResponse = catalogResult.value;
      if (catalogResponse.ok) {
        try {
          catalog = (await catalogResponse.json()) as SceCatalogResponse;
        } catch (error) {
          console.warn("Dashboard bootstrap catalog parse failed:", error);
        }
      } else {
        console.warn(`Dashboard bootstrap catalog request failed (${catalogResponse.status}).`);
      }
    } else {
      console.warn("Dashboard bootstrap catalog fetch failed:", catalogResult.reason);
    }

    const visibleSnapshotAlerts = shouldLoadSnapshot
      ? snapshotAlerts.filter((alert) =>
          historyDays === null ? true : isWithinHistoryWindow(alert, historyDays, now),
        )
      : [];
    const snapshotPage: RadarAlertPage = shouldLoadSnapshot
      ? {
          alerts: visibleSnapshotAlerts.map(toRadarAlert),
          count: visibleSnapshotAlerts.length,
          pageCount: visibleSnapshotAlerts.length,
        }
      : EMPTY_ALERT_PAGE;
    const ledgerPage: RadarAlertPage = shouldLoadLedger
      ? {
          alerts: ledger.events.map(toRadarAlertFromLedger),
          count: ledger.count,
          pageCount: ledger.events.length,
        }
      : EMPTY_ALERT_PAGE;

    const payload: DashboardBootstrapPayload = {
      snapshotPage,
      ledgerPage,
      catalog,
    };

    return NextResponse.json(payload, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof SceAlertsError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    console.error("Dashboard bootstrap error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
