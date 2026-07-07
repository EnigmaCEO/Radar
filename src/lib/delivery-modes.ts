export const DELIVERY_MODES = ["alert_fanout", "public_thread", "digest"] as const;

export type DeliveryMode = (typeof DELIVERY_MODES)[number];

export const DEFAULT_DELIVERY_MODE: DeliveryMode = "alert_fanout";

export const DELIVERY_MODE_LABEL: Record<DeliveryMode, string> = {
  alert_fanout: "Alert fanout",
  public_thread: "Public thread",
  digest: "Digest",
};

export const DELIVERY_MODE_HELPER_TEXT: Record<DeliveryMode, string> = {
  alert_fanout:
    "Alert fanout: sends grouped situational briefings for matching alerts. Best for operator or client channels, not public community feeds.",
  public_thread: "Public thread: sends the approved Radar public thread for public or community channels.",
  digest: "Digest: sends a grouped situational briefing.",
};

export function isDeliveryMode(value: unknown): value is DeliveryMode {
  return typeof value === "string" && (DELIVERY_MODES as readonly string[]).includes(value);
}

export function normalizeDeliveryMode(value: unknown): DeliveryMode {
  return isDeliveryMode(value) ? value : DEFAULT_DELIVERY_MODE;
}
