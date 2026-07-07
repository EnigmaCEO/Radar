export const WATCHLIST_MONITOR_TYPES = ["oracle", "bridge", "lp"] as const;
export const WATCHLIST_SIGNAL_CLASSES = ["alert", "warning", "watch", "coverage"] as const;
export const WATCHLIST_SEVERITIES = ["watch", "warning", "critical"] as const;
export const WATCHLIST_MATCH_MODES = ["any", "all"] as const;

export class WatchlistValidationError extends Error {}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

function validateEnumArray(value: unknown, allowed: readonly string[], field: string): string[] {
  if (value === undefined) return [];
  if (!isStringArray(value)) throw new WatchlistValidationError(`${field} must be an array of strings.`);
  for (const v of value) {
    if (!allowed.includes(v)) throw new WatchlistValidationError(`Invalid ${field} value: "${v}".`);
  }
  return value;
}

function validateFreeformArray(value: unknown, field: string): string[] {
  if (value === undefined) return [];
  if (!isStringArray(value)) throw new WatchlistValidationError(`${field} must be an array of strings.`);
  return value;
}

export interface WatchlistFilterFields {
  matchMode: string;
  minSeverity: string;
  signalClasses: string[];
  monitorTypes: string[];
  providers: string[];
  chains: string[];
  assets: string[];
  objectIds: string[];
  tags: string[];
  purposes: string[];
  statuses: string[];
}

// Validates and sanitizes the filter portion of a watchlist create/update payload.
// Only fields present in `body` are validated/returned — callers merge with existing
// values for partial (PATCH) updates.
export function validateWatchlistFilters(body: Record<string, unknown>): Partial<WatchlistFilterFields> {
  const result: Partial<WatchlistFilterFields> = {};

  if (body.matchMode !== undefined) {
    if (typeof body.matchMode !== "string" || !WATCHLIST_MATCH_MODES.includes(body.matchMode as never)) {
      throw new WatchlistValidationError(`matchMode must be one of: ${WATCHLIST_MATCH_MODES.join(", ")}.`);
    }
    result.matchMode = body.matchMode;
  }

  if (body.minSeverity !== undefined) {
    if (typeof body.minSeverity !== "string" || !WATCHLIST_SEVERITIES.includes(body.minSeverity as never)) {
      throw new WatchlistValidationError(`minSeverity must be one of: ${WATCHLIST_SEVERITIES.join(", ")}.`);
    }
    result.minSeverity = body.minSeverity;
  }

  if (body.signalClasses !== undefined) {
    result.signalClasses = validateEnumArray(body.signalClasses, WATCHLIST_SIGNAL_CLASSES, "signalClasses");
  }
  if (body.monitorTypes !== undefined) {
    result.monitorTypes = validateEnumArray(body.monitorTypes, WATCHLIST_MONITOR_TYPES, "monitorTypes");
  }
  if (body.providers !== undefined) result.providers = validateFreeformArray(body.providers, "providers");
  if (body.chains !== undefined) result.chains = validateFreeformArray(body.chains, "chains");
  if (body.assets !== undefined) result.assets = validateFreeformArray(body.assets, "assets");
  if (body.objectIds !== undefined) result.objectIds = validateFreeformArray(body.objectIds, "objectIds");
  if (body.tags !== undefined) result.tags = validateFreeformArray(body.tags, "tags");
  if (body.purposes !== undefined) result.purposes = validateFreeformArray(body.purposes, "purposes");
  if (body.statuses !== undefined) result.statuses = validateFreeformArray(body.statuses, "statuses");

  return result;
}
