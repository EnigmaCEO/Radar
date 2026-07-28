export const ADMIN_VIEW_PLAN_COOKIE = "radar_admin_view_plan";
export const ADMIN_VIEW_PLAN_HEADER = "x-radar-admin-view-plan";

export const ADMIN_VIEW_PLANS = [
  "public_record",
  "watch",
  "radar_intel",
  "radar_signal",
  "desk",
] as const;

export type AdminViewPlan = (typeof ADMIN_VIEW_PLANS)[number];

export function normalizeAdminViewPlan(value: string | null | undefined): AdminViewPlan | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  return ADMIN_VIEW_PLANS.includes(trimmed as AdminViewPlan) ? (trimmed as AdminViewPlan) : null;
}
