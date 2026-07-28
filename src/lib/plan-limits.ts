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
export interface DashboardNavLink {
  href: string;
  label: string;
}

function isAdminOverride(isAdmin?: boolean, adminViewPlan?: string | null): boolean {
  return isAdmin === true && !adminViewPlan;
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

const DEFAULT_DASHBOARD_NAV_LINKS: DashboardNavLink[] = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/alerts", label: "Alerts" },
  { href: "/dashboard/watchlists", label: "Watchlists" },
  { href: "/dashboard/thresholds", label: "Thresholds" },
  { href: "/dashboard/destinations", label: "Delivery" },
  { href: "/dashboard/settings", label: "Settings" },
];

const INTEL_DASHBOARD_NAV_LINKS: DashboardNavLink[] = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/alerts", label: "Aggregate history" },
  { href: "/dashboard/provider-reliability", label: "Provider reliability" },
  { href: "/dashboard/infrastructure-health", label: "Health trends" },
  { href: "/dashboard/reports", label: "Reports" },
  { href: "/dashboard/thresholds", label: "Thresholds" },
  { href: "/dashboard/settings", label: "Settings" },
];

export function resolvePlan(plan: string, isAdmin = false, adminViewPlan?: string | null): ResolvedRadarPlan {
  if (isAdminOverride(isAdmin, adminViewPlan)) return "internal";
  if (adminViewPlan) return PLAN_ALIAS_MAP[adminViewPlan] ?? "internal";
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
  adminViewPlan?: string | null;
}): boolean {
  if (account.isAdmin) return true;
  const resolved = resolvePlan(account.plan, account.isAdmin, account.adminViewPlan);
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

export function getPlanLabel(plan: string, isAdmin = false, adminViewPlan?: string | null): string {
  return PLAN_LABELS[resolvePlan(plan, isAdmin, adminViewPlan)];
}

export function getPrivateObjectLimit(plan: string, isAdmin = false, adminViewPlan?: string | null): number {
  return PLAN_PRIVATE_OBJECT_LIMITS[resolvePlan(plan, isAdmin, adminViewPlan)];
}

export function getWatchlistLimit(plan: string, isAdmin = false, adminViewPlan?: string | null): number {
  return getPrivateObjectLimit(plan, isAdmin, adminViewPlan);
}

export function allowsPrivateWatchlists(plan: string, isAdmin = false, adminViewPlan?: string | null): boolean {
  return getPrivateObjectLimit(plan, isAdmin, adminViewPlan) > 0;
}

export function getPrivateHistoryDays(plan: string, isAdmin = false, adminViewPlan?: string | null): number | null {
  return PLAN_HISTORY_DAYS[resolvePlan(plan, isAdmin, adminViewPlan)];
}

export function getDashboardAlertHistoryDays(
  plan: string,
  isAdmin = false,
  adminViewPlan?: string | null,
): number | null {
  const resolved = resolvePlan(plan, isAdmin, adminViewPlan);
  if (resolved === "radar_intel") return null;
  return PLAN_HISTORY_DAYS[resolved];
}

export function getAllowedDestinationChannels(plan: string, isAdmin = false, adminViewPlan?: string | null): DestinationChannel[] {
  return PLAN_DESTINATION_CHANNELS[resolvePlan(plan, isAdmin, adminViewPlan)];
}

export function canConfigurePrivateDestinations(plan: string, isAdmin = false, adminViewPlan?: string | null): boolean {
  return getAllowedDestinationChannels(plan, isAdmin, adminViewPlan).length > 0;
}

export function getDashboardNavLinks(
  plan: string,
  isAdmin = false,
  adminViewPlan?: string | null,
): DashboardNavLink[] {
  return resolvePlan(plan, isAdmin, adminViewPlan) === "radar_intel"
    ? INTEL_DASHBOARD_NAV_LINKS
    : DEFAULT_DASHBOARD_NAV_LINKS;
}

export function canAccessDashboardAlerts(
  plan: string,
  isAdmin = false,
  adminViewPlan?: string | null,
): boolean {
  const resolved = resolvePlan(plan, isAdmin, adminViewPlan);
  return resolved === "watch" || resolved === "radar_signal" || resolved === "radar_intel" || resolved === "desk" || resolved === "internal";
}

export function getAllowedDeliveryModes(plan: string, isAdmin = false, adminViewPlan?: string | null): DeliveryMode[] {
  return PLAN_DELIVERY_MODES[resolvePlan(plan, isAdmin, adminViewPlan)];
}

export function getDestinationLimit(plan: string, isAdmin = false, adminViewPlan?: string | null): number {
  return PLAN_DESTINATION_LIMITS[resolvePlan(plan, isAdmin, adminViewPlan)];
}

export function canRunManualDelivery(plan: string, isAdmin = false, adminViewPlan?: string | null): boolean {
  const resolved = resolvePlan(plan, isAdmin, adminViewPlan);
  return resolved === "watch" || resolved === "radar_signal" || resolved === "desk" || resolved === "internal";
}
