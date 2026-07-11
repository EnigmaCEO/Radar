import type { DeliveryMode } from "./delivery-modes";

export const ALL_DESTINATION_CHANNELS = [
  "discord_webhook",
  "telegram_bot",
  "webhook",
  "x_account",
] as const;

export type DestinationChannel = (typeof ALL_DESTINATION_CHANNELS)[number];
export type EffectiveRadarPlan =
  | "public_record"
  | "watch"
  | "radar_signal"
  | "radar_intel"
  | "desk";
export type ResolvedRadarPlan = EffectiveRadarPlan | "internal";

const PLAN_ALIAS_MAP: Record<string, EffectiveRadarPlan> = {
  free: "public_record",
  public_record: "public_record",
  watch: "watch",
  radar_live: "radar_intel",
  radar_intel: "radar_intel",
  radar: "radar_signal",
  radar_pro: "radar_signal",
  radar_signal: "radar_signal",
  managed: "desk",
  desk: "desk",
};

const PLAN_LABELS: Record<ResolvedRadarPlan, string> = {
  public_record: "Public Record",
  watch: "Watch",
  radar_signal: "Signal",
  radar_intel: "Intel",
  desk: "Desk",
  internal: "Internal",
};

const PLAN_PRIVATE_OBJECT_LIMITS: Record<ResolvedRadarPlan, number> = {
  public_record: 0,
  watch: 5,
  radar_signal: 25,
  radar_intel: 0,
  desk: Infinity,
  internal: Infinity,
};

const PLAN_HISTORY_DAYS: Record<ResolvedRadarPlan, number | null> = {
  public_record: 0,
  watch: 7,
  radar_signal: 90,
  radar_intel: 0,
  desk: null,
  internal: null,
};

const PLAN_DESTINATION_CHANNELS: Record<ResolvedRadarPlan, DestinationChannel[]> = {
  public_record: [],
  watch: ["discord_webhook", "telegram_bot"],
  radar_signal: ["discord_webhook", "telegram_bot", "webhook"],
  radar_intel: [],
  desk: [...ALL_DESTINATION_CHANNELS],
  internal: [...ALL_DESTINATION_CHANNELS],
};

const PLAN_DELIVERY_MODES: Record<ResolvedRadarPlan, DeliveryMode[]> = {
  public_record: [],
  watch: ["digest"],
  radar_signal: ["alert_fanout", "announcement_feed", "digest"],
  radar_intel: [],
  desk: ["alert_fanout", "announcement_feed", "digest", "public_thread"],
  internal: ["alert_fanout", "announcement_feed", "digest", "public_thread"],
};

// Number of delivery destinations an account may configure. Watch is limited to
// a single destination; Signal and above are effectively unlimited.
const PLAN_DESTINATION_LIMITS: Record<ResolvedRadarPlan, number> = {
  public_record: 0,
  watch: 1,
  radar_signal: Infinity,
  radar_intel: 0,
  desk: Infinity,
  internal: Infinity,
};

export function resolvePlan(plan: string): ResolvedRadarPlan {
  return PLAN_ALIAS_MAP[plan] ?? "internal";
}

// Statuses that count as a live, paid subscription. `trial` is intentionally
// excluded: dashboard access requires a paid, active plan.
const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "past_due"]);

// True when the account holds a paid plan with a live subscription. Unpaid
// (`public_record`/`free`) and canceled/suspended accounts return false.
// `internal` plans (staff / unknown aliases) always pass.
export function hasActivePlan(account: { plan: string; status: string }): boolean {
  const resolved = resolvePlan(account.plan);
  if (resolved === "internal") return true;
  if (resolved === "public_record") return false;
  return ACTIVE_SUBSCRIPTION_STATUSES.has(account.status);
}

export function getPlanLabel(plan: string): string {
  return PLAN_LABELS[resolvePlan(plan)];
}

export function getPrivateObjectLimit(plan: string): number {
  return PLAN_PRIVATE_OBJECT_LIMITS[resolvePlan(plan)];
}

export function getWatchlistLimit(plan: string): number {
  return getPrivateObjectLimit(plan);
}

export function allowsPrivateWatchlists(plan: string): boolean {
  return getPrivateObjectLimit(plan) > 0;
}

export function getPrivateHistoryDays(plan: string): number | null {
  return PLAN_HISTORY_DAYS[resolvePlan(plan)];
}

export function getAllowedDestinationChannels(plan: string): DestinationChannel[] {
  return PLAN_DESTINATION_CHANNELS[resolvePlan(plan)];
}

export function canConfigurePrivateDestinations(plan: string): boolean {
  return getAllowedDestinationChannels(plan).length > 0;
}

export function getAllowedDeliveryModes(plan: string): DeliveryMode[] {
  return PLAN_DELIVERY_MODES[resolvePlan(plan)];
}

export function getDestinationLimit(plan: string): number {
  return PLAN_DESTINATION_LIMITS[resolvePlan(plan)];
}

export function canRunManualDelivery(plan: string): boolean {
  const resolved = resolvePlan(plan);
  return resolved === "radar_signal" || resolved === "desk" || resolved === "internal";
}
