import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SceAlert } from "./sce-alerts";
import {
  buildAnnouncementDetailsUrl,
  buildAnnouncementPreviewMessages,
  buildAnnouncementTags,
  buildAnnouncementTelegramText,
  buildAnnouncementWebhookPayload,
  buildAlertFanoutPreviewMessages,
  buildDigestDiscordEmbeds,
  buildDigestPreviewMessages,
  buildDigestSummary,
  buildDigestTelegramText,
  buildDigestTelegramTextParts,
  buildDigestWebhookPayload,
  buildDiscordEmbeds,
  buildPublicThreadPreviewMessages,
  buildPublicThreadWebhookPayload,
  buildTelegramText,
  buildTelegramTextParts,
  buildWebhookPayload,
  sendDiscordEmbeds,
  sendDiscordTextPosts,
  sendTelegramMessage,
  sendTelegramTextPosts,
  sendWebhook,
} from "./delivery-senders";

const ORIGINAL_ENV = { ...process.env };
const DELIVERY_META = {
  window: "1h",
  windowStart: "2026-07-03T11:00:00Z",
  windowEnd: "2026-07-03T12:00:00Z",
};

function makeAlert(overrides: Partial<SceAlert> = {}): SceAlert {
  return {
    id: "RADAR-1",
    monitorType: "oracle",
    provider: "Chainlink",
    chain: "Ethereum",
    asset: "USDC",
    assetPair: "USDC/USD",
    route: null,
    poolName: null,
    objectId: "oracle-feed:chainlink:eth:usdc-usd",
    objectType: "oracle_feed",
    purpose: "sagitta_dependency",
    severity: "warning",
    status: "active",
    reasonCode: "ORACLE_STALE",
    summary: "Chainlink USDC/USD on Ethereum is stale beyond expected heartbeat.",
    publicSummary: "Chainlink USDC/USD on Ethereum is stale beyond expected heartbeat.",
    signalClass: "coverage",
    evidenceSummary: "Heartbeat delayed",
    tags: [],
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
    createdAt: "2026-07-03T11:00:00Z",
    updatedAt: "2026-07-03T11:50:00Z",
    ...overrides,
  };
}

describe("payload builders", () => {
  it("builds a webhook payload with grouped briefing and raw alert content", () => {
    const payload = buildWebhookPayload([makeAlert()], DELIVERY_META);
    expect(payload.source).toBe("radar.sagitta.systems");
    expect(payload.window).toBe("1h");
    expect(payload.alerts).toHaveLength(1);
    expect(payload.alerts[0]).toMatchObject({
      id: "RADAR-1",
      severityExplanation: "Warning: the price feed has not refreshed on schedule and may be stale.",
    });
    expect(payload.briefing.groups[0].title).toBe("Oracle Freshness Cluster - Chainlink");
  });

  it("creates grouped Discord embeds instead of one embed per alert", () => {
    const embeds = buildDiscordEmbeds(
      [
        makeAlert({ id: "a1", asset: "USDC", assetPair: "USDC/USD" }),
        makeAlert({ id: "a2", asset: "USDe", assetPair: "USDe/USD" }),
      ],
      DELIVERY_META,
    );

    expect(embeds).toHaveLength(2);
    expect(embeds[0]).toMatchObject({ title: "Radar situational briefing" });
    expect(embeds[1]).toMatchObject({ title: "Oracle Freshness Cluster - Chainlink" });
  });

  it("builds Telegram text without repeating raw stale summaries per alert", () => {
    const text = buildTelegramText(
      [
        makeAlert({ id: "a1", asset: "USDC", assetPair: "USDC/USD" }),
        makeAlert({ id: "a2", asset: "USDe", assetPair: "USDe/USD" }),
        makeAlert({ id: "a3", asset: "GHO", assetPair: "GHO/USD" }),
      ],
      DELIVERY_META,
    );

    expect(text).toContain("SCE Radar brief - 1h window");
    expect(text).toContain("Impact:");
    expect(text).toContain("Status:");
    expect(text).toContain("Oracle Freshness Cluster - Chainlink");
    expect(text).toContain("Warning (3)");
    expect(text.match(/stale beyond expected heartbeat/gi)?.length ?? 0).toBe(0);
  });

  it("builds a grouped digest summary", () => {
    const summary = buildDigestSummary([
      makeAlert({ id: "a1", severity: "critical", monitorType: "oracle" }),
      makeAlert({ id: "a2", severity: "warning", monitorType: "bridge" }),
      makeAlert({ id: "a3", severity: "warning", monitorType: "bridge" }),
    ]);
    expect(summary.alertCount).toBe(3);
    expect(summary.countsBySeverity).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "warning", count: 2 }),
        expect.objectContaining({ key: "critical", count: 1 }),
      ]),
    );
    expect(summary.countsByMonitorType).toEqual(
      expect.arrayContaining([expect.objectContaining({ key: "bridge", count: 2 })]),
    );
  });

  it("builds digest payloads for webhook, Discord, and Telegram using the briefing format", () => {
    const alerts = [makeAlert({ summary: "digest-summary-marker" })];
    const webhookPayload = buildDigestWebhookPayload(alerts, DELIVERY_META);
    const embeds = buildDigestDiscordEmbeds(alerts, DELIVERY_META);
    const telegramText = buildDigestTelegramText(alerts, DELIVERY_META);

    expect(webhookPayload.type).toBe("digest_delivery");
    expect(webhookPayload.briefing.groups[0].title).toBe("Oracle Freshness Cluster - Chainlink");
    expect(embeds[0]).toMatchObject({ title: "Radar situational briefing" });
    expect(telegramText).toContain("SCE Radar brief - 1h window");
  });

  it("uses deterministic fallback text when explanation fields are missing", () => {
    const text = buildTelegramText(
      [
        makeAlert({
          monitorType: "lp",
          provider: "Curve",
          reasonCode: "LP_POOL_IMBALANCE",
          severityExplanation: null,
          thresholdExplanation: null,
          humanRiskSummary: null,
          whatHappened: null,
          whyItMatters: null,
          radarStatus: null,
          nextWatch: null,
          evidenceExplanation: null,
          evidenceSummary: null,
        }),
      ],
      DELIVERY_META,
    );

    expect(text).toContain("Impact: SCE did not provide additional impact text for this group.");
    expect(text).toContain("Warning (1)");
    expect(text).not.toMatch(/\b(hacked|exploit|attack|manipulated|unsafe|depeg|insolvent|broken)\b/i);
  });

  it("builds a public thread webhook payload with ordered posts", () => {
    const payload = buildPublicThreadWebhookPayload(
      {
        source: "approved",
        previewHash: "hash-1",
        approvedPreviewHash: "hash-1",
        posts: [{ text: "post 1" }, { text: "post 2" }],
      },
      {
        window: "15min",
        windowStart: "2026-07-03T11:45:00Z",
        windowEnd: "2026-07-03T12:00:00Z",
      },
    );

    expect(payload.type).toBe("public_thread_delivery");
    expect(payload.posts.map((post) => post.text)).toEqual(["post 1", "post 2"]);
  });

  it("builds one announcement-feed preview per eligible alert and generates deterministic tags", () => {
    process.env.RADAR_PUBLIC_BASE_URL = "https://radar.example.test/";
    const alerts = [
      {
        ...makeAlert({
          id: "RADAR-ANN-1",
          chain: "Base",
          provider: "Chainlink",
          asset: "USDC",
          assetPair: "USDC/USD",
          severity: "critical",
          observedValueLabel: "Observed feed age: 18h 27m",
          thresholdValueLabel: "Threshold: 12h",
        }),
        eventId: "evt_1",
        eventType: "alert_opened",
      },
      {
        ...makeAlert({
          id: "RADAR-ANN-2",
          chain: "Ethereum",
          provider: "Curve",
          monitorType: "lp",
          asset: "FRAX",
          assetPair: "FRAX/USDC",
          reasonCode: "LP_POOL_IMBALANCE",
          observedValueLabel: "Observed imbalance: 41.0%",
          thresholdValueLabel: "Threshold: 25.0%",
        }),
        eventId: "evt_2",
        eventType: "severity_changed",
      },
    ];

    const previews = buildAnnouncementPreviewMessages("telegram_bot", alerts, DELIVERY_META);

    expect(previews).toHaveLength(2);
    expect(previews[0].text).toContain("Details: https://radar.example.test/alerts/RADAR-ANN-1");
    expect(previews[0].text).toContain("#RadarAlert #OracleAlert #DeFiRisk #CryptoAlerts #Chainlink #Base $USDC");
    expect(previews[1].text).toContain("#LPAlert");
    expect(previews[1].text).toContain("$FRAX $USDC");
  });

  it("builds announcement-feed payloads for webhook delivery with per-alert structure", () => {
    process.env.RADAR_PUBLIC_BASE_URL = "https://radar.example.test";
    const payload = buildAnnouncementWebhookPayload(
      {
        ...makeAlert({
          id: "RADAR-ANN-3",
          chain: "Base",
          severity: "critical",
          assetPair: "USDC/USD",
          observedValueLabel: "Observed feed age: 18h 27m",
          thresholdValueLabel: "Threshold: 12h",
        }),
        eventId: "evt_3",
        eventType: "alert_updated",
        sourceAlertUpdatedAt: "2026-07-03T11:59:00Z",
      },
      DELIVERY_META,
    );

    expect(payload).toMatchObject({
      type: "announcement_feed_delivery",
      deliveryMode: "announcement_feed",
      alertId: "RADAR-ANN-3",
      eventId: "evt_3",
      eventType: "alert_updated",
      detailsUrl: "https://radar.example.test/alerts/RADAR-ANN-3",
    });
  });

  it("sanitizes and dedupes announcement-feed tags from trusted alert fields", () => {
    const tags = buildAnnouncementTags({
      ...makeAlert({
        provider: "Chain-link",
        chain: "Base!!",
        asset: "USDC",
        assetPair: "USDC/USD",
      }),
      eventId: "evt_4",
      eventType: "alert_opened",
    });

    expect(tags.hashtags).toEqual(
      expect.arrayContaining(["#RadarAlert", "#OracleAlert", "#Chainlink", "#Base"]),
    );
    expect(tags.cashtags).toEqual(["$USDC"]);
  });

  it("builds compact announcement-feed Telegram posts", () => {
    process.env.RADAR_PUBLIC_BASE_URL = "https://radar.example.test";
    const text = buildAnnouncementTelegramText({
      ...makeAlert({
        id: "RADAR-ANN-4",
        severity: "critical",
        observedValueLabel: "Observed feed age: 18h 27m",
        thresholdValueLabel: "Threshold: 12h",
      }),
      eventId: "evt_5",
      eventType: "alert_opened",
      sourceAlertUpdatedAt: "2026-07-03T11:59:00Z",
    });

    expect(text).toContain("Radar Alert");
    expect(text).toContain("Feed age: 18h 27m");
    expect(text).toContain("Critical threshold: 12h");
    expect(text).toContain("Details: https://radar.example.test/alerts/RADAR-ANN-4");
  });

  it("builds Telegram dry-run preview messages with character counts", () => {
    const previews = buildAlertFanoutPreviewMessages("telegram_bot", [makeAlert()], DELIVERY_META);

    expect(previews).toHaveLength(1);
    expect(previews[0]).toMatchObject({
      messageIndex: 0,
      format: "telegram_text",
      truncated: false,
    });
    expect(previews[0].text).toContain("SCE Radar brief - 1h window");
    expect(previews[0].characterCount).toBe(previews[0].text?.length);
  });

  it("splits oversized Telegram previews into multiple ordered messages", () => {
    const previews = buildAlertFanoutPreviewMessages(
      "telegram_bot",
      [
        makeAlert({
          thresholdExplanation: "Threshold crossed after 300 seconds.",
          whatHappened: "x".repeat(5000),
          whyItMatters: "y".repeat(2500),
          radarStatus: "z".repeat(2000),
          nextWatch: "n".repeat(1500),
        }),
      ],
      DELIVERY_META,
    );

    expect(previews.length).toBeGreaterThan(1);
    expect(previews.map((preview) => preview.messageIndex)).toEqual(
      previews.map((_, index) => index),
    );
    expect(previews.every((preview) => preview.truncated === false)).toBe(true);
    expect(previews.every((preview) => (preview.text?.length ?? 0) <= 3500)).toBe(true);
  });

  it("splits raw Telegram briefing text into delivery-sized parts", () => {
    const parts = buildTelegramTextParts(
      [
        makeAlert({
          thresholdExplanation: "Threshold crossed after 300 seconds.",
          whatHappened: "x".repeat(5000),
          whyItMatters: "y".repeat(2500),
          radarStatus: "z".repeat(2000),
          nextWatch: "n".repeat(1500),
        }),
      ],
      DELIVERY_META,
    );

    expect(parts.length).toBeGreaterThan(1);
    expect(parts.every((part) => part.length <= 3500)).toBe(true);
  });

  it("splits digest Telegram briefing text into delivery-sized parts", () => {
    const parts = buildDigestTelegramTextParts(
      [
        makeAlert({
          thresholdExplanation: "Threshold crossed after 300 seconds.",
          whatHappened: "x".repeat(5000),
          whyItMatters: "y".repeat(2500),
          radarStatus: "z".repeat(2000),
          nextWatch: "n".repeat(1500),
        }),
      ],
      DELIVERY_META,
    );

    expect(parts.length).toBeGreaterThan(1);
    expect(parts.every((part) => part.length <= 3500)).toBe(true);
  });

  it("builds ordered Discord embed preview messages", () => {
    const previews = buildAlertFanoutPreviewMessages(
      "discord_webhook",
      [
        makeAlert({ id: "a1", asset: "USDC", assetPair: "USDC/USD" }),
        makeAlert({ id: "a2", asset: "USDe", assetPair: "USDe/USD" }),
      ],
      DELIVERY_META,
    );

    expect(previews.map((preview) => preview.messageIndex)).toEqual([0, 1]);
    expect(previews[0].format).toBe("discord_embed");
    expect(previews[0].embed).toMatchObject({ title: "Radar situational briefing" });
    expect(previews[1].embed).toMatchObject({ title: "Oracle Freshness Cluster - Chainlink" });
  });

  it("builds sanitized webhook JSON previews", () => {
    const previews = buildAlertFanoutPreviewMessages(
      "webhook",
      [makeAlert({ summary: "See https://discord.com/api/webhooks/secret/path" })],
      DELIVERY_META,
    );

    expect(previews).toHaveLength(1);
    expect(previews[0].format).toBe("webhook_json");
    expect(previews[0].json).toMatchObject({
      source: "radar.sagitta.systems",
      type: "manual_delivery_cycle",
      alertIds: ["RADAR-1"],
    });
    expect(JSON.stringify(previews[0])).not.toContain("discord.com/api/webhooks/secret/path");
  });

  it("marks long preview text as truncated", () => {
    const previews = buildPublicThreadPreviewMessages(
      "discord_webhook",
      {
        source: "approved",
        previewHash: "hash-1",
        approvedPreviewHash: "hash-1",
        posts: [{ text: "x".repeat(5000) }],
      },
      {
        window: "15min",
        windowStart: "2026-07-03T11:45:00Z",
        windowEnd: "2026-07-03T12:00:00Z",
      },
    );

    expect(previews[0].truncated).toBe(true);
    expect(previews[0].warning).toMatch(/truncated/i);
    expect(previews[0].characterCount).toBeGreaterThan((previews[0].text?.length ?? 0));
  });

  it("builds digest preview text for Telegram digest mode", () => {
    const previews = buildDigestPreviewMessages("telegram_bot", [makeAlert()], DELIVERY_META);
    expect(previews[0]).toMatchObject({ format: "digest_text" });
    expect(previews[0].text).toContain("SCE Radar brief - 1h window");
  });

  it("builds public-thread preview messages in order", () => {
    const previews = buildPublicThreadPreviewMessages(
      "discord_webhook",
      {
        source: "approved",
        previewHash: "hash-1",
        approvedPreviewHash: "hash-1",
        posts: [{ text: "first post" }, { text: "second post" }],
      },
      {
        window: "15min",
        windowStart: "2026-07-03T11:45:00Z",
        windowEnd: "2026-07-03T12:00:00Z",
      },
    );

    expect(previews.map((preview) => preview.messageIndex)).toEqual([0, 1]);
    expect(previews.map((preview) => preview.text)).toEqual(["first post", "second post"]);
  });

  it("builds deterministic announcement-feed alert details URLs", () => {
    process.env.RADAR_PUBLIC_BASE_URL = "https://radar.example.test/";
    expect(buildAnnouncementDetailsUrl("RADAR-20260706-74530549")).toBe(
      "https://radar.example.test/alerts/RADAR-20260706-74530549",
    );
  });
});

describe("senders", () => {
  beforeEach(() => {
    process.env.RADAR_TELEGRAM_BOT_TOKEN = "123456:test-bot-token";
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.unstubAllGlobals();
  });

  it("sendWebhook posts JSON and returns ok on 2xx", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendWebhook("https://example.test/hook", { a: 1 });

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.test/hook",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("sendWebhook sanitizes non-2xx responses without leaking the URL", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    const result = await sendWebhook("https://example.test/hook", {});
    expect(result.ok).toBe(false);
    expect(result.sanitizedError).toBe("Webhook endpoint returned 500");
  });

  it("sendDiscordEmbeds posts to the webhook URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    const result = await sendDiscordEmbeds("https://discord.com/api/webhooks/x/y", [{ title: "t" }]);
    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("sendDiscordTextPosts preserves the post order", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendDiscordTextPosts("https://discord.com/api/webhooks/x/y", [
      "first",
      "second",
    ]);

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://discord.com/api/webhooks/x/y",
      expect.objectContaining({ body: JSON.stringify({ content: "first" }) }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://discord.com/api/webhooks/x/y",
      expect.objectContaining({ body: JSON.stringify({ content: "second" }) }),
    );
  });

  it("sendTelegramMessage posts to the bot API using the server-side token", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, result: { message_id: 42 } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendTelegramMessage("-100123", "hello");

    expect(result.ok).toBe(true);
    expect(result.externalIds).toEqual(["42"]);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("123456:test-bot-token"),
      expect.anything(),
    );
  });

  it("sendTelegramMessage never leaks the bot token in a sanitized error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ ok: false, description: "Bad request to bot123456:test-bot-token/sendMessage" }),
      }),
    );

    const result = await sendTelegramMessage("-100123", "hello");

    expect(result.ok).toBe(false);
    expect(result.sanitizedError).not.toContain("test-bot-token");
  });

  it("sendTelegramMessage fails clearly when no bot token is configured", async () => {
    delete process.env.RADAR_TELEGRAM_BOT_TOKEN;
    const result = await sendTelegramMessage("-100123", "hello");
    expect(result.ok).toBe(false);
    expect(result.sanitizedError).toMatch(/not configured/i);
  });

  it("sendTelegramTextPosts preserves order and returns collected message ids", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, result: { message_id: 1 } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, result: { message_id: 2 } }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendTelegramTextPosts("-100123", ["first", "second"]);

    expect(result.ok).toBe(true);
    expect(result.externalIds).toEqual(["1", "2"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
