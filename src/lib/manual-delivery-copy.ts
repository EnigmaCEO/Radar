export type ManualDeliveryResultStatus = "sent" | "failed" | "blocked" | "dry_run" | "skipped";
export type ManualDeliveryIssueTone = "muted" | "warning" | "error";

const MANUAL_DELIVERY_REASON_COPY: Record<string, string> = {
  below_destination_min_severity: "No alerts met this destination's minimum severity.",
  no_matched_alerts_for_digest: "No matched alerts were available for this digest window.",
  no_eligible_announcement_events:
    "No active alert-opened, alert-updated, or severity-changed events were eligible for announcement feed delivery.",
  inactive_destination: "This destination is paused.",
  destination_paused_over_limit: "This destination is saved but paused because your plan's active destination limit is full.",
  destination_paused_plan_required: "This destination is saved but paused because it requires a higher plan.",
  destination_needs_selection:
    "This destination is saved, but you need to choose which destination stays active on your current plan.",
  destination_channel_not_allowed: "This destination's channel is not available on your current plan.",
  destination_mode_not_allowed: "This destination's delivery mode is not available on your current plan.",
  account_plan_inactive: "This account does not have an active paid plan, so delivery was skipped.",
  missing_config: "This destination is missing delivery configuration.",
  cadence_not_due: "This destination is not due yet for its current cadence.",
  approved_public_thread_required: "Approve the latest public thread preview before sending it.",
  idempotency_replay: "All eligible announcement posts for this destination were already sent.",
  x_sender_unavailable: "X delivery is not available yet.",
  channel_disabled: "This destination's channel was excluded from the run.",
};

function humanizeReason(reason: string): string {
  if (!reason.includes("_")) return reason;
  const sentence = reason.replace(/_/g, " ");
  return sentence.charAt(0).toUpperCase() + sentence.slice(1) + ".";
}

export function formatManualDeliveryReason(reason: string | null | undefined): string | null {
  if (!reason) return null;
  return MANUAL_DELIVERY_REASON_COPY[reason] ?? humanizeReason(reason);
}

export function getManualDeliveryIssueLabel(
  status: ManualDeliveryResultStatus | null | undefined,
): string {
  if (status === "failed") return "Latest error";
  if (status === "blocked") return "Latest blocker";
  return "Latest note";
}

export function getManualDeliveryIssueTone(
  status: ManualDeliveryResultStatus | null | undefined,
): ManualDeliveryIssueTone {
  if (status === "failed") return "error";
  if (status === "blocked") return "warning";
  return "muted";
}
