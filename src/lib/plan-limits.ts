// Plan → watchlist count limit. Plans not listed here (e.g. an internal
// "sagitta"/client0 plan value) are treated as unlimited.
export const WATCHLIST_PLAN_LIMITS: Record<string, number> = {
  free: 3,
  radar_live: 10,
  radar_pro: Infinity,
  managed: Infinity,
};

export function getWatchlistLimit(plan: string): number {
  return WATCHLIST_PLAN_LIMITS[plan] ?? Infinity;
}
