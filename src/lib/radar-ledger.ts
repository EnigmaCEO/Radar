import type { RadarAlert } from "@/lib/api-types";

export const RADAR_LEDGER_WINDOW_OPTIONS = [
  { value: "7d", label: "7d" },
  { value: "14d", label: "14d" },
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
  { value: "all", label: "All" },
] as const;

export type RadarLedgerWindow = (typeof RADAR_LEDGER_WINDOW_OPTIONS)[number]["value"];

const RADAR_LEDGER_WINDOW_MS: Record<Exclude<RadarLedgerWindow, "all">, number> = {
  "7d": 7 * 24 * 60 * 60 * 1000,
  "14d": 14 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  "90d": 90 * 24 * 60 * 60 * 1000,
};

function toTimestamp(value: string | undefined): number | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function radarLedgerActivityTimestamp(alert: RadarAlert): number | null {
  return (
    toTimestamp(alert.updatedAt) ??
    toTimestamp(alert.resolvedAt) ??
    toTimestamp(alert.openedAt) ??
    toTimestamp(alert.createdAt)
  );
}

export function filterLedgerAlertsByWindow(
  alerts: RadarAlert[],
  window: RadarLedgerWindow,
  now = new Date(),
): RadarAlert[] {
  if (window === "all") return alerts;

  const cutoff = now.getTime() - RADAR_LEDGER_WINDOW_MS[window];
  return alerts.filter((alert) => {
    if (alert.status === "active") return true;
    const timestamp = radarLedgerActivityTimestamp(alert);
    return timestamp !== null && timestamp >= cutoff;
  });
}
