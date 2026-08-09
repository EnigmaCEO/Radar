import { describe, expect, it } from "vitest";
import {
  alertDataError,
  alertStateHttpStatus,
  formatAlertCount,
  hasRenderableAlertData,
  isConfirmedAlertState,
  isMeasuredAlertCount,
  mapAlertCollection,
  toPublicAlertEnvelope,
  UNMEASURED_COUNT_PLACEHOLDER,
  type AlertCollectionResult,
} from "./alert-data-state";

const FETCHED_AT = "2026-08-09T12:00:00.000Z";

function collection(
  overrides: Partial<AlertCollectionResult<string>>,
): AlertCollectionResult<string> {
  return {
    state: "available",
    alerts: ["a"],
    source: "sce",
    fetchedAt: FETCHED_AT,
    ...overrides,
  };
}

describe("15. dashboard counters never convert unavailable data into zero", () => {
  it("renders a placeholder instead of a number when nothing was measured", () => {
    expect(formatAlertCount(0, "unavailable")).toBe(UNMEASURED_COUNT_PLACEHOLDER);
    expect(formatAlertCount(0, undefined)).toBe(UNMEASURED_COUNT_PLACEHOLDER);
    expect(isMeasuredAlertCount("unavailable")).toBe(false);
    expect(isMeasuredAlertCount(undefined)).toBe(false);
  });

  it("renders a real zero only for a confirmed empty read", () => {
    expect(formatAlertCount(0, "empty")).toBe("0");
    expect(isMeasuredAlertCount("empty")).toBe(true);
  });

  it("treats degraded counts as measured, since they are real but older", () => {
    expect(formatAlertCount(3, "degraded")).toBe("3");
    expect(isMeasuredAlertCount("degraded")).toBe(true);
  });
});

describe("state predicates", () => {
  it("distinguishes confirmed reads from failures", () => {
    expect(isConfirmedAlertState("available")).toBe(true);
    expect(isConfirmedAlertState("empty")).toBe(true);
    expect(isConfirmedAlertState("not_found")).toBe(true);
    expect(isConfirmedAlertState("degraded")).toBe(false);
    expect(isConfirmedAlertState("unavailable")).toBe(false);
  });

  it("knows which states carry renderable records", () => {
    expect(hasRenderableAlertData("available")).toBe(true);
    expect(hasRenderableAlertData("degraded")).toBe(true);
    expect(hasRenderableAlertData("empty")).toBe(false);
    expect(hasRenderableAlertData("unavailable")).toBe(false);
  });

  it("marks only genuinely transient failures as retryable", () => {
    expect(alertDataError("UPSTREAM_TIMEOUT").retryable).toBe(true);
    expect(alertDataError("UPSTREAM_UNAVAILABLE").retryable).toBe(true);
    expect(alertDataError("UPSTREAM_RATE_LIMITED").retryable).toBe(true);
    expect(alertDataError("UPSTREAM_UNAUTHORIZED").retryable).toBe(false);
    expect(alertDataError("CONFIGURATION_ERROR").retryable).toBe(false);
    expect(alertDataError("INVALID_UPSTREAM_RESPONSE").retryable).toBe(false);
  });
});

describe("alertStateHttpStatus", () => {
  it("keeps confirmed and degraded reads at 200", () => {
    expect(alertStateHttpStatus("available")).toBe(200);
    expect(alertStateHttpStatus("empty")).toBe(200);
    expect(alertStateHttpStatus("degraded")).toBe(200);
    expect(alertStateHttpStatus("not_found")).toBe(200);
  });

  it("never returns 200 for an unavailable read", () => {
    for (const code of [
      "UPSTREAM_TIMEOUT",
      "UPSTREAM_UNAVAILABLE",
      "UPSTREAM_UNAUTHORIZED",
      "UPSTREAM_RATE_LIMITED",
      "INVALID_UPSTREAM_RESPONSE",
      "CONFIGURATION_ERROR",
    ] as const) {
      expect(alertStateHttpStatus("unavailable", alertDataError(code))).not.toBe(200);
    }
  });
});

describe("mapAlertCollection", () => {
  it("downgrades available to empty when a filter removes every record", () => {
    const result = mapAlertCollection(collection({}), () => []);
    expect(result.state).toBe("empty");
  });

  it("never upgrades a failure state, even if the transform produces records", () => {
    const unavailable = mapAlertCollection(
      collection({ state: "unavailable", alerts: [] }),
      () => ["surprise"],
    );
    expect(unavailable.state).toBe("unavailable");

    const degraded = mapAlertCollection(
      collection({ state: "degraded", alerts: ["cached"], stale: true }),
      (alerts) => alerts,
    );
    expect(degraded.state).toBe("degraded");
    expect(degraded.stale).toBe(true);
  });
});

describe("toPublicAlertEnvelope", () => {
  it("omits freshness fields that do not apply and keeps legacy counts", () => {
    const envelope = toPublicAlertEnvelope(collection({}));
    expect(envelope).toEqual({
      state: "available",
      alerts: ["a"],
      count: 1,
      pageCount: 1,
      source: "sce",
      fetchedAt: FETCHED_AT,
    });
  });

  it("carries the full freshness disclosure for a degraded read", () => {
    const envelope = toPublicAlertEnvelope(
      collection({
        state: "degraded",
        source: "cache",
        stale: true,
        cacheAgeSeconds: 120,
        lastSuccessfulAt: "2026-08-09T11:58:00.000Z",
        error: { code: "UPSTREAM_TIMEOUT", retryable: true },
      }),
    );

    expect(envelope).toMatchObject({
      state: "degraded",
      source: "cache",
      stale: true,
      cacheAgeSeconds: 120,
      lastSuccessfulAt: "2026-08-09T11:58:00.000Z",
      error: { code: "UPSTREAM_TIMEOUT", retryable: true },
    });
  });
});
