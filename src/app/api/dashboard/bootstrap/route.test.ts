import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth0", () => ({ auth0: { getSession: vi.fn() } }));
vi.mock("@/lib/sce-alerts", () => ({
  SceAlertsError: class SceAlertsError extends Error {},
  fetchSceAlertCollection: vi.fn(),
  fetchSceAlertLedgerPage: vi.fn(),
}));
vi.mock("@/lib/radar-api-backend", () => ({
  bootstrapRadarAccount: vi.fn(),
  forwardRadarApiRequest: vi.fn(),
}));

import { auth0 } from "@/lib/auth0";
import {
  bootstrapRadarAccount,
  forwardRadarApiRequest,
} from "@/lib/radar-api-backend";
import { fetchSceAlertCollection, type SceAlert } from "@/lib/sce-alerts";
import type { AlertCollectionResult } from "@/lib/alert-data-state";
import { GET } from "./route";

const FETCHED_AT = "2026-08-09T12:00:00.000Z";

const CATALOG = {
  objects: [{ id: "obj-1" }],
  filters: { providers: [], chains: [], assets: [], tags: [], statuses: [] },
};

function mockCatalog(ok: boolean) {
  vi.mocked(forwardRadarApiRequest).mockResolvedValue({
    ok,
    status: ok ? 200 : 503,
    json: async () => CATALOG,
  } as never);
}

function mockAlerts(result: AlertCollectionResult<SceAlert>) {
  vi.mocked(fetchSceAlertCollection).mockResolvedValue(result);
}

async function callRoute() {
  return GET(new NextRequest("http://localhost/api/dashboard/bootstrap"));
}

describe("dashboard bootstrap data state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth0.getSession).mockResolvedValue({ user: { sub: "auth0|1" } } as never);
    vi.mocked(bootstrapRadarAccount).mockResolvedValue({
      plan: "radar_signal",
      isAdmin: false,
      createdAt: "2026-01-01T00:00:00.000Z",
    } as never);
    mockCatalog(true);
  });

  it("15. reports an unavailable alert source instead of an empty snapshot page", async () => {
    mockAlerts({
      state: "unavailable",
      alerts: [],
      source: "sce",
      fetchedAt: FETCHED_AT,
      error: { code: "UPSTREAM_UNAVAILABLE", retryable: true },
    });

    const response = await callRoute();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.alertDataState).toBe("unavailable");
    expect(body.snapshotPage.state).toBe("unavailable");
    expect(body.snapshotPage.error).toEqual({
      code: "UPSTREAM_UNAVAILABLE",
      retryable: true,
    });
  });

  it("preserves the catalog when the alert source fails", async () => {
    mockAlerts({
      state: "unavailable",
      alerts: [],
      source: "sce",
      fetchedAt: FETCHED_AT,
      error: { code: "UPSTREAM_TIMEOUT", retryable: true },
    });

    const body = await (await callRoute()).json();

    expect(body.catalogAvailable).toBe(true);
    expect(body.catalog.objects).toHaveLength(1);
  });

  it("flags an unavailable catalog without suppressing confirmed alerts", async () => {
    mockAlerts({
      state: "empty",
      alerts: [],
      source: "sce",
      fetchedAt: FETCHED_AT,
      lastSuccessfulAt: FETCHED_AT,
    });
    mockCatalog(false);

    const body = await (await callRoute()).json();

    expect(body.catalogAvailable).toBe(false);
    expect(body.catalog.objects).toEqual([]);
    expect(body.alertDataState).toBe("empty");
  });

  it("distinguishes a confirmed empty snapshot from an unavailable one", async () => {
    mockAlerts({
      state: "empty",
      alerts: [],
      source: "sce",
      fetchedAt: FETCHED_AT,
      lastSuccessfulAt: FETCHED_AT,
    });

    const body = await (await callRoute()).json();

    expect(body.snapshotPage.state).toBe("empty");
    expect(body.snapshotPage.lastSuccessfulAt).toBe(FETCHED_AT);
    expect(body.snapshotPage.error).toBeUndefined();
  });

  it("leaves the ledger page stateless when the plan does not request it", async () => {
    mockAlerts({
      state: "available",
      alerts: [],
      source: "sce",
      fetchedAt: FETCHED_AT,
      lastSuccessfulAt: FETCHED_AT,
    });

    const body = await (await callRoute()).json();

    // "not requested" is neither a confirmed empty nor an unavailable read.
    expect(body.ledgerPage.state).toBeUndefined();
  });
});
