import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  ALERT_DEGRADED_HEADLINE,
  ALERT_DETAIL_UNAVAILABLE_HEADLINE,
  ALERT_EMPTY_DETAIL_PREFIX,
  ALERT_EMPTY_HEADLINE,
  ALERT_UNAVAILABLE_DETAIL,
  ALERT_UNAVAILABLE_HEADLINE,
  type AlertCollectionResult,
} from "@/lib/alert-data-state";
import type { PublicRadarAlert } from "@/lib/public-alerts";
import { AlertDetailUnavailableView, PublicAlertsView } from "./alerts-view";

function makePublicAlert(overrides: Partial<PublicRadarAlert> = {}): PublicRadarAlert {
  return {
    id: "RADAR-1",
    severity: "critical",
    status: "active",
    monitorType: "oracle",
    provider: "chainlink",
    chain: "Ethereum",
    asset: "ETH/USD",
    assetPair: "ETH/USD",
    route: null,
    poolName: null,
    summary: "Chainlink ETH/USD heartbeat missed",
    whatHappened: null,
    whyItMatters: null,
    radarStatus: null,
    nextWatch: null,
    severityExplanation: null,
    thresholdExplanation: null,
    evidenceExplanation: null,
    evidenceSummary: null,
    humanRiskSummary: null,
    thresholdName: null,
    observedValueLabel: null,
    thresholdValueLabel: null,
    declaredHeartbeatSeconds: null,
    appliedThresholdSeconds: null,
    appliedThresholdKind: null,
    thresholdSourceLabel: null,
    evidenceState: null,
    publicVerificationState: null,
    lastSuccessfulObservationAt: null,
    lastObservationAttemptAt: null,
    consecutiveFailedCycles: null,
    objectState: null,
    failureCause: null,
    coverageTier: null,
    lpTotalLiquidityUsd: null,
    lpPriorTotalLiquidityUsd: null,
    lpLiquidityUsdDropPct: null,
    lpTvlSource: null,
    openedAt: null,
    resolvedAt: null,
    createdAt: "2026-08-09T10:00:00.000Z",
    updatedAt: "2026-08-09T11:00:00.000Z",
    ...overrides,
  };
}

function render(result: AlertCollectionResult<PublicRadarAlert>): string {
  return renderToStaticMarkup(React.createElement(PublicAlertsView, { result }));
}

const FETCHED_AT = "2026-08-09T12:00:00.000Z";

describe("14. public alerts page renders the correct state marker and copy", () => {
  it("marks an available collection and renders its alerts", () => {
    const html = render({
      state: "available",
      alerts: [makePublicAlert()],
      source: "sce",
      fetchedAt: FETCHED_AT,
      lastSuccessfulAt: FETCHED_AT,
    });

    expect(html).toContain('data-alert-state="available"');
    expect(html).toContain("Chainlink ETH/USD heartbeat missed");
    expect(html).toContain("/alerts/RADAR-1");
    expect(html).not.toContain(ALERT_UNAVAILABLE_HEADLINE);
  });

  it("marks a confirmed empty collection and states the successful check time", () => {
    const html = render({
      state: "empty",
      alerts: [],
      source: "sce",
      fetchedAt: FETCHED_AT,
      lastSuccessfulAt: FETCHED_AT,
    });

    expect(html).toContain('data-alert-state="empty"');
    expect(html).toContain(ALERT_EMPTY_HEADLINE);
    expect(html).toContain(ALERT_EMPTY_DETAIL_PREFIX);
    expect(html).toContain(FETCHED_AT);
    // Confirmed-empty must not claim the ecosystem is safe.
    expect(html.toLowerCase()).not.toContain("all clear");
    expect(html.toLowerCase()).not.toContain("everything is fine");
  });

  it("marks a degraded collection, shows the last confirmed time, and flags staleness", () => {
    const html = render({
      state: "degraded",
      alerts: [makePublicAlert()],
      source: "cache",
      fetchedAt: FETCHED_AT,
      lastSuccessfulAt: "2026-08-09T11:50:00.000Z",
      stale: true,
      cacheAgeSeconds: 600,
      error: { code: "UPSTREAM_TIMEOUT", retryable: true },
    });

    expect(html).toContain('data-alert-state="degraded"');
    expect(html).toContain(ALERT_DEGRADED_HEADLINE);
    expect(html).toContain("2026-08-09T11:50:00.000Z");
    expect(html).toContain("10m old");
    expect(html).toContain("not live");
    expect(html).toContain("cached");
    // Cached rows are still shown, just never as live data.
    expect(html).toContain("Chainlink ETH/USD heartbeat missed");
  });

  it("marks an unavailable collection with availability copy and a retry action", () => {
    const html = render({
      state: "unavailable",
      alerts: [],
      source: "sce",
      fetchedAt: FETCHED_AT,
      error: { code: "UPSTREAM_UNAVAILABLE", retryable: true },
    });

    expect(html).toContain('data-alert-state="unavailable"');
    expect(html).toContain(ALERT_UNAVAILABLE_HEADLINE);
    expect(html).toContain(ALERT_UNAVAILABLE_DETAIL);
    expect(html).toContain("Retry");
    // The unavailable state must never reuse empty-state language.
    expect(html).not.toContain(ALERT_EMPTY_HEADLINE);
    expect(html).not.toContain(ALERT_EMPTY_DETAIL_PREFIX);
  });

  it("exposes an accessible live region for state changes", () => {
    const html = render({
      state: "unavailable",
      alerts: [],
      source: "sce",
      fetchedAt: FETCHED_AT,
      error: { code: "UPSTREAM_TIMEOUT", retryable: true },
    });

    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
  });

  it("never leaks an upstream error code into the rendered page", () => {
    const html = render({
      state: "unavailable",
      alerts: [],
      source: "sce",
      fetchedAt: FETCHED_AT,
      error: { code: "UPSTREAM_UNAUTHORIZED", retryable: false, requestId: "req-1" },
    });

    expect(html).not.toContain("UPSTREAM_UNAUTHORIZED");
    expect(html).not.toContain("req-1");
  });
});

describe("13. alert detail unavailable view", () => {
  it("uses availability copy rather than not-found copy", () => {
    const html = renderToStaticMarkup(
      React.createElement(AlertDetailUnavailableView, { fetchedAt: FETCHED_AT }),
    );

    expect(html).toContain('data-alert-state="unavailable"');
    expect(html).toContain(ALERT_DETAIL_UNAVAILABLE_HEADLINE);
    expect(html.toLowerCase()).not.toContain("not found");
    expect(html.toLowerCase()).not.toContain("does not exist");
  });
});
