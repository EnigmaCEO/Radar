import { describe, expect, it } from "vitest";
import {
  deriveSignalToken,
  evaluateWatchlistMatch,
  hasWatchlistFilters,
  isDestinationDue,
  isValidWindow,
  isWithinWindow,
  matchesSignalClass,
  matchesWatchlist,
  meetsMinSeverity,
  normalizeAlert,
  normalizeSeverity,
  type MatchableAlert,
  type WatchlistFilterSet,
} from "./delivery-matching";

function makeAlert(overrides: Partial<MatchableAlert> = {}): MatchableAlert {
  return {
    alertId: "alert_1",
    id: "alert_1",
    eventId: null,
    cursor: null,
    eventType: null,
    title: "Chainlink USDC/USD is stale",
    summary: "Chainlink USDC/USD is stale",
    monitorType: "oracle",
    provider: "Chainlink",
    chain: "Base",
    asset: "USDC",
    objectId: "oracle-feed:chainlink:base:usdc-usd",
    tags: [],
    purpose: "sagitta_dependency",
    status: "active",
    signalClass: "stale",
    severity: "warning",
    reasonCode: "ORACLE_STALE",
    createdAt: "2026-07-03T11:00:00.000Z",
    updatedAt: "2026-07-03T11:50:00.000Z",
    ...overrides,
  };
}

function makeWatchlist(overrides: Partial<WatchlistFilterSet> = {}): WatchlistFilterSet {
  return {
    id: "wl_1",
    name: "Test watchlist",
    matchMode: "any",
    minSeverity: "watch",
    monitorTypes: [],
    providers: [],
    chains: [],
    assets: [],
    objectIds: [],
    tags: [],
    purposes: [],
    statuses: [],
    signalClasses: [],
    ...overrides,
  };
}

describe("severity helpers", () => {
  it("maps unknown severity to info", () => {
    expect(normalizeSeverity("mystery")).toBe("info");
  });

  it("ranks info < watch < warning < critical", () => {
    expect(meetsMinSeverity("info", "watch")).toBe(false);
    expect(meetsMinSeverity("warning", "watch")).toBe(true);
    expect(meetsMinSeverity("critical", "watch")).toBe(true);
    expect(meetsMinSeverity("warning", "critical")).toBe(false);
  });
});

describe("isValidWindow / isWithinWindow", () => {
  it("accepts only the three known window values", () => {
    expect(isValidWindow("15min")).toBe(true);
    expect(isValidWindow("1h")).toBe(true);
    expect(isValidWindow("24h")).toBe(true);
    expect(isValidWindow("2h")).toBe(false);
    expect(isValidWindow(undefined)).toBe(false);
  });

  it("includes alerts updated within the window and excludes older ones", () => {
    const now = new Date("2026-07-03T12:00:00Z");
    expect(isWithinWindow("2026-07-03T11:50:00Z", "15min", now)).toBe(true);
    expect(isWithinWindow("2026-07-03T11:30:00Z", "15min", now)).toBe(false);
    expect(isWithinWindow("2026-07-03T11:30:00Z", "1h", now)).toBe(true);
    expect(isWithinWindow("not-a-date", "24h", now)).toBe(false);
  });
});

describe("deriveSignalToken / matchesSignalClass", () => {
  it("strips the monitor-type prefix and lowercases", () => {
    expect(deriveSignalToken("ORACLE_STALE")).toBe("stale");
    expect(deriveSignalToken("BRIDGE_ROUTE_ERROR")).toBe("route_error");
    expect(deriveSignalToken("LP_POOL_IMBALANCE")).toBe("pool_imbalance");
  });

  it("fuzzy-matches the catalog signal-class vocabulary bidirectionally", () => {
    expect(matchesSignalClass("staleness", deriveSignalToken("ORACLE_STALE"))).toBe(true);
    expect(matchesSignalClass("route_error", deriveSignalToken("BRIDGE_ROUTE_ERROR"))).toBe(true);
    expect(matchesSignalClass("read_error", deriveSignalToken("LP_POOL_READ_ERROR"))).toBe(true);
    expect(matchesSignalClass("route_delay", deriveSignalToken("BRIDGE_ROUTE_DELAYED"))).toBe(true);
    expect(matchesSignalClass("reference_deviation", deriveSignalToken("ORACLE_REFERENCE_DEVIATION"))).toBe(true);
    expect(matchesSignalClass("price_deviation", deriveSignalToken("ORACLE_STALE"))).toBe(false);
  });
});

describe("normalizeAlert", () => {
  it("normalizes snake_case SCE alerts", () => {
    const normalized = normalizeAlert({
      id: "alert_snake",
      monitor_type: "bridge",
      source: "LayerZero",
      pair: "ETH/USDC",
      monitor_object_id: "bridge-route:1",
      object_purpose: "treasury",
      severity: "CRITICAL",
      status: "active",
      reason_code: "BRIDGE_ROUTE_ERROR",
      summary: "Route failed",
      created_at: "2026-07-03T11:00:00Z",
      updated_at: "2026-07-03T11:50:00Z",
    });

    expect(normalized).toMatchObject({
      alertId: "alert_snake",
      monitorType: "bridge",
      provider: "LayerZero",
      asset: "ETH/USDC",
      objectId: "bridge-route:1",
      purpose: "treasury",
      severity: "critical",
    });
  });

  it("normalizes camelCase SCE alerts", () => {
    const normalized = normalizeAlert({
      id: "alert_camel",
      monitorType: "oracle",
      provider: "Chainlink",
      asset: "USDC",
      objectId: "oracle-feed:1",
      purpose: "sagitta_dependency",
      severity: "warning",
      status: "active",
      reasonCode: "ORACLE_STALE",
      title: "Oracle stale",
      createdAt: "2026-07-03T11:00:00Z",
      updatedAt: "2026-07-03T11:50:00Z",
    });

    expect(normalized).toMatchObject({
      alertId: "alert_camel",
      monitorType: "oracle",
      provider: "Chainlink",
      asset: "USDC",
      objectId: "oracle-feed:1",
      purpose: "sagitta_dependency",
      severity: "warning",
      title: "Oracle stale",
    });
  });

  it("keeps explicit ledger signalClass and event identity", () => {
    const normalized = normalizeAlert({
      alertId: "alert_ledger",
      eventId: "event_ledger",
      cursor: "cursor_ledger",
      eventType: "alert_updated",
      monitorType: "oracle",
      provider: "Chainlink",
      signalClass: "coverage",
      severity: "warning",
      status: "active",
      reasonCode: "ORACLE_STALE",
      summary: "Ledger event",
      createdAt: "2026-07-03T11:00:00Z",
      updatedAt: "2026-07-03T11:50:00Z",
    });

    expect(normalized).toMatchObject({
      alertId: "alert_ledger",
      id: "event_ledger",
      eventId: "event_ledger",
      cursor: "cursor_ledger",
      eventType: "alert_updated",
      signalClass: "coverage",
    });
  });

  it("preserves explanation fields for downstream briefing formatting", () => {
    const normalized = normalizeAlert({
      id: "alert_explained",
      monitorType: "oracle",
      provider: "Chainlink",
      assetPair: "USDC/USD",
      objectId: "oracle-feed:1",
      severity: "warning",
      status: "active",
      reasonCode: "ORACLE_STALE",
      summary: "Feed stale",
      severityExplanation: "Warning: the price feed has not refreshed on schedule and may be stale.",
      thresholdExplanation: "Threshold crossed after 300 seconds.",
      humanRiskSummary: "Dependent systems may rely on aging values.",
      whatHappened: "Several monitored feeds have not refreshed on schedule.",
      whyItMatters: "Dependent systems can continue reading older values until updates resume.",
      radarStatus: "Monitoring feed freshness and resolution state.",
      nextWatch: "Watch for new on-chain oracle updates.",
      evidenceExplanation: "Observed heartbeat delay remains above threshold.",
      thresholdName: "warning_after_seconds",
      observedValueLabel: "420s",
      thresholdValueLabel: "300s",
      createdAt: "2026-07-03T11:00:00Z",
      updatedAt: "2026-07-03T11:50:00Z",
    });

    expect(normalized).toMatchObject({
      assetPair: "USDC/USD",
      severityExplanation: "Warning: the price feed has not refreshed on schedule and may be stale.",
      thresholdExplanation: "Threshold crossed after 300 seconds.",
      humanRiskSummary: "Dependent systems may rely on aging values.",
      whatHappened: "Several monitored feeds have not refreshed on schedule.",
      whyItMatters: "Dependent systems can continue reading older values until updates resume.",
      radarStatus: "Monitoring feed freshness and resolution state.",
      nextWatch: "Watch for new on-chain oracle updates.",
      evidenceExplanation: "Observed heartbeat delay remains above threshold.",
      thresholdName: "warning_after_seconds",
      observedValueLabel: "420s",
      thresholdValueLabel: "300s",
    });
  });
});

describe("matchesWatchlist", () => {
  it("a broad watchlist with minSeverity=watch matches a warning alert", () => {
    expect(matchesWatchlist(makeAlert({ severity: "warning" }), makeWatchlist({ minSeverity: "watch" }))).toBe(true);
  });

  it("a broad watchlist with minSeverity=watch matches a critical alert", () => {
    expect(matchesWatchlist(makeAlert({ severity: "critical" }), makeWatchlist({ minSeverity: "watch" }))).toBe(true);
  });

  it("a broad watchlist matches all alerts above its min severity", () => {
    const watchlist = makeWatchlist({ minSeverity: "watch" });
    expect(matchesWatchlist(makeAlert({ severity: "watch" }), watchlist)).toBe(true);
    expect(matchesWatchlist(makeAlert({ severity: "warning" }), watchlist)).toBe(true);
    expect(matchesWatchlist(makeAlert({ severity: "critical" }), watchlist)).toBe(true);
  });

  it("treats null-like or empty filter arrays as no restriction", () => {
    const watchlist = makeWatchlist({
      monitorTypes: [],
      providers: [],
      chains: [],
      assets: [],
      objectIds: [],
      tags: [],
      purposes: [],
      statuses: [],
      signalClasses: [],
    });
    expect(hasWatchlistFilters(watchlist)).toBe(false);
    expect(matchesWatchlist(makeAlert({ severity: "warning" }), watchlist)).toBe(true);
  });

  it("does not match when below the watchlist minimum severity", () => {
    expect(matchesWatchlist(makeAlert({ severity: "warning" }), makeWatchlist({ minSeverity: "critical" }))).toBe(false);
  });

  it("matches by monitor type", () => {
    const watchlist = makeWatchlist({ monitorTypes: ["bridge"] });
    expect(matchesWatchlist(makeAlert({ monitorType: "oracle" }), watchlist)).toBe(false);
    expect(matchesWatchlist(makeAlert({ monitorType: "bridge" }), watchlist)).toBe(true);
  });

  it("matches by provider, chain, and asset case-insensitively", () => {
    const watchlist = makeWatchlist({
      matchMode: "all",
      providers: ["chainlink"],
      chains: ["base"],
      assets: ["usdc"],
    });
    expect(matchesWatchlist(makeAlert({ provider: "Chainlink", chain: "Base", asset: "USDC" }), watchlist)).toBe(true);
    expect(matchesWatchlist(makeAlert({ provider: "Pyth", chain: "Base", asset: "USDC" }), watchlist)).toBe(false);
  });

  it("matchMode all requires every active dimension to match", () => {
    const watchlist = makeWatchlist({ matchMode: "all", providers: ["Chainlink"], chains: ["Ethereum"] });
    expect(matchesWatchlist(makeAlert({ provider: "Chainlink", chain: "Base" }), watchlist)).toBe(false);
    expect(matchesWatchlist(makeAlert({ provider: "Chainlink", chain: "Ethereum" }), watchlist)).toBe(true);
  });

  it("matchMode any requires only one active dimension to match", () => {
    const watchlist = makeWatchlist({ matchMode: "any", providers: ["Chainlink"], chains: ["Ethereum"] });
    expect(matchesWatchlist(makeAlert({ provider: "Chainlink", chain: "Base" }), watchlist)).toBe(true);
  });

  it("matches specific objectIds exactly", () => {
    const watchlist = makeWatchlist({ objectIds: ["oracle-feed:chainlink:base:usdc-usd"] });
    expect(matchesWatchlist(makeAlert(), watchlist)).toBe(true);
    expect(matchesWatchlist(makeAlert({ objectId: "other-object" }), watchlist)).toBe(false);
  });

  it("matches by signalClasses using the fuzzy reasonCode mapping", () => {
    const watchlist = makeWatchlist({ signalClasses: ["staleness"] });
    expect(matchesWatchlist(makeAlert({ reasonCode: "ORACLE_STALE", signalClass: null }), watchlist)).toBe(true);
    expect(matchesWatchlist(makeAlert({ reasonCode: "ORACLE_REFERENCE_DEVIATION", signalClass: null }), watchlist)).toBe(false);
  });

  it("uses explicit signalClass for ledger-style events instead of deriving from reasonCode", () => {
    const watchlist = makeWatchlist({ signalClasses: ["coverage"] });
    expect(
      matchesWatchlist(
        makeAlert({
          eventId: "event_ledger",
          eventType: "alert_updated",
          signalClass: "coverage",
          reasonCode: "ORACLE_STALE",
        }),
        watchlist,
      ),
    ).toBe(true);
    expect(
      matchesWatchlist(
        makeAlert({
          eventId: "event_ledger_2",
          eventType: "alert_updated",
          signalClass: null,
          reasonCode: "ORACLE_STALE",
        }),
        makeWatchlist({ signalClasses: ["staleness"] }),
      ),
    ).toBe(false);
  });

  it("does not match resolved events unless the watchlist explicitly requests resolved status", () => {
    expect(
      matchesWatchlist(
        makeAlert({ status: "resolved", eventId: "event_resolved", eventType: "alert_resolved" }),
        makeWatchlist(),
      ),
    ).toBe(false);
    expect(
      matchesWatchlist(
        makeAlert({ status: "resolved", eventId: "event_resolved", eventType: "alert_resolved" }),
        makeWatchlist({ statuses: ["resolved"] }),
      ),
    ).toBe(true);
  });

  it("returns structured skip reasons for unmatched alerts", () => {
    const result = evaluateWatchlistMatch(
      makeAlert({ monitorType: "oracle", severity: "warning" }),
      makeWatchlist({ matchMode: "all", monitorTypes: ["bridge"], minSeverity: "critical" }),
    );

    expect(result.matched).toBe(false);
    expect(result.skippedReasons).toContain("below_watchlist_min_severity");
  });
});

describe("isDestinationDue", () => {
  it("is due when never polled", () => {
    expect(isDestinationDue(null, "1hr", new Date())).toBe(true);
  });

  it("is not due before its cadence has elapsed", () => {
    const now = new Date("2026-07-03T12:00:00Z");
    const lastPolledAt = new Date("2026-07-03T11:30:00Z");
    expect(isDestinationDue(lastPolledAt, "1hr", now)).toBe(false);
  });

  it("is due once its cadence has elapsed", () => {
    const now = new Date("2026-07-03T12:00:00Z");
    const lastPolledAt = new Date("2026-07-03T10:00:00Z");
    expect(isDestinationDue(lastPolledAt, "1hr", now)).toBe(true);
  });
});
