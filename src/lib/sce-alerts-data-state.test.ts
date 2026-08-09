import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearAlertCache } from "./alert-cache";
import { getAlertReadCounters, resetAlertReadCounters } from "./alert-telemetry";
import { fetchSceAlertCollection, fetchSceAlertDetail } from "./sce-alerts";

const ORIGINAL_ENV = { ...process.env };
const ADMIN_KEY = "super-secret-admin-key";

function makeRawAlert(overrides: Record<string, unknown> = {}) {
  return {
    id: "RADAR-1",
    monitorType: "oracle",
    provider: "chainlink",
    severity: "critical",
    status: "active",
    reasonCode: "ORACLE_STALE",
    summary: "stale price feed",
    createdAt: "2026-08-09T10:00:00.000Z",
    updatedAt: "2026-08-09T11:00:00.000Z",
    ...overrides,
  };
}

/** Minimal Response stand-in. Mirrors only what the client actually reads. */
function jsonResponse(body: unknown, init?: { status?: number; requestId?: string }) {
  const status = init?.status ?? 200;
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => (name === "x-request-id" ? init?.requestId ?? null : null) },
    json: async () => {
      if (body === "__invalid_json__") throw new SyntaxError("Unexpected token");
      return body;
    },
  };
}

function stubFetch(impl: () => unknown) {
  const fetchMock = vi.fn().mockImplementation(async () => impl());
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function thrown(name: string) {
  const error = new Error("network");
  error.name = name;
  return error;
}

describe("fetchSceAlertCollection data states", () => {
  beforeEach(() => {
    process.env.SCE_ADMIN_API_KEY = ADMIN_KEY;
    process.env.NEXT_PUBLIC_API_URL = "https://sce.example.test";
    clearAlertCache();
    resetAlertReadCounters();
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("1. reports `available` for a valid nonempty response", async () => {
    stubFetch(() => jsonResponse([makeRawAlert()]));

    const result = await fetchSceAlertCollection();

    expect(result.state).toBe("available");
    expect(result.alerts).toHaveLength(1);
    expect(result.source).toBe("sce");
    expect(result.lastSuccessfulAt).toBe(result.fetchedAt);
    expect(result.error).toBeUndefined();
    expect(getAlertReadCounters().success_nonempty).toBe(1);
  });

  it("2. reports `empty` for a valid empty response, with the successful check time", async () => {
    stubFetch(() => jsonResponse([]));

    const result = await fetchSceAlertCollection();

    expect(result.state).toBe("empty");
    expect(result.alerts).toEqual([]);
    expect(result.source).toBe("sce");
    expect(Date.parse(result.lastSuccessfulAt ?? "")).not.toBeNaN();
    expect(result.error).toBeUndefined();
    expect(getAlertReadCounters().success_empty).toBe(1);
  });

  it("3. reports `unavailable` on timeout with no cache", async () => {
    stubFetch(() => {
      throw thrown("TimeoutError");
    });

    const result = await fetchSceAlertCollection();

    expect(result.state).toBe("unavailable");
    expect(result.alerts).toEqual([]);
    expect(result.error).toEqual({ code: "UPSTREAM_TIMEOUT", retryable: true });
    expect(result.lastSuccessfulAt).toBeUndefined();
    expect(getAlertReadCounters().unavailable).toBe(1);
    expect(getAlertReadCounters().timeout).toBe(1);
  });

  it("4. reports `degraded` on timeout when a valid cache exists", async () => {
    let mode: "ok" | "timeout" = "ok";
    stubFetch(() => {
      if (mode === "timeout") throw thrown("TimeoutError");
      return jsonResponse([makeRawAlert()]);
    });

    const primed = await fetchSceAlertCollection({ limit: 50 });
    expect(primed.state).toBe("available");

    mode = "timeout";
    const result = await fetchSceAlertCollection({ limit: 50 });

    expect(result.state).toBe("degraded");
    expect(result.alerts).toHaveLength(1);
    expect(result.source).toBe("cache");
    expect(result.stale).toBe(true);
    expect(result.lastSuccessfulAt).toBe(primed.fetchedAt);
    expect(typeof result.cacheAgeSeconds).toBe("number");
    expect(result.error?.code).toBe("UPSTREAM_TIMEOUT");
    expect(getAlertReadCounters().degraded).toBe(1);
  });

  it.each([401, 403])("5. maps SCE %i to a configuration/security failure", async (status) => {
    stubFetch(() => jsonResponse({ detail: "forbidden" }, { status }));

    const result = await fetchSceAlertCollection();

    expect(result.state).toBe("unavailable");
    expect(result.error).toEqual({ code: "UPSTREAM_UNAUTHORIZED", retryable: false });
    expect(getAlertReadCounters().auth_configuration_failure).toBe(1);
  });

  it("5b. maps a missing admin key to CONFIGURATION_ERROR without calling SCE", async () => {
    delete process.env.SCE_ADMIN_API_KEY;
    const fetchMock = stubFetch(() => jsonResponse([]));

    const result = await fetchSceAlertCollection();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.state).toBe("unavailable");
    expect(result.error).toEqual({ code: "CONFIGURATION_ERROR", retryable: false });
  });

  it("6. maps a collection 404 to route/deployment drift, not an empty collection", async () => {
    stubFetch(() => jsonResponse({ detail: "not found" }, { status: 404 }));

    const result = await fetchSceAlertCollection();

    expect(result.state).toBe("unavailable");
    expect(result.alerts).toEqual([]);
    expect(result.error).toEqual({ code: "CONFIGURATION_ERROR", retryable: false });
  });

  it("7. maps SCE 429 to a rate-limited unavailable state", async () => {
    stubFetch(() => jsonResponse({ detail: "slow down" }, { status: 429 }));

    const result = await fetchSceAlertCollection();

    expect(result.state).toBe("unavailable");
    expect(result.error).toEqual({ code: "UPSTREAM_RATE_LIMITED", retryable: true });
    expect(getAlertReadCounters().rate_limited).toBe(1);
  });

  it.each([500, 502, 503])("8. maps SCE %i to an unavailable state", async (status) => {
    stubFetch(() => jsonResponse({ detail: "boom" }, { status }));

    const result = await fetchSceAlertCollection();

    expect(result.state).toBe("unavailable");
    expect(result.error).toEqual({ code: "UPSTREAM_UNAVAILABLE", retryable: true });
  });

  it("9. maps malformed JSON to INVALID_UPSTREAM_RESPONSE", async () => {
    stubFetch(() => jsonResponse("__invalid_json__"));

    const result = await fetchSceAlertCollection();

    expect(result.state).toBe("unavailable");
    expect(result.error).toEqual({ code: "INVALID_UPSTREAM_RESPONSE", retryable: false });
    expect(getAlertReadCounters().invalid_upstream_payload).toBe(1);
  });

  it("10. maps valid JSON with the wrong shape to INVALID_UPSTREAM_RESPONSE", async () => {
    stubFetch(() => jsonResponse({ alerts: [makeRawAlert()] }));

    const result = await fetchSceAlertCollection();

    expect(result.state).toBe("unavailable");
    expect(result.error?.code).toBe("INVALID_UPSTREAM_RESPONSE");
  });

  it("10b. rejects an array whose entries are missing required fields", async () => {
    stubFetch(() => jsonResponse([{ id: "RADAR-1", monitorType: "oracle" }]));

    const result = await fetchSceAlertCollection();

    expect(result.state).toBe("unavailable");
    expect(result.error?.code).toBe("INVALID_UPSTREAM_RESPONSE");
  });

  it("11. keeps a cached empty collection distinguishable from a failed live retrieval", async () => {
    let mode: "ok" | "down" = "ok";
    stubFetch(() => {
      if (mode === "down") throw thrown("TypeError");
      return jsonResponse([]);
    });

    const confirmedEmpty = await fetchSceAlertCollection({ limit: 7 });
    expect(confirmedEmpty.state).toBe("empty");
    expect(confirmedEmpty.source).toBe("sce");
    expect(confirmedEmpty.stale).toBeUndefined();

    mode = "down";
    const afterFailure = await fetchSceAlertCollection({ limit: 7 });

    // Same zero alerts, but the two are not interchangeable: one was confirmed,
    // the other is last-confirmed data served because the live read failed.
    expect(afterFailure.alerts).toEqual([]);
    expect(afterFailure.state).toBe("degraded");
    expect(afterFailure.source).toBe("cache");
    expect(afterFailure.stale).toBe(true);
    expect(afterFailure.error?.code).toBe("UPSTREAM_UNAVAILABLE");
  });

  it("11b. never overwrites a valid cache with a failed response", async () => {
    let mode: "ok" | "down" = "ok";
    stubFetch(() => {
      if (mode === "down") return jsonResponse({ detail: "boom" }, { status: 500 });
      return jsonResponse([makeRawAlert()]);
    });

    const primed = await fetchSceAlertCollection({ limit: 9 });
    mode = "down";
    await fetchSceAlertCollection({ limit: 9 });
    const second = await fetchSceAlertCollection({ limit: 9 });

    expect(second.state).toBe("degraded");
    expect(second.alerts).toHaveLength(1);
    // The failure did not advance the last-confirmed timestamp.
    expect(second.lastSuccessfulAt).toBe(primed.fetchedAt);
  });

  it("16. never places the admin key in the result or in telemetry", async () => {
    const infoSpy = console.info as unknown as ReturnType<typeof vi.fn>;
    const errorSpy = console.error as unknown as ReturnType<typeof vi.fn>;
    stubFetch(() => jsonResponse([makeRawAlert()], { requestId: "req-42" }));
    await fetchSceAlertCollection({ surface: "test" });
    stubFetch(() => jsonResponse({ detail: "forbidden" }, { status: 401 }));
    await fetchSceAlertCollection({ surface: "test" });

    const logged = [...infoSpy.mock.calls, ...errorSpy.mock.calls].flat().join("\n");
    expect(logged).not.toContain(ADMIN_KEY);
    expect(logged).toContain("req-42");
    // Upstream bodies stay out of the log too.
    expect(logged).not.toContain("forbidden");
  });
});

describe("fetchSceAlertDetail data states", () => {
  beforeEach(() => {
    process.env.SCE_ADMIN_API_KEY = ADMIN_KEY;
    process.env.NEXT_PUBLIC_API_URL = "https://sce.example.test";
    clearAlertCache();
    resetAlertReadCounters();
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns `available` for a valid alert", async () => {
    stubFetch(() => jsonResponse(makeRawAlert()));

    const result = await fetchSceAlertDetail("RADAR-1");

    expect(result.state).toBe("available");
    expect(result.alert?.id).toBe("RADAR-1");
  });

  it("12. returns `not_found` for a successful lookup of an unknown id", async () => {
    stubFetch(() => jsonResponse({ detail: "no such alert" }, { status: 404 }));

    const result = await fetchSceAlertDetail("RADAR-missing");

    expect(result.state).toBe("not_found");
    expect(result.alert).toBeNull();
    expect(result.error).toBeUndefined();
    expect(getAlertReadCounters().not_found).toBe(1);
  });

  it("12b. returns `not_found` for a successful lookup returning a null body", async () => {
    stubFetch(() => jsonResponse(null));

    const result = await fetchSceAlertDetail("RADAR-null");

    expect(result.state).toBe("not_found");
  });

  it.each([
    ["a 5xx", () => jsonResponse({ detail: "boom" }, { status: 503 }), "UPSTREAM_UNAVAILABLE"],
    ["a timeout", () => {
      throw thrown("TimeoutError");
    }, "UPSTREAM_TIMEOUT"],
    ["malformed JSON", () => jsonResponse("__invalid_json__"), "INVALID_UPSTREAM_RESPONSE"],
    ["a wrong-shaped body", () => jsonResponse({ nope: true }), "INVALID_UPSTREAM_RESPONSE"],
  ])("13. maps %s to `unavailable`, never `not_found`", async (_label, impl, code) => {
    stubFetch(impl as () => unknown);

    const result = await fetchSceAlertDetail("RADAR-1");

    expect(result.state).toBe("unavailable");
    expect(result.state).not.toBe("not_found");
    expect(result.error?.code).toBe(code);
  });

  it("serves a cached detail as `degraded` when the live read fails", async () => {
    let mode: "ok" | "down" = "ok";
    stubFetch(() => {
      if (mode === "down") return jsonResponse({ detail: "boom" }, { status: 502 });
      return jsonResponse(makeRawAlert());
    });

    const primed = await fetchSceAlertDetail("RADAR-1");
    mode = "down";
    const result = await fetchSceAlertDetail("RADAR-1");

    expect(result.state).toBe("degraded");
    expect(result.alert?.id).toBe("RADAR-1");
    expect(result.source).toBe("cache");
    expect(result.stale).toBe(true);
    expect(result.lastSuccessfulAt).toBe(primed.fetchedAt);
  });
});
