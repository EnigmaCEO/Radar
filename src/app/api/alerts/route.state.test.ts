import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth0", () => ({ auth0: { getSession: vi.fn() } }));
vi.mock("@/lib/sce-alerts", () => ({
  SceAlertsError: class SceAlertsError extends Error {},
  fetchSceAlertLedgerPage: vi.fn(),
  fetchSceAlertCollection: vi.fn(),
}));
vi.mock("@/lib/radar-api-backend", () => ({ bootstrapRadarAccount: vi.fn() }));

import { auth0 } from "@/lib/auth0";
import { bootstrapRadarAccount } from "@/lib/radar-api-backend";
import { fetchSceAlertCollection, type SceAlert } from "@/lib/sce-alerts";
import type { AlertCollectionResult } from "@/lib/alert-data-state";
import { GET } from "./route";

const ADMIN_KEY = "super-secret-admin-key";
const FETCHED_AT = "2026-08-09T12:00:00.000Z";

function rawAlert(): SceAlert {
  return {
    id: "RADAR-1",
    monitorType: "oracle",
    provider: "chainlink",
    chain: "Ethereum",
    asset: "ETH/USD",
    route: null,
    objectId: null,
    purpose: null,
    severity: "critical",
    status: "active",
    reasonCode: "ORACLE_STALE",
    summary: "stale price feed",
    createdAt: "2026-08-09T10:00:00.000Z",
    updatedAt: "2026-08-09T11:00:00.000Z",
  } as SceAlert;
}

function mockCollection(result: AlertCollectionResult<SceAlert>) {
  vi.mocked(fetchSceAlertCollection).mockResolvedValue(result);
}

async function callRoute() {
  return GET(new NextRequest("http://localhost/api/alerts"));
}

describe("/api/alerts data-state contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SCE_ADMIN_API_KEY = ADMIN_KEY;
    vi.mocked(auth0.getSession).mockResolvedValue({ user: { sub: "auth0|1" } } as never);
    vi.mocked(bootstrapRadarAccount).mockResolvedValue({
      plan: "radar_signal",
      isAdmin: false,
    } as never);
  });

  it("returns 200 with state `empty` for a confirmed empty collection", async () => {
    mockCollection({
      state: "empty",
      alerts: [],
      source: "sce",
      fetchedAt: FETCHED_AT,
      lastSuccessfulAt: FETCHED_AT,
    });

    const response = await callRoute();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.state).toBe("empty");
    expect(body.alerts).toEqual([]);
    expect(body.lastSuccessfulAt).toBe(FETCHED_AT);
    expect(body.error).toBeUndefined();
  });

  it("returns 200 with an explicitly stale body for a degraded collection", async () => {
    mockCollection({
      state: "degraded",
      alerts: [rawAlert()],
      source: "cache",
      fetchedAt: FETCHED_AT,
      lastSuccessfulAt: "2026-08-09T11:50:00.000Z",
      stale: true,
      cacheAgeSeconds: 600,
      error: { code: "UPSTREAM_TIMEOUT", retryable: true },
    });

    const response = await callRoute();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      state: "degraded",
      source: "cache",
      stale: true,
      cacheAgeSeconds: 600,
      lastSuccessfulAt: "2026-08-09T11:50:00.000Z",
    });
    expect(body.alerts).toHaveLength(1);
  });

  it.each([
    ["UPSTREAM_UNAVAILABLE", 502],
    ["UPSTREAM_RATE_LIMITED", 502],
    ["INVALID_UPSTREAM_RESPONSE", 502],
    ["UPSTREAM_TIMEOUT", 504],
    ["UPSTREAM_UNAUTHORIZED", 503],
    ["CONFIGURATION_ERROR", 503],
  ] as const)("never returns 200 [] for %s (expects %i)", async (code, status) => {
    mockCollection({
      state: "unavailable",
      alerts: [],
      source: "sce",
      fetchedAt: FETCHED_AT,
      error: { code, retryable: code !== "UPSTREAM_UNAUTHORIZED" },
    });

    const response = await callRoute();
    const body = await response.json();

    expect(response.status).toBe(status);
    expect(response.status).not.toBe(200);
    expect(body).toMatchObject({
      state: "unavailable",
      alerts: [],
      error: { code },
    });
  });

  it("16. never exposes the SCE admin key in a failure response", async () => {
    mockCollection({
      state: "unavailable",
      alerts: [],
      source: "sce",
      fetchedAt: FETCHED_AT,
      error: { code: "UPSTREAM_UNAUTHORIZED", retryable: false, requestId: "req-9" },
    });

    const response = await callRoute();
    const text = await response.text();

    expect(text).not.toContain(ADMIN_KEY);
    expect(text).not.toContain("SCE_ADMIN_API_KEY");
    expect(text).not.toContain("continuityengineserver");
  });

  it("17. keeps the legacy alerts/count/pageCount fields on a successful read", async () => {
    mockCollection({
      state: "available",
      alerts: [rawAlert()],
      source: "sce",
      fetchedAt: FETCHED_AT,
      lastSuccessfulAt: FETCHED_AT,
    });

    const response = await callRoute();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.count).toBe(1);
    expect(body.pageCount).toBe(1);
    expect(body.alerts[0]).toMatchObject({ id: "RADAR-1", summary: "stale price feed" });
  });

  it("reports `empty` — not `available` — when filters remove every confirmed alert", async () => {
    mockCollection({
      state: "available",
      alerts: [rawAlert()],
      source: "sce",
      fetchedAt: FETCHED_AT,
      lastSuccessfulAt: FETCHED_AT,
    });

    const response = await GET(
      new NextRequest("http://localhost/api/alerts?severity=warning"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.state).toBe("empty");
    expect(body.alerts).toEqual([]);
  });
});
