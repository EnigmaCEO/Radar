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

const DISCORD_EMBED_LIMIT = 10;
const TELEGRAM_TEXT_LIMIT = 3500;
const DIGEST_TOP_ALERT_LIMIT = 5;
const PREVIEW_TEXT_LIMIT = 4000;

function severityColor(severity: string): number {
  switch (severity) {
    case "critical":
      return 0xdc2626;
    case "warning":
      return 0xf97316;
    default:
      return 0xeab308;
  }
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
    const data = await res.json().catch(() => ({}) as Record<string, unknown>);
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

export { alertLine };
