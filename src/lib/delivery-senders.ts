import type { PublicThreadDelivery } from "./public-thread";
import type { SceAlert } from "./sce-alerts";
import {
  buildSituationalBriefing,
  buildSituationalBriefingDiscordEmbeds,
  buildSituationalBriefingTelegramText,
  type SituationalBriefingMeta,
} from "./situational-briefing";

export interface SendResult {
  ok: boolean;
  sanitizedError?: string;
  externalIds?: string[];
}

export type PreviewMessageFormat =
  | "telegram_text"
  | "discord_embed"
  | "discord_text"
  | "webhook_json"
  | "public_thread_text"
  | "digest_text";

export interface DeliveryPreviewMessage {
  messageIndex: number;
  format: PreviewMessageFormat;
  title?: string;
  text?: string;
  embed?: Record<string, unknown>;
  json?: Record<string, unknown>;
  characterCount: number;
  truncated: boolean;
  warning?: string;
}

export interface AnnouncementFeedAlert extends SceAlert {
  eventId?: string | null;
  eventType?: string | null;
  sourceAlertUpdatedAt?: string | null;
}

const DISCORD_EMBED_LIMIT = 10;
const TELEGRAM_TEXT_LIMIT = 3500;
const DIGEST_TOP_ALERT_LIMIT = 5;
const PREVIEW_TEXT_LIMIT = 4000;
const ANNOUNCEMENT_HASHTAG_LIMIT = 6;
const ANNOUNCEMENT_CASHTAG_LIMIT = 4;
const ANNOUNCEMENT_QUOTE_TOKEN_DENYLIST = new Set(["USD"]);

// Radar Alert Threshold Doctrine v1.0 legend: watch blue, warning orange,
// critical red. (info falls through to brand purple.)
function severityColor(severity: string): number {
  switch (severity) {
    case "critical":
      return 0xdc2626;
    case "warning":
      return 0xf97316;
    case "watch":
      return 0x3b82f6;
    default:
      return 0x8b5cf6;
  }
}

function firstString(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return null;
}

function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter((part) => part.length > 0)
    .map((part) => part[0].toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function sanitizeHashtagToken(value: string): string | null {
  const cleaned = value.replace(/[^A-Za-z0-9]+/g, "");
  return cleaned.length > 0 ? cleaned : null;
}

function sanitizeCashtagToken(value: string): string | null {
  const cleaned = value.toUpperCase().replace(/[^A-Z0-9]+/g, "");
  return cleaned.length > 0 ? cleaned : null;
}

function dedupeTokens(values: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const value of values) {
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(value);
  }
  return unique;
}

function monitorTypeLabel(monitorType: string): string {
  switch (monitorType.trim().toLowerCase()) {
    case "lp":
      return "LP";
    case "sce_heartbeat":
      return "Infrastructure";
    default:
      return titleCase(monitorType);
  }
}

function severityLabel(severity: string): string {
  switch (severity.trim().toLowerCase()) {
    case "critical":
      return "Critical";
    case "warning":
      return "Warning";
    case "watch":
      return "Watch";
    default:
      return "Alert";
  }
}

function announcementBanner(severity: string): string {
  switch (severity.trim().toLowerCase()) {
    case "critical":
      return "🔴 Radar Alert";
    case "warning":
      return "🟠 Radar Warning";
    default:
      return "🟡 Radar Watch";
  }
}

function announcementMonitorHashtag(monitorType: string): string {
  switch (monitorType.trim().toLowerCase()) {
    case "oracle":
      return "OracleAlert";
    case "lp":
      return "LPAlert";
    case "bridge":
      return "BridgeAlert";
    case "governance":
      return "GovernanceAlert";
    case "dependency":
      return "DependencyAlert";
    case "sce_heartbeat":
      return "InfrastructureAlert";
    default:
      return `${monitorTypeLabel(monitorType).replace(/[^A-Za-z0-9]+/g, "")}Alert`;
  }
}

function extractAssetSymbols(alert: AnnouncementFeedAlert): string[] {
  const raw = [alert.assetPair, alert.asset]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .flatMap((value) => value.split(/[^A-Za-z0-9]+/g))
    .map((value) => sanitizeCashtagToken(value))
    .filter((value): value is string => value !== null && !ANNOUNCEMENT_QUOTE_TOKEN_DENYLIST.has(value));
  return dedupeTokens(raw).slice(0, ANNOUNCEMENT_CASHTAG_LIMIT);
}

function formatAnnouncementAssetDisplay(alert: AnnouncementFeedAlert): string | null {
  const source = firstString(alert.assetPair, alert.asset);
  if (!source) return null;
  const symbols = source
    .split(/[^A-Za-z0-9]+/g)
    .map((value) => sanitizeCashtagToken(value))
    .filter((value): value is string => value !== null);
  if (symbols.length === 0) return null;
  if (symbols.length === 1) return `$${symbols[0]}`;
  const [base, quote] = symbols;
  return quote === "USD" ? `$${base}/USD` : `$${base}/$${quote}`;
}

function buildAnnouncementTags(alert: AnnouncementFeedAlert): {
  hashtags: string[];
  cashtags: string[];
} {
  const hashtags = dedupeTokens(
    [
      "RadarAlert",
      announcementMonitorHashtag(alert.monitorType),
      "DeFiRisk",
      "CryptoAlerts",
      sanitizeHashtagToken(firstString(alert.provider) ?? ""),
      sanitizeHashtagToken(firstString(alert.chain) ?? ""),
    ].filter((value): value is string => typeof value === "string" && value.length > 0),
  )
    .slice(0, ANNOUNCEMENT_HASHTAG_LIMIT)
    .map((value) => `#${value}`);
  const cashtags = extractAssetSymbols(alert).map((value) => `$${value}`);
  return { hashtags, cashtags };
}

function buildAnnouncementDetailsUrl(alertId: string): string {
  const baseUrl = (process.env.RADAR_PUBLIC_BASE_URL ?? "https://radar.sagitta.systems").trim();
  return `${baseUrl.replace(/\/+$/, "")}/alerts/${encodeURIComponent(alertId)}`;
}

function cleanAnnouncementMetricValue(value: string | null | undefined): string | null {
  const trimmed = firstString(value);
  if (!trimmed) return null;
  return trimmed
    .replace(/^Observed\s+/i, "")
    .replace(/^Threshold:\s*/i, "")
    .replace(/^[A-Za-z _-]+:\s*/i, "")
    .trim();
}

function announcementMetricLabels(alert: AnnouncementFeedAlert): {
  observedLabel: string;
  thresholdLabel: string;
} {
  switch (alert.reasonCode.trim().toUpperCase()) {
    case "ORACLE_STALE":
      return {
        observedLabel: "Feed age",
        thresholdLabel: `${severityLabel(alert.severity)} threshold`,
      };
    case "ORACLE_REFERENCE_DEVIATION":
      return {
        observedLabel: "Deviation",
        thresholdLabel: `${severityLabel(alert.severity)} threshold`,
      };
    case "LP_POOL_IMBALANCE":
      return {
        observedLabel: "Imbalance",
        thresholdLabel: `${severityLabel(alert.severity)} threshold`,
      };
    case "BRIDGE_ROUTE_LATENCY":
    case "BRIDGE_ROUTE_DELAYED":
      return {
        observedLabel: "Route delay",
        thresholdLabel: `${severityLabel(alert.severity)} threshold`,
      };
    default:
      return {
        observedLabel: "Observed",
        thresholdLabel: `${severityLabel(alert.severity)} threshold`,
      };
  }
}

function fallbackAnnouncementExplanation(alert: AnnouncementFeedAlert): string {
  switch (alert.reasonCode.trim().toUpperCase()) {
    case "ORACLE_STALE":
      return "The price feed is out of date; caution is advised until it updates.";
    case "LP_POOL_IMBALANCE":
      return "Pool balance concentration crossed Radar's threshold.";
    case "BRIDGE_ROUTE_LATENCY":
    case "BRIDGE_ROUTE_DELAYED":
      return "Route latency crossed Radar's threshold and is being monitored.";
    default:
      return "Radar is tracking an active infrastructure condition from SCE.";
  }
}

function fallbackAnnouncementStatus(alert: AnnouncementFeedAlert): string {
  switch (alert.reasonCode.trim().toUpperCase()) {
    case "LP_POOL_IMBALANCE":
      return "Watching for normalization.";
    case "ORACLE_STALE":
      return "Monitoring for update or resolution.";
    default:
      return "Monitoring for update or resolution.";
  }
}

function announcementProviderLabel(provider: string): string {
  const trimmed = provider.trim();
  if (trimmed.length === 0) return "Unknown provider";
  if (/[A-Z]/.test(trimmed)) return trimmed;
  return titleCase(trimmed);
}

function buildAnnouncementTitle(alert: AnnouncementFeedAlert): string {
  const providerToken = sanitizeHashtagToken(announcementProviderLabel(alert.provider));
  const chainToken = sanitizeHashtagToken(firstString(alert.chain) ?? "");
  const parts = [
    `${monitorTypeLabel(alert.monitorType)} ${severityLabel(alert.severity)}`,
    providerToken ? `#${providerToken}` : announcementProviderLabel(alert.provider),
    formatAnnouncementAssetDisplay(alert),
    chainToken ? `on #${chainToken}` : firstString(alert.chain),
  ].filter((value): value is string => typeof value === "string" && value.length > 0);
  return parts.join(" - ").replace(" - on #", " on #");
}

function buildAnnouncementExplanation(alert: AnnouncementFeedAlert): string {
  return (
    firstString(
      alert.whatHappened,
      alert.severityExplanation,
      alert.whyItMatters,
      alert.publicSummary,
      alert.summary,
    ) ?? fallbackAnnouncementExplanation(alert)
  );
}

function buildAnnouncementText(alert: AnnouncementFeedAlert): string {
  const { hashtags, cashtags } = buildAnnouncementTags(alert);
  const { observedLabel, thresholdLabel } = announcementMetricLabels(alert);
  const observedValue =
    cleanAnnouncementMetricValue(alert.observedValueLabel) ?? "not provided by SCE";
  const thresholdValue =
    cleanAnnouncementMetricValue(alert.thresholdValueLabel) ?? "not provided by SCE";
  const detailsUrl = buildAnnouncementDetailsUrl(alert.id);

  return [
    announcementBanner(alert.severity),
    "",
    buildAnnouncementTitle(alert),
    "",
    buildAnnouncementExplanation(alert),
    "",
    `${observedLabel}: ${observedValue}`,
    `${thresholdLabel}: ${thresholdValue}`,
    "",
    `Status: ${firstString(alert.radarStatus) ?? fallbackAnnouncementStatus(alert)}`,
    `Details: ${detailsUrl}`,
    "",
    [...hashtags, ...cashtags].join(" "),
  ].join("\n");
}

function buildAnnouncementDiscordEmbed(
  alert: AnnouncementFeedAlert,
): Record<string, unknown> {
  const { hashtags, cashtags } = buildAnnouncementTags(alert);
  const { observedLabel, thresholdLabel } = announcementMetricLabels(alert);
  return {
    title: announcementBanner(alert.severity),
    description: `${buildAnnouncementTitle(alert)}\n\n${buildAnnouncementExplanation(alert)}`,
    color: severityColor(alert.severity),
    fields: [
      {
        name: observedLabel,
        value: cleanAnnouncementMetricValue(alert.observedValueLabel) ?? "not provided by SCE",
        inline: true,
      },
      {
        name: thresholdLabel,
        value: cleanAnnouncementMetricValue(alert.thresholdValueLabel) ?? "not provided by SCE",
        inline: true,
      },
      {
        name: "Status",
        value: firstString(alert.radarStatus) ?? fallbackAnnouncementStatus(alert),
        inline: false,
      },
      {
        name: "Details",
        value: buildAnnouncementDetailsUrl(alert.id),
        inline: false,
      },
      {
        name: "Tags",
        value: [...hashtags, ...cashtags].join(" "),
        inline: false,
      },
    ],
    footer: { text: "radar.sagitta.systems" },
    timestamp: alert.sourceAlertUpdatedAt ?? alert.updatedAt,
  };
}

function buildAnnouncementWebhookPayload(
  alert: AnnouncementFeedAlert,
  meta: SituationalBriefingMeta,
): Record<string, unknown> {
  const { hashtags, cashtags } = buildAnnouncementTags(alert);
  const { observedLabel, thresholdLabel } = announcementMetricLabels(alert);
  return {
    source: "radar.sagitta.systems",
    type: "announcement_feed_delivery",
    deliveryMode: "announcement_feed",
    window: meta.window,
    windowStart: meta.windowStart,
    windowEnd: meta.windowEnd,
    generatedAt: new Date().toISOString(),
    alertId: alert.id,
    eventId: alert.eventId ?? null,
    eventType: alert.eventType ?? null,
    sourceAlertUpdatedAt: alert.sourceAlertUpdatedAt ?? alert.updatedAt,
    severity: alert.severity,
    status: alert.status,
    monitorType: alert.monitorType,
    provider: alert.provider,
    chain: alert.chain,
    object: {
      asset: alert.asset,
      assetPair: alert.assetPair ?? null,
      route: alert.route,
      poolName: alert.poolName ?? null,
      objectId: alert.objectId,
      objectType: alert.objectType ?? null,
    },
    explanation: buildAnnouncementExplanation(alert),
    observed: {
      label: observedLabel,
      value: cleanAnnouncementMetricValue(alert.observedValueLabel) ?? "not provided by SCE",
    },
    thresholdCrossed: {
      label: thresholdLabel,
      value: cleanAnnouncementMetricValue(alert.thresholdValueLabel) ?? "not provided by SCE",
      thresholdName: alert.thresholdName ?? null,
    },
    statusText: firstString(alert.radarStatus) ?? fallbackAnnouncementStatus(alert),
    detailsUrl: buildAnnouncementDetailsUrl(alert.id),
    hashtags,
    cashtags,
    tags: [...hashtags, ...cashtags],
    telegramText: buildAnnouncementText(alert),
  };
}

function alertLine(alert: {
  monitorType: string;
  provider: string;
  chain?: string | null;
  asset?: string | null;
  severity: string;
  summary: string;
}): string {
  const parts = [alert.monitorType, alert.provider, alert.chain, alert.asset].filter(Boolean);
  return `[${alert.severity.toUpperCase()}] ${parts.join(" - ")} - ${alert.summary}`;
}

function truncateTelegramText(text: string): string {
  if (text.length <= TELEGRAM_TEXT_LIMIT) return text;
  return `${text.slice(0, TELEGRAM_TEXT_LIMIT)}\n... (truncated)`;
}

function splitOversizedLine(line: string, limit: number): string[] {
  if (line.length <= limit) return [line];

  const parts: string[] = [];
  let remaining = line;
  while (remaining.length > limit) {
    const slice = remaining.slice(0, limit);
    const breakIndex = Math.max(slice.lastIndexOf(" "), slice.lastIndexOf("|"));
    const splitAt = breakIndex >= Math.floor(limit * 0.6) ? breakIndex : limit;
    parts.push(remaining.slice(0, splitAt).trimEnd());
    remaining = remaining.slice(splitAt).trimStart();
  }
  if (remaining.length > 0) parts.push(remaining);
  return parts;
}

function splitOversizedParagraph(paragraph: string, limit: number): string[] {
  if (paragraph.length <= limit) return [paragraph];

  const lines = paragraph.split("\n").flatMap((line) => splitOversizedLine(line, limit));
  const parts: string[] = [];
  let current = "";

  for (const line of lines) {
    const candidate = current.length === 0 ? line : `${current}\n${line}`;
    if (candidate.length <= limit) {
      current = candidate;
      continue;
    }
    if (current.length > 0) parts.push(current);
    current = line;
  }

  if (current.length > 0) parts.push(current);
  return parts;
}

function splitTelegramText(text: string): string[] {
  if (text.length <= TELEGRAM_TEXT_LIMIT) return [text];

  const paragraphs = text.split("\n\n").flatMap((paragraph) =>
    splitOversizedParagraph(paragraph, TELEGRAM_TEXT_LIMIT),
  );
  const parts: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    const candidate = current.length === 0 ? paragraph : `${current}\n\n${paragraph}`;
    if (candidate.length <= TELEGRAM_TEXT_LIMIT) {
      current = candidate;
      continue;
    }
    if (current.length > 0) parts.push(current);
    current = paragraph;
  }

  if (current.length > 0) parts.push(current);
  return parts.length > 0 ? parts : [truncateTelegramText(text)];
}

function sanitizePreviewText(text: string): string {
  return text
    .replace(/bot\d+:[A-Za-z0-9_-]+/gi, "bot***")
    .replace(/(?:X-SCE-Admin-Key["']?\s*[:=]\s*["']?)[^"',\s}]+/gi, "$1***")
    .replace(/https:\/\/discord\.com\/api\/webhooks\/[^\s"'`]+/gi, "[redacted-discord-webhook]")
    .replace(/https:\/\/api\.telegram\.org\/bot[^\s"'`]+/gi, "[redacted-telegram-bot-api]")
    .replace(
      /https?:\/\/[^\s"'`]*(?:alchemy|infura|quiknode|ankr|drpc|blastapi|getblock|chainstack|llamarpc)[^\s"'`]*/gi,
      "[redacted-provider-url]",
    );
}

function sanitizePreviewValue(value: unknown): unknown {
  if (typeof value === "string") return sanitizePreviewText(value);
  if (Array.isArray(value)) return value.map((entry) => sanitizePreviewValue(entry));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        sanitizePreviewValue(entry),
      ]),
    );
  }
  return value;
}

function truncatePreviewString(text: string): {
  previewText: string;
  characterCount: number;
  truncated: boolean;
} {
  const characterCount = text.length;
  if (characterCount <= PREVIEW_TEXT_LIMIT) {
    return { previewText: text, characterCount, truncated: false };
  }
  const suffix = "\n... (preview truncated)";
  return {
    previewText: `${text.slice(0, PREVIEW_TEXT_LIMIT - suffix.length)}${suffix}`,
    characterCount,
    truncated: true,
  };
}

function previewWarning(format: PreviewMessageFormat, truncated: boolean): string | undefined {
  if (!truncated) return undefined;
  if (format === "webhook_json") return "Webhook preview truncated for API response size.";
  if (format === "discord_embed") return "Discord embed preview truncated for API response size.";
  return "Preview truncated for API response size.";
}

function makeTextPreviewMessage(
  format: PreviewMessageFormat,
  text: string,
  messageIndex: number,
  title?: string,
  options?: {
    sourceCharacterCount?: number;
    deliveryTruncated?: boolean;
    deliveryWarning?: string;
  },
): DeliveryPreviewMessage {
  const sanitizedText = sanitizePreviewText(text);
  const { previewText, characterCount, truncated } = truncatePreviewString(sanitizedText);
  const finalTruncated = truncated || options?.deliveryTruncated === true;
  const finalCharacterCount = options?.sourceCharacterCount ?? characterCount;
  return {
    messageIndex,
    format,
    title: title ? sanitizePreviewText(title) : undefined,
    text: previewText,
    characterCount: finalCharacterCount,
    truncated: finalTruncated,
    warning:
      options?.deliveryWarning ??
      previewWarning(format, finalTruncated),
  };
}

function makeStructuredPreviewMessage(
  format: PreviewMessageFormat,
  payload: Record<string, unknown>,
  messageIndex: number,
  kind: "embed" | "json",
  title?: string,
): DeliveryPreviewMessage {
  const sanitizedPayload = sanitizePreviewValue(payload) as Record<string, unknown>;
  const serializedPayload = JSON.stringify(sanitizedPayload, null, 2);
  const { previewText, characterCount, truncated } = truncatePreviewString(serializedPayload);

  if (truncated) {
    return {
      messageIndex,
      format,
      title:
        title ??
        (typeof sanitizedPayload.title === "string" ? sanitizedPayload.title : undefined),
      text: previewText,
      characterCount,
      truncated: true,
      warning: previewWarning(format, true),
    };
  }

  return {
    messageIndex,
    format,
    title:
      title ??
      (typeof sanitizedPayload.title === "string" ? sanitizedPayload.title : undefined),
    [kind]: sanitizedPayload,
    characterCount,
    truncated: false,
  };
}

function countBy<T extends string>(values: T[]): Array<{ key: T; count: number }> {
  return Array.from(
    values.reduce((map, value) => {
      map.set(value, (map.get(value) ?? 0) + 1);
      return map;
    }, new Map<T, number>()),
  )
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || String(a.key).localeCompare(String(b.key)));
}

function topAlerts(alerts: SceAlert[]): SceAlert[] {
  return [...alerts]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, DIGEST_TOP_ALERT_LIMIT);
}

export interface DigestSummary {
  alertCount: number;
  countsBySeverity: Array<{ key: string; count: number }>;
  countsByMonitorType: Array<{ key: string; count: number }>;
  topAlerts: Array<{
    id: string;
    severity: string;
    monitorType: string;
    provider: string;
    summary: string;
  }>;
  coverageSummary: string;
}

function serializeAlert(alert: SceAlert) {
  return {
    id: alert.id,
    monitorType: alert.monitorType,
    provider: alert.provider,
    chain: alert.chain,
    asset: alert.asset,
    assetPair: alert.assetPair ?? null,
    route: alert.route,
    poolName: alert.poolName ?? null,
    objectId: alert.objectId,
    objectType: alert.objectType ?? null,
    purpose: alert.purpose,
    severity: alert.severity,
    status: alert.status,
    reasonCode: alert.reasonCode,
    summary: alert.summary,
    publicSummary: alert.publicSummary ?? null,
    signalClass: alert.signalClass ?? null,
    evidenceSummary: alert.evidenceSummary ?? null,
    tags: alert.tags ?? [],
    severityExplanation: alert.severityExplanation ?? null,
    thresholdExplanation: alert.thresholdExplanation ?? null,
    humanRiskSummary: alert.humanRiskSummary ?? null,
    whatHappened: alert.whatHappened ?? null,
    whyItMatters: alert.whyItMatters ?? null,
    radarStatus: alert.radarStatus ?? null,
    nextWatch: alert.nextWatch ?? null,
    evidenceExplanation: alert.evidenceExplanation ?? null,
    thresholdName: alert.thresholdName ?? null,
    observedValueLabel: alert.observedValueLabel ?? null,
    thresholdValueLabel: alert.thresholdValueLabel ?? null,
    createdAt: alert.createdAt,
    updatedAt: alert.updatedAt,
  };
}

function getEmbedColors(
  alerts: SceAlert[],
  meta?: SituationalBriefingMeta,
): Map<string, number> {
  const briefing = buildSituationalBriefing(alerts, meta);
  return new Map(
    briefing.groups.map((group) => [group.title, severityColor(group.dominantSeverity)]),
  );
}

export function buildDigestSummary(alerts: SceAlert[]): DigestSummary {
  const countsBySeverity = countBy(alerts.map((alert) => alert.severity));
  const countsByMonitorType = countBy(alerts.map((alert) => alert.monitorType));
  const top = topAlerts(alerts).map((alert) => ({
    id: alert.id,
    severity: alert.severity,
    monitorType: alert.monitorType,
    provider: alert.provider,
    summary: alert.summary,
  }));
  const coverageSummary =
    alerts.length === 0
      ? "No matched alerts in this delivery window."
      : `${alerts.length} matched alerts across ${countsByMonitorType.length} monitor type${
          countsByMonitorType.length === 1 ? "" : "s"
        }.`;

  return {
    alertCount: alerts.length,
    countsBySeverity,
    countsByMonitorType,
    topAlerts: top,
    coverageSummary,
  };
}

export function buildWebhookPayload(
  alerts: SceAlert[],
  meta: SituationalBriefingMeta,
) {
  const briefing = buildSituationalBriefing(alerts, meta);
  return {
    source: "radar.sagitta.systems",
    type: "manual_delivery_cycle",
    window: meta.window,
    windowStart: meta.windowStart,
    windowEnd: meta.windowEnd,
    generatedAt: new Date().toISOString(),
    alertCount: alerts.length,
    countsBySeverity: briefing.countsBySeverity,
    briefing,
    alerts: alerts.map(serializeAlert),
  };
}

export function buildPublicThreadWebhookPayload(
  thread: PublicThreadDelivery,
  meta: { window: string; windowStart: string; windowEnd: string },
) {
  return {
    source: "radar.sagitta.systems",
    type: "public_thread_delivery",
    threadSource: thread.source,
    previewHash: thread.previewHash,
    approvedPreviewHash: thread.approvedPreviewHash,
    window: meta.window,
    windowStart: meta.windowStart,
    windowEnd: meta.windowEnd,
    generatedAt: new Date().toISOString(),
    postCount: thread.posts.length,
    posts: thread.posts.map((post, index) => ({
      index,
      text: post.text,
    })),
  };
}

export function buildDigestWebhookPayload(
  alerts: SceAlert[],
  meta: SituationalBriefingMeta,
) {
  const briefing = buildSituationalBriefing(alerts, meta);
  return {
    source: "radar.sagitta.systems",
    type: "digest_delivery",
    window: meta.window,
    windowStart: meta.windowStart,
    windowEnd: meta.windowEnd,
    generatedAt: new Date().toISOString(),
    summary: buildDigestSummary(alerts),
    briefing,
    alerts: alerts.map(serializeAlert),
  };
}

export function buildAnnouncementPreviewMessages(
  channel: "webhook" | "discord_webhook" | "telegram_bot",
  alerts: AnnouncementFeedAlert[],
  meta: SituationalBriefingMeta,
): DeliveryPreviewMessage[] {
  if (channel === "webhook") {
    return alerts.map((alert, index) =>
      makeStructuredPreviewMessage(
        "webhook_json",
        buildAnnouncementWebhookPayload(alert, meta),
        index,
        "json",
        "announcement_feed_delivery",
      ),
    );
  }
  if (channel === "discord_webhook") {
    return alerts.map((alert, index) =>
      makeStructuredPreviewMessage(
        "discord_embed",
        buildAnnouncementDiscordEmbed(alert),
        index,
        "embed",
      ),
    );
  }
  return alerts.map((alert, index) => {
    const sourceText = buildAnnouncementText(alert);
    const deliveredText = truncateTelegramText(sourceText);
    return makeTextPreviewMessage("telegram_text", deliveredText, index, undefined, {
      sourceCharacterCount: sourceText.length,
      deliveryTruncated: deliveredText !== sourceText,
      deliveryWarning:
        deliveredText !== sourceText
          ? "Announcement feed post truncated for Telegram delivery."
          : undefined,
    });
  });
}

export function buildDiscordEmbeds(alerts: SceAlert[], meta?: SituationalBriefingMeta) {
  const colors = getEmbedColors(alerts, meta);
  return buildSituationalBriefingDiscordEmbeds(alerts, meta)
    .slice(0, DISCORD_EMBED_LIMIT)
    .map((embed, index) => {
      if (index === 0) {
        return { color: 0x2563eb, ...embed };
      }
      const title = typeof embed.title === "string" ? embed.title : "";
      return { color: colors.get(title) ?? 0x2563eb, ...embed };
    });
}

export function buildDigestDiscordEmbeds(alerts: SceAlert[], meta?: SituationalBriefingMeta) {
  return buildDiscordEmbeds(alerts, meta);
}

export function buildTelegramText(alerts: SceAlert[], meta?: SituationalBriefingMeta): string {
  return buildSituationalBriefingTelegramText(alerts, meta);
}

export function buildDigestTelegramText(alerts: SceAlert[], meta?: SituationalBriefingMeta): string {
  return buildSituationalBriefingTelegramText(alerts, meta);
}

export function buildTelegramTextParts(
  alerts: SceAlert[],
  meta?: SituationalBriefingMeta,
): string[] {
  return splitTelegramText(buildTelegramText(alerts, meta));
}

export function buildDigestTelegramTextParts(
  alerts: SceAlert[],
  meta?: SituationalBriefingMeta,
): string[] {
  return splitTelegramText(buildDigestTelegramText(alerts, meta));
}

function buildWebhookPreviewPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const alerts =
    Array.isArray(payload.alerts) ? (payload.alerts as Array<Record<string, unknown>>) : [];
  const summary =
    payload.summary && typeof payload.summary === "object"
      ? (payload.summary as Record<string, unknown>)
      : null;
  return {
    source: payload.source,
    type: payload.type,
    window: payload.window,
    windowStart: payload.windowStart,
    windowEnd: payload.windowEnd,
    generatedAt: payload.generatedAt,
    alertCount: payload.alertCount ?? summary?.alertCount ?? alerts.length,
    countsBySeverity: payload.countsBySeverity ?? summary?.countsBySeverity ?? null,
    alertIds: alerts
      .map((alert) => (typeof alert.id === "string" ? alert.id : null))
      .filter((alertId): alertId is string => alertId !== null),
    briefing: payload.briefing ?? null,
    summary,
    postCount: payload.postCount ?? null,
  };
}

export function buildAlertFanoutPreviewMessages(
  channel: "webhook" | "discord_webhook" | "telegram_bot",
  alerts: SceAlert[],
  meta: SituationalBriefingMeta,
): DeliveryPreviewMessage[] {
  if (channel === "webhook") {
    return [
      makeStructuredPreviewMessage(
        "webhook_json",
        buildWebhookPreviewPayload(buildWebhookPayload(alerts, meta) as Record<string, unknown>),
        0,
        "json",
        "manual_delivery_cycle",
      ),
    ];
  }
  if (channel === "discord_webhook") {
    return buildDiscordEmbeds(alerts, meta).map((embed, index) =>
      makeStructuredPreviewMessage(
        "discord_embed",
        embed as Record<string, unknown>,
        index,
        "embed",
      ),
    );
  }
  return buildTelegramTextParts(alerts, meta).map((part, index) =>
    makeTextPreviewMessage("telegram_text", part, index, undefined, {
      sourceCharacterCount: part.length,
    }),
  );
}

export function buildDigestPreviewMessages(
  channel: "webhook" | "discord_webhook" | "telegram_bot",
  alerts: SceAlert[],
  meta: SituationalBriefingMeta,
): DeliveryPreviewMessage[] {
  if (channel === "webhook") {
    return [
      makeStructuredPreviewMessage(
        "webhook_json",
        buildWebhookPreviewPayload(buildDigestWebhookPayload(alerts, meta) as Record<string, unknown>),
        0,
        "json",
        "digest_delivery",
      ),
    ];
  }
  if (channel === "discord_webhook") {
    return buildDigestDiscordEmbeds(alerts, meta).map((embed, index) =>
      makeStructuredPreviewMessage(
        "discord_embed",
        embed as Record<string, unknown>,
        index,
        "embed",
      ),
    );
  }
  return buildDigestTelegramTextParts(alerts, meta).map((part, index) =>
    makeTextPreviewMessage("digest_text", part, index, undefined, {
      sourceCharacterCount: part.length,
    }),
  );
}

export function buildPublicThreadPreviewMessages(
  channel: "webhook" | "discord_webhook" | "telegram_bot",
  thread: PublicThreadDelivery,
  meta: { window: string; windowStart: string; windowEnd: string },
): DeliveryPreviewMessage[] {
  if (channel === "webhook") {
    return [
      makeStructuredPreviewMessage(
        "webhook_json",
        buildWebhookPreviewPayload(
          buildPublicThreadWebhookPayload(thread, meta) as Record<string, unknown>,
        ),
        0,
        "json",
        "public_thread_delivery",
      ),
    ];
  }

  const posts = thread.posts.map((post) => post.text);
  const format: PreviewMessageFormat =
    channel === "discord_webhook" ? "discord_text" : "public_thread_text";
  let messageIndex = 0;
  return posts.flatMap((post) => {
    if (channel !== "telegram_bot") {
      return [makeTextPreviewMessage(format, post, messageIndex++)];
    }
    return splitTelegramText(post).map((part) =>
      makeTextPreviewMessage(format, part, messageIndex++, undefined, {
        sourceCharacterCount: part.length,
      }),
    );
  });
}

export async function sendWebhookPosts(url: string, payloads: unknown[]): Promise<SendResult> {
  for (const payload of payloads) {
    const result = await sendWebhook(url, payload);
    if (!result.ok) return result;
  }
  return { ok: true };
}

export async function sendWebhook(url: string, payload: unknown): Promise<SendResult> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return { ok: false, sanitizedError: `Webhook endpoint returned ${res.status}` };
    return { ok: true };
  } catch {
    return { ok: false, sanitizedError: "Webhook endpoint unreachable" };
  }
}

export async function sendDiscordEmbeds(webhookUrl: string, embeds: unknown[]): Promise<SendResult> {
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds }),
    });
    if (!res.ok) return { ok: false, sanitizedError: `Discord webhook returned ${res.status}` };
    return { ok: true };
  } catch {
    return { ok: false, sanitizedError: "Discord webhook unreachable" };
  }
}

export async function sendDiscordEmbedPosts(
  webhookUrl: string,
  embeds: unknown[],
): Promise<SendResult> {
  try {
    for (const embed of embeds) {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ embeds: [embed] }),
      });
      if (!res.ok) {
        return { ok: false, sanitizedError: `Discord webhook returned ${res.status}` };
      }
    }
    return { ok: true };
  } catch {
    return { ok: false, sanitizedError: "Discord webhook unreachable" };
  }
}

export async function sendDiscordTextPosts(webhookUrl: string, posts: string[]): Promise<SendResult> {
  try {
    for (const post of posts) {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: post }),
      });
      if (!res.ok) {
        return { ok: false, sanitizedError: `Discord webhook returned ${res.status}` };
      }
    }
    return { ok: true };
  } catch {
    return { ok: false, sanitizedError: "Discord webhook unreachable" };
  }
}

function sanitizeTelegramDescription(description: string): string {
  return description.replace(/bot\d+:[A-Za-z0-9_-]+/gi, "bot***");
}

async function postTelegramMessage(chatId: string, text: string): Promise<SendResult> {
  const botToken = process.env.RADAR_TELEGRAM_BOT_TOKEN;
  if (!botToken) return { ok: false, sanitizedError: "Telegram bot token is not configured." };

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    const data = (await res
      .json()
      .then((value) => (typeof value === "object" && value !== null ? value : {}))
      .catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok || !data.ok) {
      const description = typeof data.description === "string" ? data.description : `Telegram returned ${res.status}`;
      return { ok: false, sanitizedError: sanitizeTelegramDescription(description) };
    }
    const messageId = (data.result as Record<string, unknown> | undefined)?.message_id;
    return { ok: true, externalIds: messageId !== undefined ? [String(messageId)] : undefined };
  } catch {
    return { ok: false, sanitizedError: "Telegram bot unreachable" };
  }
}

export async function sendTelegramMessage(chatId: string, text: string): Promise<SendResult> {
  return postTelegramMessage(chatId, text);
}

export async function sendTelegramTextPosts(chatId: string, posts: string[]): Promise<SendResult> {
  const externalIds: string[] = [];

  for (const post of posts) {
    const result = await postTelegramMessage(chatId, truncateTelegramText(post));
    if (!result.ok) return result;
    externalIds.push(...(result.externalIds ?? []));
  }

  return { ok: true, externalIds: externalIds.length > 0 ? externalIds : undefined };
}

export {
  alertLine,
  buildAnnouncementDetailsUrl,
  buildAnnouncementDiscordEmbed,
  buildAnnouncementTags,
  buildAnnouncementText as buildAnnouncementTelegramText,
  buildAnnouncementWebhookPayload,
};
