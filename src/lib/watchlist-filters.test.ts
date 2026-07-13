import { describe, expect, it } from "vitest";
import { WatchlistValidationError, validateWatchlistFilters } from "./watchlist-filters";

describe("validateWatchlistFilters", () => {
  it("accepts a full valid payload and returns all filter fields", () => {
    const result = validateWatchlistFilters({
      scopeType: "asset_lens",
      matchMode: "all",
      minSeverity: "critical",
      signalClasses: ["alert", "coverage"],
      monitorTypes: ["oracle", "bridge"],
      providers: ["Chainlink"],
      chains: ["base"],
      assets: ["USDC"],
      objectIds: ["obj_1"],
      tags: ["priority"],
      purposes: ["lending"],
      statuses: ["active"],
    });

    expect(result).toEqual({
      scopeType: "asset_lens",
      matchMode: "all",
      minSeverity: "critical",
      signalClasses: ["alert", "coverage"],
      monitorTypes: ["oracle", "bridge"],
      providers: ["Chainlink"],
      chains: ["base"],
      assets: ["USDC"],
      objectIds: ["obj_1"],
      tags: ["priority"],
      purposes: ["lending"],
      statuses: ["active"],
    });
  });

  it("omits fields that are not present in the input (for partial PATCH updates)", () => {
    const result = validateWatchlistFilters({ chains: ["arbitrum"] });
    expect(result).toEqual({ chains: ["arbitrum"] });
  });

  it("accepts null scopeType for legacy watchlists", () => {
    expect(validateWatchlistFilters({ scopeType: null })).toEqual({ scopeType: null });
  });

  it("rejects an invalid scopeType value", () => {
    expect(() => validateWatchlistFilters({ scopeType: "mixed_scope" })).toThrow(
      WatchlistValidationError,
    );
  });

  it("rejects an invalid monitorType value", () => {
    expect(() => validateWatchlistFilters({ monitorTypes: ["governance"] })).toThrow(
      WatchlistValidationError,
    );
  });

  it("rejects an invalid matchMode value", () => {
    expect(() => validateWatchlistFilters({ matchMode: "none" })).toThrow(WatchlistValidationError);
  });

  it("rejects an invalid minSeverity value", () => {
    expect(() => validateWatchlistFilters({ minSeverity: "info" })).toThrow(WatchlistValidationError);
  });

  it("rejects an invalid signalClasses value", () => {
    expect(() => validateWatchlistFilters({ signalClasses: ["urgent"] })).toThrow(
      WatchlistValidationError,
    );
  });

  it("rejects non-array values for freeform filter fields", () => {
    expect(() => validateWatchlistFilters({ providers: "Chainlink" })).toThrow(
      WatchlistValidationError,
    );
  });

  it("rejects arrays containing non-string values", () => {
    expect(() => validateWatchlistFilters({ chains: ["base", 5] })).toThrow(WatchlistValidationError);
  });
});
