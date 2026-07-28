export type EffectiveEntitlementStatus =
  | "active"
  | "paused_over_limit"
  | "paused_plan_required"
  | "needs_selection"
  | "inactive";

export function getEffectiveStatusLabel(status: EffectiveEntitlementStatus): string {
  switch (status) {
    case "active":
      return "Active";
    case "paused_over_limit":
      return "Paused - plan limit";
    case "paused_plan_required":
      return "Paused - plan required";
    case "needs_selection":
      return "Needs selection";
    case "inactive":
      return "Inactive";
  }
}

export function getEffectiveStatusClassName(status: EffectiveEntitlementStatus): string {
  switch (status) {
    case "active":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    case "paused_over_limit":
    case "needs_selection":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
    case "paused_plan_required":
      return "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300";
    case "inactive":
      return "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300";
  }
}

export function isPlanPausedStatus(status: EffectiveEntitlementStatus): boolean {
  return (
    status === "paused_over_limit" ||
    status === "paused_plan_required" ||
    status === "needs_selection"
  );
}
