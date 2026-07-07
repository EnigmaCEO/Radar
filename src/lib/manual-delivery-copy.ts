export type ManualDeliveryResultStatus = "sent" | "failed" | "blocked" | "dry_run" | "skipped";
export type ManualDeliveryIssueTone = "muted" | "warning" | "error";

const MANUAL_DELIVERY_REASON_COPY: Record<string, string> = {
  below_destination_min_severity: "No alerts met this destination's minimum severity.",
  no_matched_alerts_for_digest: "No matched alerts were available for this digest window.",
  inactive_destination: "This destination is paused.",
  missing_config: "This destination is missing delivery configuration.",
  cadence_not_due: "This destination is not due yet for its current cadence.",
  approved_public_thread_required: "Approve the latest public thread preview before sending it.",
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
