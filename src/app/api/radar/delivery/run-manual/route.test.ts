import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth0", () => ({ auth0: { getSession: vi.fn() } }));
vi.mock("@/lib/account", () => ({ getAccount: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    radarWatchlist: { findMany: vi.fn() },
    radarDeliveryDestination: { findMany: vi.fn(), update: vi.fn() },
    radarDeliveryLog: { create: vi.fn() },
  },
}));
vi.mock("@/lib/sce-alerts", () => ({
  SceAlertsError: class SceAlertsError extends Error {},
  fetchSceAlertLedger: vi.fn(),
  fetchSceAlerts: vi.fn(),
}));
vi.mock("@/lib/public-thread", () => ({
  getLatestPublicThreadDelivery: vi.fn(),
}));

import { auth0 } from "@/lib/auth0";
import { getAccount } from "@/lib/account";
import { db } from "@/lib/db";
import { getLatestPublicThreadDelivery } from "@/lib/public-thread";
import { fetchSceAlertLedger, fetchSceAlerts } from "@/lib/sce-alerts";
import { POST } from "./route";

const ORIGINAL_ENV = { ...process.env };
const account = { id: "acct_1", ownerSub: "auth0|1", plan: "radar_pro" };

function req(body: unknown) {
  return new NextRequest("http://localhost/api/radar/delivery/run-manual", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function freshTimestamp(secondsAgo = 5) {
  return new Date(Date.now() - secondsAgo * 1000).toISOString();
}

function makeLedgerEvent(overrides: Record<string, unknown> = {}) {
  return {
    alertId: "RADAR-1",
    eventId: "event-1",
    cursor: "cursor-1",
    eventType: "alert_updated",
    monitorType: "oracle",
    provider: "Chainlink",
    chain: "Base",
    asset: "USDC",
    assetPair: "USDC/USD",
    route: null,
    poolName: null,
    objectId: "oracle-feed:chainlink:base:usdc-usd",
    objectType: "oracle_feed",
    purpose: "sagitta_dependency",
    severity: "warning",
    signalClass: "stale",
    status: "active",
    reasonCode: "ORACLE_STALE",
    summary: "Chainlink USDC/USD on Base is stale.",
    publicSummary: "Chainlink USDC/USD on Base is stale.",
    createdAt: freshTimestamp(),
    sourceAlertCreatedAt: freshTimestamp(30),
    updatedAt: freshTimestamp(),
    sourceAlertUpdatedAt: freshTimestamp(),
    openedAt: freshTimestamp(30),
    resolvedAt: null,
    evidenceSummary: "Heartbeat delayed",
    severityExplanation: "Warning: the price feed has not refreshed on schedule and may be stale.",
    thresholdExplanation: "Threshold crossed after 300 seconds.",
    humanRiskSummary: "Dependent systems may keep reading older values until updates resume.",
    whatHappened: "Several monitored Chainlink feeds have not refreshed on schedule.",
    whyItMatters: "Dependent systems can continue reading older values until updates resume.",
    radarStatus: "Monitoring feed freshness and resolution state.",
    nextWatch: "Watch for new on-chain oracle updates.",
    evidenceExplanation: "Observed heartbeat delay remains above threshold.",
    thresholdName: "warning_after_seconds",
    observedValueLabel: "420s",
    thresholdValueLabel: "300s",
    tags: [],
    ...overrides,
  };
}

function makeSnakeCaseLedgerEvent(overrides: Record<string, unknown> = {}) {
  return {
    alert_id: "RADAR-snake",
    event_id: "event-snake",
    cursor: "cursor-snake",
    event_type: "alert_updated",
    monitor_type: "bridge",
    source: "LayerZero",
    chain: "Ethereum",
    asset_pair: "ETH/USDC",
    monitor_object_id: "bridge-route:1",
    object_type: "bridge_route",
    object_purpose: "treasury",
    severity: "critical",
    signal_class: "route_error",
    status: "active",
    reason_code: "BRIDGE_ROUTE_ERROR",
    summary: "Bridge route failed.",
    public_summary: "Bridge route failed.",
    created_at: freshTimestamp(),
    source_alert_created_at: freshTimestamp(40),
    updated_at: freshTimestamp(),
    source_alert_updated_at: freshTimestamp(),
    opened_at: freshTimestamp(40),
    resolved_at: null,
    evidence_summary: "Route is down",
    severity_explanation: "Critical: the route is unavailable.",
    threshold_explanation: "Route latency is above the critical threshold.",
    human_risk_summary: "Cross-chain transfers may be delayed.",
    what_happened: "The bridge route is unavailable.",
    why_it_matters: "Users may be unable to move assets across this route.",
    radar_status: "Monitoring route health.",
    next_watch: "Watch for route recovery.",
    evidence_explanation: "No successful route reads are returning.",
    threshold_name: "critical_route_latency_ms",
    observed_value_label: "timeout",
    threshold_value_label: "15000ms",
    tags: [],
    ...overrides,
  };
}

function makeWatchlist(overrides: Record<string, unknown> = {}) {
  return {
    id: "wl_1",
    accountId: "acct_1",
    name: "Broad watchlist",
    enabled: true,
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

function makeDestination(overrides: Record<string, unknown> = {}) {
  return {
    id: "dest_1",
    accountId: "acct_1",
    name: "Test destination",
    channel: "webhook",
    destinationUrl: "https://example.test/super-secret-webhook-path",
    enabled: true,
    minimumSeverity: "watch",
    pollingFrequency: "15min",
    deliveryMode: "alert_fanout",
    lastPolledAt: null,
    configEncrypted: null,
    configPreview: null,
    ...overrides,
  };
}

describe("POST /api/radar/delivery/run-manual", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RADAR_TELEGRAM_BOT_TOKEN = "123456:super-secret-bot-token";
    vi.mocked(auth0.getSession).mockResolvedValue({ user: { sub: "auth0|1" } } as never);
    vi.mocked(getAccount).mockResolvedValue(account as never);
    vi.mocked(getLatestPublicThreadDelivery).mockResolvedValue(null);
    vi.mocked(db.radarDeliveryLog.create).mockImplementation(
      ((args: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: `log_${Math.random()}`, ...args.data })) as never,
    );
    vi.mocked(db.radarDeliveryDestination.update).mockResolvedValue({} as never);
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.unstubAllGlobals();
  });

  it("requires an Auth0 session", async () => {
    vi.mocked(auth0.getSession).mockResolvedValue(null);
    const res = await POST(req({}));
    expect(res.status).toBe(401);
    expect(fetchSceAlertLedger).not.toHaveBeenCalled();
  });

  it("uses the ledger helper with since/until and no longer relies on active-alert fetches", async () => {
    vi.mocked(fetchSceAlertLedger).mockResolvedValue([]);
    vi.mocked(db.radarWatchlist.findMany).mockResolvedValue([]);
    vi.mocked(db.radarDeliveryDestination.findMany).mockResolvedValue([]);

    await POST(req({ window: "15min" }));

    expect(fetchSceAlertLedger).toHaveBeenCalledWith(
      expect.objectContaining({
        since: expect.any(String),
        until: expect.any(String),
        limit: 200,
      }),
    );
    expect(fetchSceAlerts).not.toHaveBeenCalled();
  });

  it("a broad watchlist with minSeverity=watch matches ledger warning and critical events", async () => {
    vi.mocked(fetchSceAlertLedger).mockResolvedValue([
      makeLedgerEvent({ alertId: "a1", eventId: "e1", severity: "warning" }),
      makeLedgerEvent({ alertId: "a2", eventId: "e2", severity: "critical" }),
    ] as never);
    vi.mocked(db.radarWatchlist.findMany).mockResolvedValue([makeWatchlist({ minSeverity: "watch" })] as never);
    vi.mocked(db.radarDeliveryDestination.findMany).mockResolvedValue([]);

    const res = await POST(req({}));
    const data = await res.json();

    expect(data.alertsMatched).toBe(2);
    expect(data.uniqueAlertsMatched).toBe(2);
    expect(data.watchlistsMatched).toBe(1);
    expect(data.broadWatchlistsLoaded).toBe(1);
  });

  it("treats null filter arrays as no restriction", async () => {
    vi.mocked(fetchSceAlertLedger).mockResolvedValue([makeLedgerEvent()] as never);
    vi.mocked(db.radarWatchlist.findMany).mockResolvedValue([
      makeWatchlist({
        monitorTypes: null,
        providers: null,
        chains: null,
        assets: null,
        objectIds: null,
        tags: null,
        purposes: null,
        statuses: null,
        signalClasses: null,
      }),
    ] as never);
    vi.mocked(db.radarDeliveryDestination.findMany).mockResolvedValue([]);

    const res = await POST(req({}));
    const data = await res.json();

    expect(data.alertsMatched).toBe(1);
  });

  it("treats empty filter arrays as no restriction", async () => {
    vi.mocked(fetchSceAlertLedger).mockResolvedValue([makeLedgerEvent()] as never);
    vi.mocked(db.radarWatchlist.findMany).mockResolvedValue([makeWatchlist()] as never);
    vi.mocked(db.radarDeliveryDestination.findMany).mockResolvedValue([]);

    const res = await POST(req({}));
    const data = await res.json();

    expect(data.alertsMatched).toBe(1);
  });

  it("does not match disabled watchlists because only enabled watchlists are loaded", async () => {
    vi.mocked(fetchSceAlertLedger).mockResolvedValue([makeLedgerEvent()] as never);
    vi.mocked(db.radarWatchlist.findMany).mockResolvedValue([] as never);
    vi.mocked(db.radarDeliveryDestination.findMany).mockResolvedValue([]);

    const res = await POST(req({}));
    const data = await res.json();

    expect(data.activeWatchlistsLoaded).toBe(0);
    expect(data.alertsMatched).toBe(0);
  });

  it("warning events do not pass minSeverity=critical", async () => {
    vi.mocked(fetchSceAlertLedger).mockResolvedValue([makeLedgerEvent({ severity: "warning" })] as never);
    vi.mocked(db.radarWatchlist.findMany).mockResolvedValue([makeWatchlist({ minSeverity: "critical" })] as never);
    vi.mocked(db.radarDeliveryDestination.findMany).mockResolvedValue([]);

    const res = await POST(req({}));
    const data = await res.json();

    expect(data.status).toBe("no_matches");
    expect(data.unmatchedAlertReasons[0].reasons).toContain("below_watchlist_min_severity");
  });

  it("normalizes snake_case ledger events before matching", async () => {
    vi.mocked(fetchSceAlertLedger).mockResolvedValue([makeSnakeCaseLedgerEvent()] as never);
    vi.mocked(db.radarWatchlist.findMany).mockResolvedValue([makeWatchlist({ monitorTypes: ["bridge"] })] as never);
    vi.mocked(db.radarDeliveryDestination.findMany).mockResolvedValue([]);

    const res = await POST(req({}));
    const data = await res.json();

    expect(data.alertsMatched).toBe(1);
    expect(data.alertResults[0].monitorType).toBe("bridge");
  });

  it("uses explicit signalClass filtering for ledger events", async () => {
    vi.mocked(fetchSceAlertLedger).mockResolvedValue([
      makeLedgerEvent({
        signalClass: "coverage",
        reasonCode: "ORACLE_STALE",
      }),
    ] as never);
    vi.mocked(db.radarWatchlist.findMany).mockResolvedValue([
      makeWatchlist({ signalClasses: ["coverage"] }),
    ] as never);
    vi.mocked(db.radarDeliveryDestination.findMany).mockResolvedValue([]);

    const res = await POST(req({}));
    const data = await res.json();

    expect(data.alertsMatched).toBe(1);
  });

  it("does not derive signalClass from reasonCode for ledger events", async () => {
    vi.mocked(fetchSceAlertLedger).mockResolvedValue([
      makeLedgerEvent({
        signalClass: null,
        reasonCode: "ORACLE_STALE",
      }),
    ] as never);
    vi.mocked(db.radarWatchlist.findMany).mockResolvedValue([
      makeWatchlist({ signalClasses: ["staleness"] }),
    ] as never);
    vi.mocked(db.radarDeliveryDestination.findMany).mockResolvedValue([]);

    const res = await POST(req({}));
    const data = await res.json();

    expect(data.alertsMatched).toBe(0);
    expect(data.unmatchedAlertReasons[0].reasons).toContain("no_filter_dimension_matched");
  });

  it("resolved events are skipped unless resolved status is explicitly requested", async () => {
    vi.mocked(fetchSceAlertLedger).mockResolvedValue([
      makeLedgerEvent({
        eventId: "resolved-event",
        eventType: "alert_resolved",
        status: "resolved",
        resolvedAt: freshTimestamp(),
      }),
    ] as never);
    vi.mocked(db.radarWatchlist.findMany).mockResolvedValue([makeWatchlist()] as never);
    vi.mocked(db.radarDeliveryDestination.findMany).mockResolvedValue([]);

    const res = await POST(req({}));
    const data = await res.json();

    expect(data.alertsMatched).toBe(0);
    expect(data.matchedAlerts).toEqual([]);
    expect(data.excludedEvents).toEqual([
      expect.objectContaining({
        alertId: "RADAR-1",
        eventId: "resolved-event",
        eventType: "alert_resolved",
        status: "resolved",
        skippedReasons: ["resolved_status_not_requested"],
      }),
    ]);
    expect(data.unmatchedAlertReasons[0].reasons).toEqual(["resolved_status_not_requested"]);
    expect(data.alertResults[0].skippedReasons).toEqual(["resolved_status_not_requested"]);
  });

  it("resolved events can match when the watchlist explicitly includes resolved status", async () => {
    vi.mocked(fetchSceAlertLedger).mockResolvedValue([
      makeLedgerEvent({
        eventId: "resolved-event",
        eventType: "alert_resolved",
        status: "resolved",
        resolvedAt: freshTimestamp(),
      }),
    ] as never);
    vi.mocked(db.radarWatchlist.findMany).mockResolvedValue([
      makeWatchlist({ statuses: ["resolved"] }),
    ] as never);
    vi.mocked(db.radarDeliveryDestination.findMany).mockResolvedValue([]);

    const res = await POST(req({}));
    const data = await res.json();

    expect(data.alertsMatched).toBe(1);
  });

  it("reports ledger event counts in the delivery result", async () => {
    vi.mocked(fetchSceAlertLedger).mockResolvedValue([makeLedgerEvent()] as never);
    vi.mocked(db.radarWatchlist.findMany).mockResolvedValue([makeWatchlist()] as never);
    vi.mocked(db.radarDeliveryDestination.findMany).mockResolvedValue([]);

    const res = await POST(req({}));
    const data = await res.json();

    expect(data.ledgerEventsFetched).toBe(1);
    expect(data.eventsInsideWindow).toBe(1);
    expect(data.uniqueAlertsMatched).toBe(1);
    expect(data.alertsFetched).toBe(1);
    expect(data.alertsInsideWindow).toBe(1);
  });

  it("dedupes repeated ledger events by alertId before match and briefing counts", async () => {
    vi.mocked(fetchSceAlertLedger).mockResolvedValue([
      makeLedgerEvent({
        alertId: "dup-alert",
        eventId: "event-1",
        createdAt: "2026-07-05T08:00:00.000Z",
        updatedAt: "2026-07-05T08:00:00.000Z",
      }),
      makeLedgerEvent({
        alertId: "dup-alert",
        eventId: "event-2",
        createdAt: "2026-07-05T08:05:00.000Z",
        updatedAt: "2026-07-05T08:05:00.000Z",
      }),
      makeLedgerEvent({
        alertId: "unique-alert",
        eventId: "event-3",
        asset: "USDe",
        assetPair: "USDe/USD",
      }),
    ] as never);
    vi.mocked(db.radarWatchlist.findMany).mockResolvedValue([makeWatchlist()] as never);
    vi.mocked(db.radarDeliveryDestination.findMany).mockResolvedValue([
      makeDestination({ channel: "webhook", destinationUrl: "https://example.test/hook" }),
    ] as never);

    const res = await POST(req({ dryRun: true }));
    const data = await res.json();

    expect(data.ledgerEventsFetched).toBe(3);
    expect(data.eventsInsideWindow).toBe(3);
    expect(data.alertsMatched).toBe(2);
    expect(data.uniqueAlertsMatched).toBe(2);
    expect(data.alertResults).toHaveLength(2);
    expect(data.watchlistMatchDetails[0].matchedAlertCount).toBe(2);
    expect(data.channelResults[0]).toMatchObject({
      messageCount: 1,
      briefingCount: 1,
      groupsGenerated: 1,
    });
  });

  it("reaches destination matching after a broad watchlist match", async () => {
    vi.mocked(fetchSceAlertLedger).mockResolvedValue([makeLedgerEvent({ severity: "critical" })] as never);
    vi.mocked(db.radarWatchlist.findMany).mockResolvedValue([makeWatchlist()] as never);
    vi.mocked(db.radarDeliveryDestination.findMany).mockResolvedValue([makeDestination()] as never);

    const res = await POST(req({ dryRun: true }));
    const data = await res.json();

    expect(data.destinationsMatched).toBe(1);
    expect(data.channelResults[0].status).toBe("dry_run");
    expect(data.channelResults[0].deliveryMode).toBe("alert_fanout");
    expect(data.channelResults[0].briefingCount).toBe(1);
    expect(data.channelResults[0].groupsGenerated).toBe(1);
    expect(data.channelResults[0].previewMessages[0]).toMatchObject({
      messageIndex: 0,
      format: "webhook_json",
      truncated: false,
    });
  });

  it("gates delivery by the destination's minimum severity", async () => {
    vi.mocked(fetchSceAlertLedger).mockResolvedValue([makeLedgerEvent({ severity: "warning" })] as never);
    vi.mocked(db.radarWatchlist.findMany).mockResolvedValue([makeWatchlist()] as never);
    vi.mocked(db.radarDeliveryDestination.findMany).mockResolvedValue([
      makeDestination({ minimumSeverity: "critical" }),
    ] as never);

    const res = await POST(req({ dryRun: true }));
    const data = await res.json();

    expect(data.channelResults[0].status).toBe("skipped");
    expect(data.channelResults[0].reason).toBe("below_destination_min_severity");
    expect(data.alertsMatched).toBe(1);
    expect(data.matchedAlerts).toEqual([]);
    expect(data.excludedEvents).toEqual([
      expect.objectContaining({
        alertId: "RADAR-1",
        skippedReasons: ["below_min_severity"],
      }),
    ]);
  });

  it("matchedAlerts only includes watchlist-matched alerts that remain eligible for delivery", async () => {
    vi.mocked(fetchSceAlertLedger).mockResolvedValue([
      makeLedgerEvent({ alertId: "eligible-alert", eventId: "eligible-event", severity: "critical" }),
      makeLedgerEvent({ alertId: "excluded-alert", eventId: "excluded-event", severity: "warning" }),
    ] as never);
    vi.mocked(db.radarWatchlist.findMany).mockResolvedValue([makeWatchlist()] as never);
    vi.mocked(db.radarDeliveryDestination.findMany).mockResolvedValue([
      makeDestination({ minimumSeverity: "critical" }),
    ] as never);

    const res = await POST(req({ dryRun: true }));
    const data = await res.json();

    expect(data.matchedAlerts).toEqual([
      expect.objectContaining({ alertId: "eligible-alert", matchedWatchlistNames: ["Broad watchlist"] }),
    ]);
    expect(data.excludedEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          alertId: "excluded-alert",
          skippedReasons: ["below_min_severity"],
        }),
      ]),
    );
    expect(data.alertResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ alertId: "eligible-alert", skippedReasons: [] }),
        expect.objectContaining({ alertId: "excluded-alert", skippedReasons: [] }),
      ]),
    );
  });

  it("skips an inactive destination without writing a delivery log", async () => {
    vi.mocked(fetchSceAlertLedger).mockResolvedValue([makeLedgerEvent()] as never);
    vi.mocked(db.radarWatchlist.findMany).mockResolvedValue([makeWatchlist()] as never);
    vi.mocked(db.radarDeliveryDestination.findMany).mockResolvedValue([
      makeDestination({ enabled: false }),
    ] as never);

    const res = await POST(req({ dryRun: true }));
    const data = await res.json();

    expect(data.channelResults[0]).toMatchObject({
      status: "skipped",
      reason: "inactive_destination",
    });
    expect(db.radarDeliveryLog.create).not.toHaveBeenCalled();
  });

  it("dry run sends no HTTP requests", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    vi.mocked(fetchSceAlertLedger).mockResolvedValue([makeLedgerEvent()] as never);
    vi.mocked(db.radarWatchlist.findMany).mockResolvedValue([makeWatchlist()] as never);
    vi.mocked(db.radarDeliveryDestination.findMany).mockResolvedValue([makeDestination()] as never);

    const res = await POST(req({ dryRun: true }));
    const data = await res.json();

    expect(data.status).toBe("dry_run");
    expect(data.channelResults[0].status).toBe("dry_run");
    expect(data.channelResults[0].previewMessages).toHaveLength(1);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(db.radarDeliveryDestination.update).not.toHaveBeenCalled();
  });

  it("dry run returns Telegram preview text", async () => {
    vi.mocked(fetchSceAlertLedger).mockResolvedValue([makeLedgerEvent()] as never);
    vi.mocked(db.radarWatchlist.findMany).mockResolvedValue([makeWatchlist()] as never);
    vi.mocked(db.radarDeliveryDestination.findMany).mockResolvedValue([
      makeDestination({ channel: "telegram_bot", destinationUrl: "-1009999" }),
    ] as never);

    const res = await POST(req({ dryRun: true }));
    const data = await res.json();

    expect(data.channelResults[0].previewMessages[0]).toMatchObject({
      format: "telegram_text",
      messageIndex: 0,
    });
    expect(data.channelResults[0].previewMessages[0].text).toContain("SCE Radar brief");
    expect(data.channelResults[0].previewMessages[0].characterCount).toBeGreaterThan(0);
  });

  it("dry run splits oversized Telegram briefings into multiple preview messages", async () => {
    vi.mocked(fetchSceAlertLedger).mockResolvedValue([
      makeLedgerEvent({
        whatHappened: "x".repeat(5000),
        whyItMatters: "y".repeat(2500),
        radarStatus: "z".repeat(2000),
        nextWatch: "n".repeat(1500),
      }),
    ] as never);
    vi.mocked(db.radarWatchlist.findMany).mockResolvedValue([makeWatchlist()] as never);
    vi.mocked(db.radarDeliveryDestination.findMany).mockResolvedValue([
      makeDestination({ channel: "telegram_bot", destinationUrl: "-1009999" }),
    ] as never);

    const res = await POST(req({ dryRun: true }));
    const data = await res.json();

    expect(data.channelResults[0].messageCount).toBeGreaterThan(1);
    expect(data.channelResults[0].previewMessages.length).toBeGreaterThan(1);
    expect(data.channelResults[0].previewMessages.every((preview: { truncated: boolean; text: string }) => !preview.truncated && preview.text.length <= 3500)).toBe(true);
  });

  it("dry run returns Discord embed previews in order", async () => {
    vi.mocked(fetchSceAlertLedger).mockResolvedValue([
      makeLedgerEvent({ alertId: "a1", eventId: "e1" }),
      makeLedgerEvent({ alertId: "a2", eventId: "e2", asset: "USDe", assetPair: "USDe/USD" }),
    ] as never);
    vi.mocked(db.radarWatchlist.findMany).mockResolvedValue([makeWatchlist()] as never);
    vi.mocked(db.radarDeliveryDestination.findMany).mockResolvedValue([
      makeDestination({
        channel: "discord_webhook",
        destinationUrl: "https://discord.com/api/webhooks/x/y",
      }),
    ] as never);

    const res = await POST(req({ dryRun: true }));
    const data = await res.json();

    expect(data.channelResults[0].previewMessages.map((message: { messageIndex: number }) => message.messageIndex)).toEqual([0, 1]);
    expect(data.channelResults[0].previewMessages[0].embed.title).toBe("Radar situational briefing");
  });

  it("dry run returns sanitized webhook JSON preview", async () => {
    vi.mocked(fetchSceAlertLedger).mockResolvedValue([
      makeLedgerEvent({ summary: "Webhook https://discord.com/api/webhooks/private/path" }),
    ] as never);
    vi.mocked(db.radarWatchlist.findMany).mockResolvedValue([makeWatchlist()] as never);
    vi.mocked(db.radarDeliveryDestination.findMany).mockResolvedValue([
      makeDestination({ channel: "webhook", destinationUrl: "https://example.test/hook" }),
    ] as never);

    const res = await POST(req({ dryRun: true }));
    const data = await res.json();
    const responseText = JSON.stringify(data.channelResults[0].previewMessages);

    expect(data.channelResults[0].previewMessages[0].json.type).toBe("manual_delivery_cycle");
    expect(responseText).not.toContain("discord.com/api/webhooks/private/path");
    expect(responseText).not.toContain("super-secret-webhook-path");
  });

  it("dry run returns public-thread preview messages in order", async () => {
    vi.mocked(fetchSceAlertLedger).mockResolvedValue([] as never);
    vi.mocked(db.radarWatchlist.findMany).mockResolvedValue([] as never);
    vi.mocked(db.radarDeliveryDestination.findMany).mockResolvedValue([
      makeDestination({ channel: "discord_webhook", deliveryMode: "public_thread" }),
    ] as never);
    vi.mocked(getLatestPublicThreadDelivery).mockResolvedValue({
      source: "approved",
      previewHash: "hash-1",
      approvedPreviewHash: "hash-1",
      posts: [{ text: "First public post" }, { text: "Second public post" }],
    } as never);

    const res = await POST(req({ dryRun: true }));
    const data = await res.json();

    expect(data.channelResults[0].previewMessages.map((message: { text: string }) => message.text)).toEqual([
      "First public post",
      "Second public post",
    ]);
  });

  it("sends a mocked HTTP request for webhook delivery", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    vi.mocked(fetchSceAlertLedger).mockResolvedValue([makeLedgerEvent()] as never);
    vi.mocked(db.radarWatchlist.findMany).mockResolvedValue([makeWatchlist()] as never);
    vi.mocked(db.radarDeliveryDestination.findMany).mockResolvedValue([
      makeDestination({ channel: "webhook", destinationUrl: "https://example.test/hook" }),
    ] as never);

    const res = await POST(req({ dryRun: false }));
    const data = await res.json();

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.test/hook",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"briefing"'),
      }),
    );
    expect(data.channelResults[0].status).toBe("sent");
    expect(data.deliveriesSucceeded).toBe(1);
    expect(data.channelResults[0].briefingCount).toBe(1);
    expect(data.channelResults[0].previewMessages).toBeUndefined();
  });

  it("sends a mocked webhook request for Discord delivery", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    vi.mocked(fetchSceAlertLedger).mockResolvedValue([makeLedgerEvent()] as never);
    vi.mocked(db.radarWatchlist.findMany).mockResolvedValue([makeWatchlist()] as never);
    vi.mocked(db.radarDeliveryDestination.findMany).mockResolvedValue([
      makeDestination({
        channel: "discord_webhook",
        destinationUrl: "https://discord.com/api/webhooks/x/y",
      }),
    ] as never);

    const res = await POST(req({ dryRun: false }));
    const data = await res.json();

    expect(fetchMock).toHaveBeenCalledWith(
      "https://discord.com/api/webhooks/x/y",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("Radar situational briefing"),
      }),
    );
    expect(data.channelResults[0].status).toBe("sent");
    expect(data.channelResults[0].groupsGenerated).toBe(1);
  });

  it("sends a mocked bot request for Telegram delivery", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, result: { message_id: 7 } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    vi.mocked(fetchSceAlertLedger).mockResolvedValue([makeLedgerEvent()] as never);
    vi.mocked(db.radarWatchlist.findMany).mockResolvedValue([makeWatchlist()] as never);
    vi.mocked(db.radarDeliveryDestination.findMany).mockResolvedValue([
      makeDestination({ channel: "telegram_bot", destinationUrl: "-1009999" }),
    ] as never);

    const res = await POST(req({ dryRun: false }));
    const data = await res.json();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("api.telegram.org/bot123456:super-secret-bot-token"),
      expect.objectContaining({
        body: expect.stringContaining("SCE Radar brief"),
      }),
    );
    expect(data.channelResults[0].status).toBe("sent");
  });

  it("sends oversized Telegram briefings as multiple ordered bot messages", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, result: { message_id: 7 } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, result: { message_id: 8 } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, result: { message_id: 9 } }),
      })
      .mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, result: { message_id: 10 } }),
      });
    vi.stubGlobal("fetch", fetchMock);

    vi.mocked(fetchSceAlertLedger).mockResolvedValue([
      makeLedgerEvent({
        whatHappened: "x".repeat(5000),
        whyItMatters: "y".repeat(2500),
        radarStatus: "z".repeat(2000),
        nextWatch: "n".repeat(1500),
      }),
    ] as never);
    vi.mocked(db.radarWatchlist.findMany).mockResolvedValue([makeWatchlist()] as never);
    vi.mocked(db.radarDeliveryDestination.findMany).mockResolvedValue([
      makeDestination({ channel: "telegram_bot", destinationUrl: "-1009999" }),
    ] as never);

    const res = await POST(req({ dryRun: false }));
    const data = await res.json();

    expect(data.channelResults[0].status).toBe("sent");
    expect(data.channelResults[0].messageCount).toBeGreaterThan(1);
    expect(fetchMock).toHaveBeenCalledTimes(data.channelResults[0].messageCount);
    for (const call of fetchMock.mock.calls) {
      const request = call[1] as { body?: string } | undefined;
      const body = JSON.parse(request?.body ?? "{}") as { text?: string };
      expect(typeof body.text).toBe("string");
      expect(body.text!.length).toBeLessThanOrEqual(3516);
    }
  });

  it("returns blocked with x_sender_unavailable for an X destination", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    vi.mocked(fetchSceAlertLedger).mockResolvedValue([makeLedgerEvent()] as never);
    vi.mocked(db.radarWatchlist.findMany).mockResolvedValue([makeWatchlist()] as never);
    vi.mocked(db.radarDeliveryDestination.findMany).mockResolvedValue([
      makeDestination({ channel: "x_account", destinationUrl: "@handle" }),
    ] as never);

    const res = await POST(req({ dryRun: false }));
    const data = await res.json();

    expect(data.channelResults[0]).toMatchObject({
      status: "blocked",
      reason: "x_sender_unavailable",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("blocks public_thread destinations when no approved preview is available", async () => {
    vi.mocked(fetchSceAlertLedger).mockResolvedValue([] as never);
    vi.mocked(db.radarWatchlist.findMany).mockResolvedValue([] as never);
    vi.mocked(db.radarDeliveryDestination.findMany).mockResolvedValue([
      makeDestination({ deliveryMode: "public_thread" }),
    ] as never);

    const res = await POST(req({ dryRun: false }));
    const data = await res.json();

    expect(data.channelResults[0]).toMatchObject({
      deliveryMode: "public_thread",
      status: "blocked",
      reason: "approved_public_thread_required",
    });
  });

  it("sends approved public_thread posts instead of raw alert fanout", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    vi.mocked(fetchSceAlertLedger).mockResolvedValue([] as never);
    vi.mocked(db.radarWatchlist.findMany).mockResolvedValue([] as never);
    vi.mocked(db.radarDeliveryDestination.findMany).mockResolvedValue([
      makeDestination({ channel: "discord_webhook", deliveryMode: "public_thread" }),
    ] as never);
    vi.mocked(getLatestPublicThreadDelivery).mockResolvedValue({
      source: "approved",
      previewHash: "hash-1",
      approvedPreviewHash: "hash-1",
      posts: [{ text: "First public post" }, { text: "Second public post" }],
    } as never);

    const res = await POST(req({ dryRun: false }));
    const data = await res.json();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://example.test/super-secret-webhook-path",
      expect.objectContaining({ body: JSON.stringify({ content: "First public post" }) }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://example.test/super-secret-webhook-path",
      expect.objectContaining({ body: JSON.stringify({ content: "Second public post" }) }),
    );
    expect(data.channelResults[0]).toMatchObject({
      deliveryMode: "public_thread",
      status: "sent",
      messageCount: 2,
    });
  });

  it("preserves public_thread post order", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, result: { message_id: 7 } }),
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.mocked(fetchSceAlertLedger).mockResolvedValue([] as never);
    vi.mocked(db.radarWatchlist.findMany).mockResolvedValue([] as never);
    vi.mocked(db.radarDeliveryDestination.findMany).mockResolvedValue([
      makeDestination({
        channel: "telegram_bot",
        destinationUrl: "-1009999",
        deliveryMode: "public_thread",
      }),
    ] as never);
    vi.mocked(getLatestPublicThreadDelivery).mockResolvedValue({
      source: "approved",
      previewHash: "hash-1",
      approvedPreviewHash: "hash-1",
      posts: [{ text: "one" }, { text: "two" }, { text: "three" }],
    } as never);

    await POST(req({ dryRun: false }));

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][1].body).toContain('"text":"one"');
    expect(fetchMock.mock.calls[1][1].body).toContain('"text":"two"');
    expect(fetchMock.mock.calls[2][1].body).toContain('"text":"three"');
  });

  it("sends a grouped digest for digest mode", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    vi.mocked(fetchSceAlertLedger).mockResolvedValue([
      makeLedgerEvent({ alertId: "a1", eventId: "e1", severity: "critical", summary: "Critical issue" }),
      makeLedgerEvent({ alertId: "a2", eventId: "e2", severity: "warning", summary: "Warning issue" }),
    ] as never);
    vi.mocked(db.radarWatchlist.findMany).mockResolvedValue([makeWatchlist()] as never);
    vi.mocked(db.radarDeliveryDestination.findMany).mockResolvedValue([
      makeDestination({ deliveryMode: "digest" }),
    ] as never);

    const res = await POST(req({ dryRun: false }));
    const data = await res.json();

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.test/super-secret-webhook-path",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"type":"digest_delivery"'),
      }),
    );
    expect(data.channelResults[0]).toMatchObject({
      deliveryMode: "digest",
      status: "sent",
      messageCount: 1,
      briefingCount: 1,
      groupsGenerated: 1,
    });
  });

  it("skips digest mode cleanly when no matched alerts are available", async () => {
    vi.mocked(fetchSceAlertLedger).mockResolvedValue([makeLedgerEvent()] as never);
    vi.mocked(db.radarWatchlist.findMany).mockResolvedValue([] as never);
    vi.mocked(db.radarDeliveryDestination.findMany).mockResolvedValue([
      makeDestination({ deliveryMode: "digest" }),
    ] as never);

    const res = await POST(req({ dryRun: false }));
    const data = await res.json();

    expect(data.status).toBe("no_matches");
    expect(data.channelResults[0]).toMatchObject({
      deliveryMode: "digest",
      status: "skipped",
      reason: "no_matched_alerts_for_digest",
    });
  });

  it("writes delivery logs without secrets and never exposes the SCE admin key or destination secrets", async () => {
    process.env.SCE_ADMIN_API_KEY = "super-secret-admin-key";
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    vi.mocked(fetchSceAlertLedger).mockResolvedValue([makeLedgerEvent()] as never);
    vi.mocked(db.radarWatchlist.findMany).mockResolvedValue([makeWatchlist()] as never);
    vi.mocked(db.radarDeliveryDestination.findMany).mockResolvedValue([
      makeDestination({
        channel: "webhook",
        destinationUrl: "https://example.test/super-secret-webhook-path",
        configEncrypted: "encrypted-blob-should-never-leak",
      }),
    ] as never);

    const res = await POST(req({ dryRun: false }));
    const data = await res.json();
    const responseText = JSON.stringify(data);

    expect(db.radarDeliveryLog.create).toHaveBeenCalledOnce();
    const logData = vi.mocked(db.radarDeliveryLog.create).mock.calls[0][0].data;
    expect(logData).not.toHaveProperty("configEncrypted");
    expect(JSON.stringify(logData)).not.toContain("encrypted-blob-should-never-leak");
    expect(JSON.stringify(logData)).not.toContain("super-secret-admin-key");

    expect(responseText).not.toContain("super-secret-admin-key");
    expect(responseText).not.toContain("encrypted-blob-should-never-leak");
    expect(responseText).not.toContain("super-secret-webhook-path");
    expect(responseText).not.toContain("super-secret-bot-token");
  });

  it("rejects an invalid window value", async () => {
    const res = await POST(req({ window: "2h" }));
    expect(res.status).toBe(400);
  });

  it("rejects an invalid channels value", async () => {
    const res = await POST(req({ channels: ["carrier_pigeon"] }));
    expect(res.status).toBe(400);
  });
});
