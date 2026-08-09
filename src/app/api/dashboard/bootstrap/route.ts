import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { getAdminViewPlanFromRequest } from "@/lib/admin-plan-override-server";
import type { RadarAlertPage } from "@/lib/api-types";
import { fetchSceAlertCollection, SceAlertsError } from "@/lib/sce-alerts";
import {
  alertDataError,
  mapAlertCollection,
  toPublicAlertEnvelope,
} from "@/lib/alert-data-state";
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
// A page this account's plan does not use. `state` is deliberately omitted:
// nothing was checked, so neither "empty" nor "unavailable" would be true.
const NOT_REQUESTED_ALERT_PAGE: RadarAlertPage = {
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

    // Each section is loaded independently so one failing source cannot blank
    // the others, and — critically — cannot be silently rewritten as an empty
    // result. `fetchSceAlertCollection` and `fetchLedgerHistory` already return
    // an explicit state rather than throwing, so no `allSettled` branch here
    // converts a rejection into `[]`.
    const [snapshotResult, ledgerResult, catalogResult] = await Promise.all([
      shouldLoadSnapshot
        ? fetchSceAlertCollection({ limit: SNAPSHOT_LIMIT, surface: "dashboard-bootstrap" })
        : Promise.resolve(null),
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
            surface: "dashboard-bootstrap",
          })
        : Promise.resolve(null),
      forwardRadarApiRequest("/v1/radar/catalog", {
        method: "GET",
        session,
      }).catch((error: unknown) => {
        console.warn("Dashboard bootstrap catalog fetch failed:", error);
        return null;
      }),
    ]);

    let catalog = EMPTY_CATALOG;
    let catalogAvailable = false;
    if (catalogResult) {
      if (catalogResult.ok) {
        try {
          catalog = (await catalogResult.json()) as SceCatalogResponse;
          catalogAvailable = true;
        } catch (error) {
          console.warn("Dashboard bootstrap catalog parse failed:", error);
        }
      } else {
        console.warn(`Dashboard bootstrap catalog request failed (${catalogResult.status}).`);
      }
    }

    const snapshotPage: RadarAlertPage = snapshotResult
      ? toPublicAlertEnvelope(
          mapAlertCollection(snapshotResult, (alerts) =>
            alerts
              .filter((alert) =>
                historyDays === null ? true : isWithinHistoryWindow(alert, historyDays, now),
              )
              .map(toRadarAlert),
          ),
        )
      : NOT_REQUESTED_ALERT_PAGE;
    const ledgerPage: RadarAlertPage = ledgerResult
      ? toPublicAlertEnvelope(
          mapAlertCollection(ledgerResult, (events) => events.map(toRadarAlertFromLedger)),
          { count: ledgerResult.count },
        )
      : NOT_REQUESTED_ALERT_PAGE;

    const activePage = shouldLoadLedger ? ledgerPage : snapshotPage;

    const payload: DashboardBootstrapPayload = {
      snapshotPage,
      ledgerPage,
      catalog,
      catalogAvailable,
      alertDataState: activePage.state ?? "unavailable",
    };

    // Bootstrap stays 200 even when the alert source is unavailable: it is a
    // composite resource whose other sections remain usable, and its body is
    // never a bare array — every page names its own state.
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof SceAlertsError) {
      return NextResponse.json(
        { error: "Alert data is temporarily unavailable.", alertError: alertDataError(error.code) },
        { status: 502 },
      );
    }
    console.error("Dashboard bootstrap error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
