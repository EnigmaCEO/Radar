// Server-only client for the SCE Radar Catalog endpoint. Must only be imported
// from server components/route handlers — reads SCE_ADMIN_API_KEY.
// SCE owns the monitorable object catalog (oracle feeds, bridge routes, LP pools);
// Radar reads it to populate watchlist filters but never stores a copy of it.

export type SceMonitorType = "oracle" | "bridge" | "lp";

export interface SceCatalogObject {
  id: string;
  monitorType: SceMonitorType;
  displayName: string;
  provider: string;
  chain: string;
  asset: string | null;
  assetPair: string | null;
  route: string | null;
  pool: string | null;
  status: string;
  canAlert: boolean;
  canBroadcast: boolean;
  canWatch: boolean;
  tags: string[];
  commercialValue: string | null;
  purpose: string | null;
}

export interface SceCatalogFilters {
  providers: string[];
  chains: string[];
  assets: string[];
  tags: string[];
  purposes: string[];
  statuses: string[];
}

export interface SceCatalogResponse {
  objects: SceCatalogObject[];
  filters: SceCatalogFilters;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function firstString(...values: unknown[]): string | null {
  for (const v of values) {
    if (typeof v === "string" && v.length > 0) return v;
  }
  return null;
}

// Only ever copies known-safe fields out of the raw SCE response — protects
// against SCE ever including admin-only fields in a catalog object payload.
// SCE's real catalog objects key on `objectId` (not `id`) and use
// `providerDisplayName`/`chainDisplayName`/`commercialValueTier` for display —
// this also tolerates a plainer `id`/`provider`/`chain`/`commercialValue` shape.
function sanitizeObject(raw: Record<string, unknown>): SceCatalogObject | null {
  const id = firstString(raw.objectId, raw.id);
  if (id === null || typeof raw.monitorType !== "string") return null;
  if (!["oracle", "bridge", "lp"].includes(raw.monitorType)) return null;

  return {
    id,
    monitorType: raw.monitorType as SceMonitorType,
    displayName: firstString(raw.displayName) ?? id,
    provider: firstString(raw.providerDisplayName, raw.provider) ?? "",
    chain: firstString(raw.chainDisplayName, raw.chain) ?? "",
    asset: firstString(raw.asset),
    assetPair: firstString(raw.assetPair),
    route: firstString(raw.routeDisplayName, raw.route),
    pool: firstString(raw.poolName, raw.pool),
    status: firstString(raw.status) ?? "unknown",
    canAlert: raw.canAlert === true,
    canBroadcast: raw.canBroadcast === true,
    canWatch: raw.canWatch === true,
    tags: toStringArray(raw.tags),
    commercialValue: firstString(raw.commercialValueTier, raw.commercialValue),
    purpose: firstString(raw.purpose),
  };
}

function deriveFilters(objects: SceCatalogObject[]): SceCatalogFilters {
  const uniq = (values: (string | null)[]) =>
    Array.from(new Set(values.filter((v): v is string => !!v))).sort();

  return {
    providers: uniq(objects.map((o) => o.provider)),
    chains: uniq(objects.map((o) => o.chain)),
    assets: uniq(objects.map((o) => o.asset)),
    tags: uniq(objects.flatMap((o) => o.tags)),
    purposes: uniq(objects.map((o) => o.purpose)),
    statuses: uniq(objects.map((o) => o.status)),
  };
}

const MONITOR_TYPE_GROUPS: SceMonitorType[] = ["oracle", "bridge", "lp"];

function extractGroup(source: Record<string, unknown>, key: string): unknown[] {
  const value = source[key];
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object" && Array.isArray((value as Record<string, unknown>).objects)) {
    return (value as Record<string, unknown>).objects as unknown[];
  }
  return [];
}

// SCE's real catalog response groups objects under top-level `oracle`/`bridge`/`lp`
// arrays (each entry a raw object). Also tolerates a flat `{ objects: [...] }` shape
// or a bare array, in case the endpoint's shape changes.
function extractRawObjects(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return [];
  const record = data as Record<string, unknown>;
  if (Array.isArray(record.objects)) return record.objects;
  return MONITOR_TYPE_GROUPS.flatMap((group) => extractGroup(record, group));
}

export class SceCatalogError extends Error {}

export async function fetchSceCatalog(): Promise<SceCatalogResponse> {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "https://continuityengineserver.fly.dev";
  const adminKey = process.env.SCE_ADMIN_API_KEY;
  if (!adminKey) {
    throw new SceCatalogError("SCE_ADMIN_API_KEY is not configured.");
  }

  let res: Response;
  try {
    res = await fetch(`${base}/v1/sce/radar/catalog`, {
      headers: { "X-SCE-Admin-Key": adminKey },
      cache: "no-store",
    });
  } catch {
    throw new SceCatalogError("SCE catalog is unavailable.");
  }

  if (!res.ok) {
    throw new SceCatalogError(`SCE catalog request failed (${res.status}).`);
  }

  const data = await res.json().catch(() => null);
  const rawObjects = extractRawObjects(data);

  const objects = (rawObjects as Record<string, unknown>[])
    .map(sanitizeObject)
    .filter((o): o is SceCatalogObject => o !== null);

  return { objects, filters: deriveFilters(objects) };
}
