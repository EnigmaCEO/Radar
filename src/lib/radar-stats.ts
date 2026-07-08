import type { RadarGms } from "@/lib/api-types";
import { stripTrailingSlash } from "@/lib/utils";

const API_BASE = stripTrailingSlash(
  process.env.NEXT_PUBLIC_API_URL ?? "https://continuityengineserver.fly.dev",
);
const FALLBACK_VALUE_USD = 3_000_000_000;
const CACHE_TTL_MS = 5 * 60 * 1000;

let cachedValue: number | null = null;
let cachedAt = 0;
let inflightValue: Promise<number> | null = null;

function asPositiveNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function getValueFromGms(data: RadarGms): number | null {
  const direct =
    asPositiveNumber(data.grossMonitoredSurfaceUsd) ??
    asPositiveNumber(data.monitoredValueUsd);
  if (direct !== null) return direct;

  const parts = [data.oracleTvsUsd, data.bridgeVolume24hUsd, data.lpTvlUsd]
    .map((value) => (typeof value === "number" && Number.isFinite(value) ? value : 0))
    .filter((value) => value > 0);

  if (parts.length === 0) return null;
  return parts.reduce((sum, value) => sum + value, 0);
}

async function fetchMonitoredValueUsd(): Promise<number> {
  const adminKey = process.env.SCE_ADMIN_API_KEY;
  if (!adminKey) return FALLBACK_VALUE_USD;

  try {
    const res = await fetch(`${API_BASE}/v1/sce/radar/gms`, {
      headers: { "X-SCE-Admin-Key": adminKey },
      next: { revalidate: 300 },
    });
    if (!res.ok) return FALLBACK_VALUE_USD;
    const data: RadarGms = await res.json();
    return getValueFromGms(data) ?? FALLBACK_VALUE_USD;
  } catch {
    return FALLBACK_VALUE_USD;
  }
}

export async function getMonitoredValueUsd(): Promise<number> {
  const now = Date.now();
  if (cachedValue !== null && now - cachedAt < CACHE_TTL_MS) {
    return cachedValue;
  }

  if (inflightValue) {
    return inflightValue;
  }

  inflightValue = fetchMonitoredValueUsd()
    .then((value) => {
      cachedValue = value;
      cachedAt = Date.now();
      return value;
    })
    .finally(() => {
      inflightValue = null;
    });

  return inflightValue;
}

export function clearMonitoredValueUsdCache() {
  cachedValue = null;
  cachedAt = 0;
  inflightValue = null;
}

export function formatUsd(value: number): string {
  if (value >= 1_000_000)
    return `$${(value / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 0 })}M`;
  return `$${value.toLocaleString("en-US")}`;
}
