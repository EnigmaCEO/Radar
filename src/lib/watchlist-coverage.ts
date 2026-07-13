import type { ResolvedRadarPlan } from "./plan-limits";
import type { SceCatalogObject } from "./sce-catalog-types";
import type { WatchlistScopeType } from "./watchlist-filters";

export interface WatchlistScopeIssue {
  code: string;
  message: string;
}

export interface WatchlistScopeState {
  scopeType: WatchlistScopeType | null;
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

export interface WatchlistScopeAnalysis {
  scopeType: WatchlistScopeType | null;
  coverageObjectIds: Set<string>;
  coverageCount: number;
  issue: WatchlistScopeIssue | null;
}

export const WATCHLIST_SCOPE_LABELS: Record<WatchlistScopeType, string> = {
  exact_objects: "Exact objects",
  asset_lens: "Asset lens",
  chain_lens: "Chain lens",
  provider_lens: "Provider lens",
  pillar_lens: "Pillar lens",
  full_catalog: "Full standard catalog",
  custom_monitor: "Custom monitor",
};

export const WATCHLIST_SCOPE_AVAILABILITY: Record<
  Exclude<WatchlistScopeType, "custom_monitor">,
  ResolvedRadarPlan[]
> = {
  exact_objects: ["watch", "radar_signal", "desk", "internal"],
  asset_lens: ["watch", "radar_signal", "desk", "internal"],
  chain_lens: ["radar_signal", "desk", "internal"],
  provider_lens: ["radar_signal", "desk", "internal"],
  pillar_lens: ["radar_signal", "desk", "internal"],
  full_catalog: ["radar_signal", "desk", "internal"],
};

function uniq(values: string[]): string[] {
  return Array.from(new Set(values));
}

function ciEquals(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function includesCi(values: string[], candidate: string | null): boolean {
  return candidate !== null && values.some((value) => ciEquals(value, candidate));
}

function ambiguous(message: string): WatchlistScopeAnalysis {
  return {
    scopeType: null,
    coverageObjectIds: new Set(),
    coverageCount: 0,
    issue: { code: "ambiguous_scope", message },
  };
}

function withCoverage(scopeType: WatchlistScopeType, objects: SceCatalogObject[]): WatchlistScopeAnalysis {
  return {
    scopeType,
    coverageObjectIds: new Set(objects.map((object) => object.id)),
    coverageCount: objects.length,
    issue: null,
  };
}

export function analyzeWatchlistCoverage(
  state: WatchlistScopeState,
  catalog: SceCatalogObject[],
  options: {
    blankBehavior?: "empty" | "full_catalog";
  } = {},
): WatchlistScopeAnalysis {
  const blankBehavior = options.blankBehavior ?? "empty";
  const scopeType = state.scopeType;
  const objectIds = uniq(state.objectIds).filter((objectId) =>
    catalog.some((object) => object.id === objectId),
  );

  if (state.tags.length > 0 || state.purposes.length > 0) {
    return ambiguous("Legacy operational filters are not editable in the new builder.");
  }

  if (scopeType === null) {
    if (blankBehavior === "full_catalog") {
      return withCoverage("full_catalog", catalog);
    }
    return {
      scopeType: null,
      coverageObjectIds: new Set(),
      coverageCount: 0,
      issue: null,
    };
  }

  switch (scopeType) {
    case "exact_objects":
      if (
        state.assets.length > 0 ||
        state.chains.length > 0 ||
        state.providers.length > 0 ||
        state.monitorTypes.length > 0
      ) {
        return ambiguous("Exact object watchlists cannot mix broader scope filters.");
      }
      return withCoverage(
        "exact_objects",
        catalog.filter((object) => objectIds.includes(object.id)),
      );
    case "asset_lens":
      if (
        state.assets.length !== 1 ||
        state.objectIds.length > 0 ||
        state.chains.length > 0 ||
        state.providers.length > 0 ||
        state.monitorTypes.length > 0
      ) {
        return ambiguous("Asset lens watchlists must select exactly one asset.");
      }
      return withCoverage(
        "asset_lens",
        catalog.filter((object) => includesCi([state.assets[0]], object.asset ?? object.assetPair)),
      );
    case "chain_lens":
      if (
        state.chains.length !== 1 ||
        state.objectIds.length > 0 ||
        state.assets.length > 0 ||
        state.providers.length > 0 ||
        state.monitorTypes.length > 0
      ) {
        return ambiguous("Chain lens watchlists must select exactly one chain.");
      }
      return withCoverage(
        "chain_lens",
        catalog.filter((object) => includesCi([state.chains[0]], object.chain)),
      );
    case "provider_lens":
      if (
        state.providers.length !== 1 ||
        state.objectIds.length > 0 ||
        state.assets.length > 0 ||
        state.chains.length > 0 ||
        state.monitorTypes.length > 0
      ) {
        return ambiguous("Provider lens watchlists must select exactly one provider.");
      }
      return withCoverage(
        "provider_lens",
        catalog.filter((object) => includesCi([state.providers[0]], object.provider)),
      );
    case "pillar_lens":
      if (
        state.monitorTypes.length !== 1 ||
        state.objectIds.length > 0 ||
        state.assets.length > 0 ||
        state.chains.length > 0 ||
        state.providers.length > 0
      ) {
        return ambiguous("Pillar lens watchlists must select exactly one pillar.");
      }
      return withCoverage(
        "pillar_lens",
        catalog.filter((object) => object.monitorType === state.monitorTypes[0]),
      );
    case "full_catalog":
      if (
        state.objectIds.length > 0 ||
        state.assets.length > 0 ||
        state.chains.length > 0 ||
        state.providers.length > 0 ||
        state.monitorTypes.length > 0
      ) {
        return ambiguous("Full catalog coverage cannot mix with narrower scope filters.");
      }
      return withCoverage("full_catalog", catalog);
    case "custom_monitor":
      return {
        scopeType: "custom_monitor",
        coverageObjectIds: new Set(),
        coverageCount: 0,
        issue: null,
      };
  }
}
