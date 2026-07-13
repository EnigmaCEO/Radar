import { describe, expect, it } from "vitest";
import type { SceCatalogObject } from "./sce-catalog-types";
import { analyzeWatchlistCoverage } from "./watchlist-coverage";

function makeCatalogObject(id: string, overrides: Partial<SceCatalogObject> = {}): SceCatalogObject {
  return {
    id,
    monitorType: "oracle",
    displayName: id,
    provider: "Chainlink",
    chain: "Base",
    asset: "USDC",
    assetPair: "USDC/USD",
    route: null,
    pool: null,
    status: "active",
    canAlert: true,
    canBroadcast: true,
    canWatch: true,
    tags: [],
    commercialValue: null,
    purpose: "public",
    ...overrides,
  };
}

const catalog = [
  makeCatalogObject("obj_1"),
  makeCatalogObject("obj_2", { asset: "ETH", assetPair: "ETH/USD", provider: "Pyth" }),
  makeCatalogObject("obj_3", { asset: "ETH", assetPair: "ETH/USD", provider: "Pyth", chain: "Arbitrum" }),
];

describe("analyzeWatchlistCoverage", () => {
  it("keeps blank draft watchlists at zero coverage", () => {
    const analysis = analyzeWatchlistCoverage(
      {
        scopeType: null,
        matchMode: "any",
        minSeverity: "watch",
        signalClasses: [],
        monitorTypes: [],
        providers: [],
        chains: [],
        assets: [],
        objectIds: [],
        tags: [],
        purposes: [],
        statuses: [],
      },
      catalog,
      { blankBehavior: "empty" },
    );

    expect(analysis.coverageCount).toBe(0);
  });

  it("counts exact objects directly", () => {
    const analysis = analyzeWatchlistCoverage(
      {
        scopeType: "exact_objects",
        matchMode: "any",
        minSeverity: "watch",
        signalClasses: [],
        monitorTypes: [],
        providers: [],
        chains: [],
        assets: [],
        objectIds: ["obj_1", "obj_2"],
        tags: [],
        purposes: [],
        statuses: [],
      },
      catalog,
    );

    expect(analysis.coverageCount).toBe(2);
  });

  it("matches asset lens coverage the same way as the backend helper", () => {
    const analysis = analyzeWatchlistCoverage(
      {
        scopeType: "asset_lens",
        matchMode: "any",
        minSeverity: "watch",
        signalClasses: [],
        monitorTypes: [],
        providers: [],
        chains: [],
        assets: ["ETH"],
        objectIds: [],
        tags: [],
        purposes: [],
        statuses: [],
      },
      catalog,
    );

    expect(analysis.coverageCount).toBe(2);
  });
});
