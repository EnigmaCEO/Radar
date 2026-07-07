import { NextRequest, NextResponse } from "next/server";
import type { RadarDeliveryDestination, RadarWatchlist } from "@prisma/client";
import { auth0 } from "@/lib/auth0";
import { getAccount } from "@/lib/account";
import { db } from "@/lib/db";
import {
  DEFAULT_DELIVERY_MODE,
  normalizeDeliveryMode,
  type DeliveryMode,
} from "@/lib/delivery-modes";
import {
  DELIVERY_WINDOWS,
  type DeliveryWindow,
  evaluateWatchlistMatch,
  hasWatchlistFilters,
  isDestinationDue,
  isValidWindow,
  meetsMinSeverity,
  normalizeAlert,
  toDeliveryAlert,
  type MatchableAlert,
  type WatchlistFilterSet,
} from "@/lib/delivery-matching";
import {
  buildAlertFanoutPreviewMessages,
  buildDigestDiscordEmbeds,
  buildDigestPreviewMessages,
  buildDigestTelegramTextParts,
  buildDigestWebhookPayload,
  buildPublicThreadPreviewMessages,
  buildDiscordEmbeds,
  buildPublicThreadWebhookPayload,
  buildTelegramTextParts,
  buildWebhookPayload,
  sendDiscordEmbeds,
  sendDiscordTextPosts,
  sendTelegramTextPosts,
  sendWebhook,
  type DeliveryPreviewMessage,
  type SendResult,
} from "@/lib/delivery-senders";
import { buildSituationalBriefing } from "@/lib/situational-briefing";
import {
  getLatestPublicThreadDelivery,
  type PublicThreadDelivery,
} from "@/lib/public-thread";
import {
  fetchSceAlertLedger,
  SceAlertsError,
  type SceAlert,
  type SceAlertLedgerEvent,
} from "@/lib/sce-alerts";

const ALLOWED_CHANNELS = ["webhook", "discord_webhook", "telegram_bot", "x_account"] as const;
type Channel = (typeof ALLOWED_CHANNELS)[number];

function getDeliveryFormat(channel: Channel, deliveryMode: DeliveryMode): string {
  if (channel === "webhook") return "json";
  if (channel === "discord_webhook") return deliveryMode === "public_thread" ? "text" : "embed";
  return "text";
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function toFilterSet(watchlist: RadarWatchlist): WatchlistFilterSet {
  return {
    id: watchlist.id,
    name: watchlist.name,
    matchMode: watchlist.matchMode,
    minSeverity: watchlist.minSeverity,
    monitorTypes: asStringArray(watchlist.monitorTypes),
    providers: asStringArray(watchlist.providers),
    chains: asStringArray(watchlist.chains),
    assets: asStringArray(watchlist.assets),
    objectIds: asStringArray(watchlist.objectIds),
    tags: asStringArray(watchlist.tags),
    purposes: asStringArray(watchlist.purposes),
    statuses: asStringArray(watchlist.statuses),
    signalClasses: asStringArray(watchlist.signalClasses),
  };
}

interface AlertResult {
  alertId: string;
  eventId: string | null;
  eventType: string | null;
  status: string;
  severity: string;
  monitorType: string;
  title: string;
  summary: string;
  matchedWatchlistIds: string[];
  matchedWatchlistNames: string[];
  skippedReasons: string[];
  skippedReason?: string;
}

interface MatchedAlertSummary {
  alertId: string;
  severity: string;
  monitorType: string;
  title: string;
  matchedWatchlistIds: string[];
  matchedWatchlistNames: string[];
}

interface ExcludedEvent {
  alertId: string;
  eventId: string | null;
  eventType: string | null;
  status: string;
  severity: string;
  monitorType: string;
  title: string;
  skippedReasons: string[];
}

interface UnmatchedAlertReason {
  alertId: string;
  reasons: string[];
}

interface WatchlistMatchDetail {
  watchlistId: string;
  name: string;
  enabled: boolean;
  minSeverity: string;
  hasFilters: boolean;
  matchedAlertCount: number;
}

interface ChannelResult {
  destinationId: string;
  channel: string;
  deliveryMode: DeliveryMode;
  name: string;
  status: "sent" | "failed" | "blocked" | "dry_run" | "skipped";
  messageCount: number;
  briefingCount: number;
  groupsGenerated: number;
  previewMessages?: DeliveryPreviewMessage[];
  reason?: string;
}

interface NormalizedDeliveryAlert {
  normalized: MatchableAlert;
  deliveryAlert: SceAlert;
  ledgerEvent: SceAlertLedgerEvent;
}

interface MatchedAlertCandidate {
  normalized: MatchableAlert;
  deliveryAlert: SceAlert;
  watchlistIds: string[];
  watchlistNames: string[];
}

const DELIVERY_LEDGER_EVENT_TYPES = new Set([
  "alert_opened",
  "alert_updated",
  "severity_changed",
  "alert_resolved",
]);

function normalizeForDelivery(events: SceAlertLedgerEvent[]): NormalizedDeliveryAlert[] {
  return events
    .map((event) => {
      const normalized = normalizeAlert(event);
      const deliveryAlert = toDeliveryAlert(event);
      if (!normalized || !deliveryAlert) return null;
      return { normalized, deliveryAlert, ledgerEvent: event };
    })
    .filter((entry): entry is NormalizedDeliveryAlert => entry !== null);
}

function isDeliverableLedgerEvent(alert: MatchableAlert): boolean {
  if (alert.eventType && !DELIVERY_LEDGER_EVENT_TYPES.has(alert.eventType)) return false;
  if (alert.eventType === "alert_resolved") return true;
  return alert.status.toLowerCase() === "active";
}

function eventTypePriority(eventType: string | null): number {
  switch (eventType) {
    case "alert_resolved":
      return 4;
    case "severity_changed":
      return 3;
    case "alert_updated":
      return 2;
    case "alert_opened":
      return 1;
    default:
      return 0;
  }
}

function eventTimestampValue(alert: NormalizedDeliveryAlert): number {
  const timestamp =
    alert.normalized.createdAt ??
    alert.normalized.updatedAt ??
    alert.ledgerEvent.createdAt ??
    alert.ledgerEvent.updatedAt;
  if (!timestamp) return 0;
  const value = new Date(timestamp).getTime();
  return Number.isNaN(value) ? 0 : value;
}

function shouldReplaceAlertCandidate(
  current: NormalizedDeliveryAlert,
  candidate: NormalizedDeliveryAlert,
): boolean {
  const candidateTimestamp = eventTimestampValue(candidate);
  const currentTimestamp = eventTimestampValue(current);
  if (candidateTimestamp !== currentTimestamp) return candidateTimestamp > currentTimestamp;

  const candidatePriority = eventTypePriority(candidate.normalized.eventType);
  const currentPriority = eventTypePriority(current.normalized.eventType);
  if (candidatePriority !== currentPriority) return candidatePriority > currentPriority;

  return (candidate.normalized.eventId ?? candidate.normalized.id).localeCompare(
    current.normalized.eventId ?? current.normalized.id,
  ) > 0;
}

function dedupeDeliveryAlertsByAlertId(
  alerts: NormalizedDeliveryAlert[],
): NormalizedDeliveryAlert[] {
  const deduped = new Map<string, NormalizedDeliveryAlert>();

  for (const alert of alerts) {
    const current = deduped.get(alert.normalized.alertId);
    if (!current || shouldReplaceAlertCandidate(current, alert)) {
      deduped.set(alert.normalized.alertId, alert);
    }
  }

  return Array.from(deduped.values()).sort((a, b) => {
    const timestampDiff = eventTimestampValue(a) - eventTimestampValue(b);
    if (timestampDiff !== 0) return timestampDiff;
    return a.normalized.alertId.localeCompare(b.normalized.alertId);
  });
}

function buildSkippedReasons(
  evaluations: Array<{ watchlist: WatchlistFilterSet; result: ReturnType<typeof evaluateWatchlistMatch> }>,
): string[] {
  const reasons = Array.from(
    new Set(evaluations.flatMap((evaluation) => evaluation.result.skippedReasons)),
  );
  if (reasons.length > 0) return reasons;
  return ["no_active_watchlist_matched"];
}

function emptyResponse(window: DeliveryWindow, latestError: string | null) {
  return {
    window,
    ledgerEventsFetched: 0,
    eventsInsideWindow: 0,
    uniqueAlertsMatched: 0,
    alertsFetched: 0,
    alertsInsideWindow: 0,
    activeWatchlistsLoaded: 0,
    broadWatchlistsLoaded: 0,
    alertsMatched: 0,
    watchlistsMatched: 0,
    destinationsMatched: 0,
    briefingsGenerated: 0,
    groupsGenerated: 0,
    messagesGenerated: 0,
    deliveriesAttempted: 0,
    deliveriesSucceeded: 0,
    deliveriesFailed: 0,
    deliveriesSkipped: 0,
    channelResults: [] as ChannelResult[],
    matchedAlerts: [] as MatchedAlertSummary[],
    excludedEvents: [] as ExcludedEvent[],
    alertResults: [] as AlertResult[],
    unmatchedAlertReasons: [] as UnmatchedAlertReason[],
    watchlistMatchDetails: [] as WatchlistMatchDetail[],
    deliveryLogIds: [] as string[],
    latestError,
  };
}

function toExcludedEvent(
  normalized: MatchableAlert,
  skippedReasons: string[],
): ExcludedEvent {
  return {
    alertId: normalized.alertId,
    eventId: normalized.eventId,
    eventType: normalized.eventType,
    status: normalized.status,
    severity: normalized.severity,
    monitorType: normalized.monitorType,
    title: normalized.title,
    skippedReasons,
  };
}

export async function POST(request: NextRequest) {
  const session = await auth0.getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await getAccount();
  if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });
  const accountId = account.id;

  const body = (await request.json().catch(() => ({}))) as {
    dryRun?: boolean;
    window?: string;
    channels?: string[];
  };

  const dryRun = body.dryRun === true;
  const windowInput = body.window ?? "15min";

  if (!isValidWindow(windowInput)) {
    return NextResponse.json(
      { error: `window must be one of: ${DELIVERY_WINDOWS.join(", ")}.` },
      { status: 400 },
    );
  }

  const window: DeliveryWindow = windowInput;
  let channels: Channel[] | null = null;

  if (body.channels !== undefined) {
    if (
      !Array.isArray(body.channels) ||
      body.channels.some((channel) => !ALLOWED_CHANNELS.includes(channel as Channel))
    ) {
      return NextResponse.json(
        { error: `channels must be an array containing only: ${ALLOWED_CHANNELS.join(", ")}.` },
        { status: 400 },
      );
    }
    channels = body.channels as Channel[];
  }

  const now = new Date();
  const windowStart = new Date(
    now.getTime() -
      (window === "15min"
        ? 15 * 60 * 1000
        : window === "1h"
          ? 60 * 60 * 1000
          : 24 * 60 * 60 * 1000),
  );
  const deliveryMeta = {
    window,
    windowStart: windowStart.toISOString(),
    windowEnd: now.toISOString(),
  };

  let ledgerEvents: SceAlertLedgerEvent[];
  try {
    ledgerEvents = await fetchSceAlertLedger({
      since: windowStart.toISOString(),
      until: now.toISOString(),
      limit: 200,
    });
  } catch (error) {
    const message = error instanceof SceAlertsError ? error.message : "SCE alert ledger is unavailable.";
    console.error(
      "Manual delivery cycle: SCE alert ledger fetch failed:",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json({ status: "failed", ...emptyResponse(window, message) }, { status: 502 });
  }

  const ledgerEventsFetched = ledgerEvents.length;
  const normalizedAlerts = normalizeForDelivery(ledgerEvents);
  const alertsInsideWindowEvents = normalizedAlerts.filter(({ normalized }) =>
    isDeliverableLedgerEvent(normalized),
  );
  const alertsInsideWindow = dedupeDeliveryAlertsByAlertId(alertsInsideWindowEvents);

  const watchlists = await db.radarWatchlist.findMany({
    where: { accountId: account.id, enabled: true },
  });
  const filterSets = watchlists.map(toFilterSet);
  const activeWatchlistsLoaded = filterSets.length;
  const broadWatchlistsLoaded = filterSets.filter((watchlist) => !hasWatchlistFilters(watchlist)).length;
  const watchlistMatchCounts = new Map(filterSets.map((watchlist) => [watchlist.id, 0]));

  const alertResults: AlertResult[] = [];
  const excludedEvents: ExcludedEvent[] = [];
  const unmatchedAlertReasons: UnmatchedAlertReason[] = [];
  const matchedAlertMap = new Map<string, MatchedAlertCandidate>();

  for (const { normalized, deliveryAlert } of alertsInsideWindow) {
    const evaluations = filterSets.map((watchlist) => ({
      watchlist,
      result: evaluateWatchlistMatch(normalized, watchlist),
    }));
    const matchedWatchlists = evaluations
      .filter((evaluation) => evaluation.result.matched)
      .map((evaluation) => evaluation.watchlist);
    const skippedReasons = matchedWatchlists.length === 0 ? buildSkippedReasons(evaluations) : [];

    alertResults.push({
      alertId: normalized.alertId,
      eventId: normalized.eventId,
      eventType: normalized.eventType,
      status: normalized.status,
      severity: normalized.severity,
      monitorType: normalized.monitorType,
      title: normalized.title,
      summary: normalized.summary,
      matchedWatchlistIds: matchedWatchlists.map((watchlist) => watchlist.id),
      matchedWatchlistNames: matchedWatchlists.map((watchlist) => watchlist.name),
      skippedReasons,
      skippedReason: skippedReasons[0],
    });

    if (matchedWatchlists.length === 0) {
      unmatchedAlertReasons.push({ alertId: normalized.alertId, reasons: skippedReasons });
      excludedEvents.push(toExcludedEvent(normalized, skippedReasons));
      continue;
    }

    matchedAlertMap.set(normalized.alertId, {
      normalized,
      deliveryAlert,
      watchlistIds: matchedWatchlists.map((watchlist) => watchlist.id),
      watchlistNames: matchedWatchlists.map((watchlist) => watchlist.name),
    });

    for (const watchlist of matchedWatchlists) {
      watchlistMatchCounts.set(
        watchlist.id,
        (watchlistMatchCounts.get(watchlist.id) ?? 0) + 1,
      );
    }
  }

  const matchedAlerts = Array.from(matchedAlertMap.values()).map((entry) => entry.deliveryAlert);
  const watchlistsMatched = new Set(
    Array.from(matchedAlertMap.values()).flatMap((entry) => entry.watchlistIds),
  ).size;
  const watchlistMatchDetails: WatchlistMatchDetail[] = filterSets.map((watchlist) => ({
    watchlistId: watchlist.id,
    name: watchlist.name,
    enabled: true,
    minSeverity: watchlist.minSeverity,
    hasFilters: hasWatchlistFilters(watchlist),
    matchedAlertCount: watchlistMatchCounts.get(watchlist.id) ?? 0,
  }));

  const destinations = await db.radarDeliveryDestination.findMany({ where: { accountId: account.id } });
  const hasApplicableAlertDestinations = destinations.some((destination) => {
    const channel = destination.channel as Channel;
    if (channels && !channels.includes(channel)) return false;
    return normalizeDeliveryMode(
      (destination as RadarDeliveryDestination & { deliveryMode?: unknown }).deliveryMode ??
        DEFAULT_DELIVERY_MODE,
    ) !== "public_thread";
  });
  const matchedAlertsForResponse = Array.from(matchedAlertMap.values())
    .filter((entry) => {
      if (!hasApplicableAlertDestinations) return true;

      const exclusionReasons = new Set<string>();
      for (const destination of destinations) {
        const channel = destination.channel as Channel;
        if (channels && !channels.includes(channel)) continue;

        const deliveryMode = normalizeDeliveryMode(
          (destination as RadarDeliveryDestination & { deliveryMode?: unknown }).deliveryMode ??
            DEFAULT_DELIVERY_MODE,
        );
        if (deliveryMode === "public_thread") continue;

        if (!destination.enabled) {
          exclusionReasons.add("inactive_destination");
          continue;
        }
        if (!destination.destinationUrl) {
          exclusionReasons.add("missing_config");
          continue;
        }
        if (!isDestinationDue(destination.lastPolledAt, destination.pollingFrequency, now)) {
          exclusionReasons.add("cadence_not_due");
          continue;
        }
        if (channel === "x_account") {
          exclusionReasons.add("x_sender_unavailable");
          continue;
        }
        if (!meetsMinSeverity(entry.deliveryAlert.severity, destination.minimumSeverity)) {
          exclusionReasons.add("below_min_severity");
          continue;
        }
        return true;
      }

      if (exclusionReasons.size > 0) {
        excludedEvents.push(toExcludedEvent(entry.normalized, Array.from(exclusionReasons)));
      }
      return false;
    })
    .map<MatchedAlertSummary>((entry) => ({
      alertId: entry.normalized.alertId,
      severity: entry.normalized.severity,
      monitorType: entry.normalized.monitorType,
      title: entry.normalized.title,
      matchedWatchlistIds: entry.watchlistIds,
      matchedWatchlistNames: entry.watchlistNames,
    }));
  const channelResults: ChannelResult[] = [];
  const deliveryLogIds: string[] = [];
  let latestError: string | null = null;
  let publicThreadPromise: Promise<PublicThreadDelivery | null> | null = null;

  function getPublicThread() {
    if (!publicThreadPromise) {
      publicThreadPromise = getLatestPublicThreadDelivery();
    }
    return publicThreadPromise;
  }

  function pushResult(
    destination: RadarDeliveryDestination,
    deliveryMode: DeliveryMode,
    status: ChannelResult["status"],
    messageCount: number,
    briefingCount = 0,
    groupsGenerated = 0,
    previewMessages?: DeliveryPreviewMessage[],
    reason?: string,
  ) {
    channelResults.push({
      destinationId: destination.id,
      channel: destination.channel,
      deliveryMode,
      name: destination.name,
      status,
      messageCount,
      briefingCount,
      groupsGenerated,
      previewMessages,
      reason,
    });
    if (reason) latestError = reason;
  }

  function getDestinationAlerts(destination: RadarDeliveryDestination) {
    return matchedAlerts.filter((alert) => meetsMinSeverity(alert.severity, destination.minimumSeverity));
  }

  function getSoleWatchlistId(alerts: SceAlert[]) {
    const watchlistIdsForDestination = new Set(
      alerts.flatMap((alert) => matchedAlertMap.get(alert.id)?.watchlistIds ?? []),
    );
    return watchlistIdsForDestination.size === 1
      ? Array.from(watchlistIdsForDestination)[0]
      : null;
  }

  async function writeLog(
    destination: RadarDeliveryDestination,
    deliveryMode: DeliveryMode,
    alertIds: string[],
    status: string,
    messageCount: number,
    sanitizedError: string | null,
    externalIds: string[] | null,
    watchlistId: string | null = null,
  ) {
    return db.radarDeliveryLog.create({
      data: {
        accountId,
        destinationId: destination.id,
        watchlistId,
        alertIds,
        channel: destination.channel,
        cadence: destination.pollingFrequency,
        windowStart,
        windowEnd: now,
        format: getDeliveryFormat(destination.channel as Channel, deliveryMode),
        status,
        messageCount,
        sanitizedError,
        externalIds: externalIds ?? undefined,
      },
    });
  }

  async function sendPublicThread(
    destination: RadarDeliveryDestination,
    deliveryMode: DeliveryMode,
    thread: PublicThreadDelivery,
  ): Promise<SendResult> {
    const posts = thread.posts.map((post) => post.text);
    const channel = destination.channel as Channel;

    if (channel === "webhook") {
      return sendWebhook(destination.destinationUrl, buildPublicThreadWebhookPayload(thread, deliveryMeta));
    }
    if (channel === "discord_webhook") {
      return sendDiscordTextPosts(destination.destinationUrl, posts);
    }
    if (channel === "telegram_bot") {
      return sendTelegramTextPosts(destination.destinationUrl, posts);
    }
    return { ok: false, sanitizedError: "x_sender_unavailable" };
  }

  function buildDryRunPreviewMessages(
    destination: RadarDeliveryDestination,
    deliveryMode: DeliveryMode,
    alerts: SceAlert[],
    thread?: PublicThreadDelivery,
  ): DeliveryPreviewMessage[] {
    const channel = destination.channel as Channel;
    if (deliveryMode === "public_thread") {
      if (!thread || channel === "x_account") return [];
      return buildPublicThreadPreviewMessages(channel, thread, deliveryMeta);
    }
    if (channel === "x_account") return [];
    return deliveryMode === "digest"
      ? buildDigestPreviewMessages(channel, alerts, deliveryMeta)
      : buildAlertFanoutPreviewMessages(channel, alerts, deliveryMeta);
  }

  async function sendDigest(
    destination: RadarDeliveryDestination,
    alerts: SceAlert[],
  ): Promise<{ result: SendResult; messageCount: number; briefingCount: number; groupsGenerated: number }> {
    const channel = destination.channel as Channel;
    const briefing = buildSituationalBriefing(alerts, deliveryMeta);

    if (channel === "webhook") {
      return {
        result: await sendWebhook(destination.destinationUrl, buildDigestWebhookPayload(alerts, deliveryMeta)),
        messageCount: 1,
        briefingCount: 1,
        groupsGenerated: briefing.groupCount,
      };
    }
    if (channel === "discord_webhook") {
      const embeds = buildDigestDiscordEmbeds(alerts, deliveryMeta);
      return {
        result: await sendDiscordEmbeds(destination.destinationUrl, embeds),
        messageCount: embeds.length,
        briefingCount: 1,
        groupsGenerated: briefing.groupCount,
      };
    }
    if (channel === "telegram_bot") {
      const parts = buildDigestTelegramTextParts(alerts, deliveryMeta);
      return {
        result: await sendTelegramTextPosts(destination.destinationUrl, parts),
        messageCount: parts.length,
        briefingCount: 1,
        groupsGenerated: briefing.groupCount,
      };
    }
    return {
      result: { ok: false, sanitizedError: "x_sender_unavailable" },
      messageCount: 0,
      briefingCount: 0,
      groupsGenerated: 0,
    };
  }

  async function sendAlertFanout(
    destination: RadarDeliveryDestination,
    alerts: SceAlert[],
  ): Promise<{ result: SendResult; messageCount: number; briefingCount: number; groupsGenerated: number }> {
    const channel = destination.channel as Channel;
    const briefing = buildSituationalBriefing(alerts, deliveryMeta);

    if (channel === "webhook") {
      return {
        result: await sendWebhook(destination.destinationUrl, buildWebhookPayload(alerts, deliveryMeta)),
        messageCount: 1,
        briefingCount: 1,
        groupsGenerated: briefing.groupCount,
      };
    }
    if (channel === "discord_webhook") {
      const embeds = buildDiscordEmbeds(alerts, deliveryMeta);
      return {
        result: await sendDiscordEmbeds(destination.destinationUrl, embeds),
        messageCount: embeds.length,
        briefingCount: 1,
        groupsGenerated: briefing.groupCount,
      };
    }
    if (channel === "telegram_bot") {
      const parts = buildTelegramTextParts(alerts, deliveryMeta);
      return {
        result: await sendTelegramTextPosts(destination.destinationUrl, parts),
        messageCount: parts.length,
        briefingCount: 1,
        groupsGenerated: briefing.groupCount,
      };
    }
    return {
      result: { ok: false, sanitizedError: "x_sender_unavailable" },
      messageCount: 0,
      briefingCount: 0,
      groupsGenerated: 0,
    };
  }

  for (const destination of destinations) {
    const channel = destination.channel as Channel;
    const deliveryMode = normalizeDeliveryMode(
      (destination as RadarDeliveryDestination & { deliveryMode?: unknown }).deliveryMode ??
        DEFAULT_DELIVERY_MODE,
    );

    if (channels && !channels.includes(channel)) {
      pushResult(destination, deliveryMode, "skipped", 0, 0, 0, undefined, "channel_disabled");
      continue;
    }

    if (!destination.enabled) {
      pushResult(destination, deliveryMode, "skipped", 0, 0, 0, undefined, "inactive_destination");
      continue;
    }

    if (!destination.destinationUrl) {
      pushResult(destination, deliveryMode, "skipped", 0, 0, 0, undefined, "missing_config");
      const log = await writeLog(destination, deliveryMode, [], "skipped", 0, "missing_config", null);
      deliveryLogIds.push(log.id);
      continue;
    }

    if (!isDestinationDue(destination.lastPolledAt, destination.pollingFrequency, now)) {
      pushResult(destination, deliveryMode, "skipped", 0, 0, 0, undefined, "cadence_not_due");
      const log = await writeLog(destination, deliveryMode, [], "skipped", 0, "cadence_not_due", null);
      deliveryLogIds.push(log.id);
      continue;
    }

    if (deliveryMode === "public_thread") {
      const thread = await getPublicThread();
      if (!thread || (thread.source === "approved" && thread.approvedPreviewHash !== thread.previewHash)) {
        pushResult(destination, deliveryMode, "blocked", 0, 0, 0, undefined, "approved_public_thread_required");
        const log = await writeLog(
          destination,
          deliveryMode,
          [],
          "blocked",
          0,
          "approved_public_thread_required",
          null,
        );
        deliveryLogIds.push(log.id);
        continue;
      }

      const posts = thread.posts.map((post) => post.text);
      const messageCount = posts.length;

      if (channel === "x_account") {
        pushResult(destination, deliveryMode, "blocked", 0, 0, 0, undefined, "x_sender_unavailable");
        const log = await writeLog(
          destination,
          deliveryMode,
          [],
          "blocked",
          0,
          "x_sender_unavailable",
          null,
        );
        deliveryLogIds.push(log.id);
        continue;
      }

      if (dryRun) {
        pushResult(
          destination,
          deliveryMode,
          "dry_run",
          messageCount,
          0,
          0,
          buildDryRunPreviewMessages(destination, deliveryMode, [], thread),
        );
        const log = await writeLog(destination, deliveryMode, [], "dry_run", messageCount, null, null);
        deliveryLogIds.push(log.id);
        continue;
      }

      const result = await sendPublicThread(destination, deliveryMode, thread);
      const status = result.ok ? "sent" : "failed";
      pushResult(destination, deliveryMode, status, messageCount, 0, 0, undefined, result.sanitizedError);
      const log = await writeLog(
        destination,
        deliveryMode,
        [],
        status,
        messageCount,
        result.sanitizedError ?? null,
        result.externalIds ?? null,
      );
      deliveryLogIds.push(log.id);
      await db.radarDeliveryDestination.update({
        where: { id: destination.id },
        data: { lastPolledAt: now },
      });
      continue;
    }

    const alertsForDestination = getDestinationAlerts(destination);
    const alertIds = alertsForDestination.map((alert) => alert.id);
    const soleWatchlistId = getSoleWatchlistId(alertsForDestination);

    if (deliveryMode === "digest" && alertsForDestination.length === 0) {
      pushResult(destination, deliveryMode, "skipped", 0, 0, 0, undefined, "no_matched_alerts_for_digest");
      const log = await writeLog(
        destination,
        deliveryMode,
        [],
        "skipped",
        0,
        "no_matched_alerts_for_digest",
        null,
      );
      deliveryLogIds.push(log.id);
      continue;
    }

    if (deliveryMode === "alert_fanout" && alertsForDestination.length === 0) {
      pushResult(destination, deliveryMode, "skipped", 0, 0, 0, undefined, "below_destination_min_severity");
      const log = await writeLog(
        destination,
        deliveryMode,
        [],
        "skipped",
        0,
        "below_destination_min_severity",
        null,
      );
      deliveryLogIds.push(log.id);
      continue;
    }

    if (channel === "x_account") {
      pushResult(destination, deliveryMode, "blocked", 0, 0, 0, undefined, "x_sender_unavailable");
      const log = await writeLog(
        destination,
        deliveryMode,
        alertIds,
        "blocked",
        0,
        "x_sender_unavailable",
        null,
        soleWatchlistId,
      );
      deliveryLogIds.push(log.id);
      continue;
    }

    if (dryRun) {
      const briefing = buildSituationalBriefing(alertsForDestination, deliveryMeta);
      const previewMessages = buildDryRunPreviewMessages(
        destination,
        deliveryMode,
        alertsForDestination,
      );
      const dryRunMessageCount =
        previewMessages.length > 0 ? previewMessages.length : 1;
      pushResult(
        destination,
        deliveryMode,
        "dry_run",
        dryRunMessageCount,
        1,
        briefing.groupCount,
        previewMessages,
      );
      const log = await writeLog(
        destination,
        deliveryMode,
        alertIds,
        "dry_run",
        dryRunMessageCount,
        null,
        null,
        soleWatchlistId,
      );
      deliveryLogIds.push(log.id);
      continue;
    }

    const { result, messageCount, briefingCount, groupsGenerated } =
      deliveryMode === "digest"
        ? await sendDigest(destination, alertsForDestination)
        : await sendAlertFanout(destination, alertsForDestination);

    const status = result.ok ? "sent" : "failed";
    pushResult(
      destination,
      deliveryMode,
      status,
      messageCount,
      briefingCount,
      groupsGenerated,
      undefined,
      result.sanitizedError,
    );
    const log = await writeLog(
      destination,
      deliveryMode,
      alertIds,
      status,
      messageCount,
      result.sanitizedError ?? null,
      result.externalIds ?? null,
      soleWatchlistId,
    );
    deliveryLogIds.push(log.id);

    await db.radarDeliveryDestination.update({
      where: { id: destination.id },
      data: { lastPolledAt: now },
    });
  }

  const destinationsMatched = channelResults.filter((result) =>
    ["dry_run", "sent", "failed", "blocked"].includes(result.status),
  ).length;
  const deliveriesAttempted = channelResults.filter((result) =>
    ["dry_run", "sent", "failed"].includes(result.status),
  ).length;
  const deliveriesSucceeded = channelResults.filter((result) => result.status === "sent").length;
  const deliveriesFailed = channelResults.filter((result) => result.status === "failed").length;
  const deliveriesSkipped = channelResults.filter((result) =>
    ["skipped", "blocked"].includes(result.status),
  ).length;
  const briefingsGenerated = channelResults.reduce(
    (sum, result) => sum + result.briefingCount,
    0,
  );
  const groupsGenerated = channelResults.reduce(
    (sum, result) => sum + result.groupsGenerated,
    0,
  );
  const messagesGenerated = channelResults.reduce(
    (sum, result) => sum + result.messageCount,
    0,
  );

  let status: "success" | "partial" | "failed" | "dry_run" | "no_matches";
  if (matchedAlerts.length === 0 && channelResults.every((result) => result.deliveryMode !== "public_thread")) {
    status = "no_matches";
  } else if (dryRun) {
    status = "dry_run";
  } else if (deliveriesAttempted === 0) {
    status = "partial";
  } else if (deliveriesFailed === 0) {
    status = "success";
  } else if (deliveriesSucceeded > 0) {
    status = "partial";
  } else {
    status = "failed";
  }

  return NextResponse.json({
    status,
    window,
    ledgerEventsFetched,
    eventsInsideWindow: alertsInsideWindowEvents.length,
    uniqueAlertsMatched: matchedAlerts.length,
    alertsFetched: ledgerEventsFetched,
    alertsInsideWindow: alertsInsideWindowEvents.length,
    activeWatchlistsLoaded,
    broadWatchlistsLoaded,
    alertsMatched: matchedAlerts.length,
    watchlistsMatched,
    destinationsMatched,
    briefingsGenerated,
    groupsGenerated,
    messagesGenerated,
    deliveriesAttempted,
    deliveriesSucceeded,
    deliveriesFailed,
    deliveriesSkipped,
    channelResults,
    matchedAlerts: matchedAlertsForResponse,
    excludedEvents,
    alertResults,
    unmatchedAlertReasons,
    watchlistMatchDetails,
    deliveryLogIds,
    latestError,
  });
}
