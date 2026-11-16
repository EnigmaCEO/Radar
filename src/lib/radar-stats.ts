// The headline "DeFi TVL covered" figure on the landing page and stats banner.
//
// The value is computed live by SCE's Gross Monitored Surface endpoint
// (/v1/sce/radar/gms): the TVL of DeFiLlama-tracked protocols that use the
// Chainlink feeds Radar monitors, on each chain where a feed is enabled, plus
// the TVL of the LP pools Radar checks. Bridge 24h volume is reported by SCE
// for context but is not part of the top line, so it is not added here either.
//
// Only a real reading is ever shown. A failed or empty read throws inside the
// cached function, so it never replaces the last good value; the stored value
// is served while a refresh runs in the background. If no reading has ever
// succeeded, callers get null and hide the figure rather than showing an
// invented one.

import { unstable_cache } from "next/cache";
import type { RadarGms } from "@/lib/api-types";
import { stripTrailingSlash } from "@/lib/utils";

const API_BASE = stripTrailingSlash(
  process.env.NEXT_PUBLIC_API_URL ?? "https://continuityengineserver.fly.dev",
);

export const MONITORED_VALUE_REVALIDATE_SECONDS = 300;

function asPositiveNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

/** SCE's top-line covered TVL: the direct figure, else oracle TVS + LP TVL. */
export function monitoredValueFromGms(data: RadarGms): number | null {
  const direct =
    asPositiveNumber(data.grossMonitoredSurfaceUsd) ??
    asPositiveNumber(data.monitoredValueUsd);
  if (direct !== null) return direct;

  const parts = [data.oracleTvsUsd, data.lpTvlUsd]
    .map(asPositiveNumber)
    .filter((value): value is number => value !== null);

  if (parts.length === 0) return null;
  return parts.reduce((sum, value) => sum + value, 0);
}

/** One live read from SCE. Throws unless it yields a positive value. */
export async function fetchMonitoredValueUsd(): Promise<number> {
  const adminKey = process.env.SCE_ADMIN_API_KEY;
  if (!adminKey) throw new Error("SCE_ADMIN_API_KEY is not set");

  const res = await fetch(`${API_BASE}/v1/sce/radar/gms`, {
    headers: { "X-SCE-Admin-Key": adminKey },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`SCE /radar/gms returned ${res.status}`);
  const value = monitoredValueFromGms((await res.json()) as RadarGms);
  if (value === null) throw new Error("SCE /radar/gms returned no monitored value");
  return value;
}

const cachedMonitoredValueUsd = unstable_cache(fetchMonitoredValueUsd, ["radar-monitored-value-usd-v2"], {
  revalidate: MONITORED_VALUE_REVALIDATE_SECONDS,
});

/** The last good reading, or null when none has ever succeeded. */
export async function getMonitoredValueUsd(
  read: () => Promise<number> = cachedMonitoredValueUsd,
): Promise<number | null> {
  try {
    return await read();
  } catch {
    return null;
  }
}

/** "$328.4B", "$950M": compact, so a billion-scale figure reads at a glance. */
export function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}
