import { describe, expect, it } from "vitest";
import { getWatchlistLimit } from "./plan-limits";

describe("getWatchlistLimit", () => {
  it("free plan is limited to 3", () => {
    expect(getWatchlistLimit("free")).toBe(3);
  });

  it("radar_live plan is limited to 10", () => {
    expect(getWatchlistLimit("radar_live")).toBe(10);
  });

  it("radar_pro plan is unlimited", () => {
    expect(getWatchlistLimit("radar_pro")).toBe(Infinity);
  });

  it("managed plan is unlimited", () => {
    expect(getWatchlistLimit("managed")).toBe(Infinity);
  });

  it("unrecognized plan values (e.g. internal sagitta/client0 accounts) are unlimited", () => {
    expect(getWatchlistLimit("internal")).toBe(Infinity);
  });
});
