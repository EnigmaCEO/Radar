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

function isAdminOverride(isAdmin?: boolean): boolean {
  return isAdmin === true;
}

const PLAN_ALIAS_MAP: Record<string, EffectiveRadarPlan> = {
  free: "public_record",
  public_record: "public_record",
  watch: "watch",
  radar_live: "watch",
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
  radar_signal: Infinity,
  radar_intel: 0,
  desk: Infinity,
  internal: Infinity,
};

const PLAN_HISTORY_DAYS: Record<ResolvedRadarPlan, number | null> = {
  public_record: 0,
  watch: 30,
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

export function resolvePlan(plan: string, isAdmin = false): ResolvedRadarPlan {
  if (isAdminOverride(isAdmin)) return "internal";
  return PLAN_ALIAS_MAP[plan] ?? "internal";
}

// Statuses that count as a live, paid subscription. `trial` is intentionally
// excluded: dashboard access requires a paid, active plan.
const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "past_due"]);
const INACTIVE_SUBSCRIPTION_STATUSES = new Set([
  "canceled",
  "cancelled",
  "suspended",
  "unpaid",
  "incomplete",
  "incomplete_expired",
]);

function normalizeSubscriptionStatus(status: string): string {
  return status.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

// True when the account holds a paid plan with a live subscription. Unpaid
// (`public_record`/`free`) and canceled/suspended accounts return false.
// `internal` plans (staff / unknown aliases) always pass.
export function hasActivePlan(account: {
  plan: string;
  status: string;
  isAdmin?: boolean;
  stripeSubId?: string | null;
}): boolean {
  const resolved = resolvePlan(account.plan, account.isAdmin);
  if (resolved === "internal") return true;
  if (resolved === "public_record") return false;

  const normalizedStatus = normalizeSubscriptionStatus(account.status);
  if (ACTIVE_SUBSCRIPTION_STATUSES.has(normalizedStatus)) return true;
  if (INACTIVE_SUBSCRIPTION_STATUSES.has(normalizedStatus)) return false;

  // The standalone backend may temporarily return a non-normalized or stale
  // account status even when Stripe has already attached a live subscription.
  // For paid plans, a present Stripe subscription id is a stronger signal than
  // an unknown intermediate status string.
  return Boolean(account.stripeSubId);
}

export function getPlanLabel(plan: string, isAdmin = false): string {
  return PLAN_LABELS[resolvePlan(plan, isAdmin)];
}

export function getPrivateObjectLimit(plan: string, isAdmin = false): number {
  return PLAN_PRIVATE_OBJECT_LIMITS[resolvePlan(plan, isAdmin)];
}

export function getWatchlistLimit(plan: string, isAdmin = false): number {
  return getPrivateObjectLimit(plan, isAdmin);
}

export function allowsPrivateWatchlists(plan: string, isAdmin = false): boolean {
  return getPrivateObjectLimit(plan, isAdmin) > 0;
}

export function getPrivateHistoryDays(plan: string, isAdmin = false): number | null {
  return PLAN_HISTORY_DAYS[resolvePlan(plan, isAdmin)];
}

export function getAllowedDestinationChannels(plan: string, isAdmin = false): DestinationChannel[] {
  return PLAN_DESTINATION_CHANNELS[resolvePlan(plan, isAdmin)];
}

export function canConfigurePrivateDestinations(plan: string, isAdmin = false): boolean {
  return getAllowedDestinationChannels(plan, isAdmin).length > 0;
}

export function getAllowedDeliveryModes(plan: string, isAdmin = false): DeliveryMode[] {
  return PLAN_DELIVERY_MODES[resolvePlan(plan, isAdmin)];
}

export function getDestinationLimit(plan: string, isAdmin = false): number {
  return PLAN_DESTINATION_LIMITS[resolvePlan(plan, isAdmin)];
}

export function canRunManualDelivery(plan: string, isAdmin = false): boolean {
  const resolved = resolvePlan(plan, isAdmin);
  return resolved === "radar_signal" || resolved === "desk" || resolved === "internal";
}
