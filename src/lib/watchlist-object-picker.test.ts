import { describe, expect, it } from "vitest";
import type { SceCatalogObject } from "./sce-catalog";
import { filterObjectsForPicker, groupObjectsByMonitorType } from "./watchlist-object-picker";

function makeObject(overrides: Partial<SceCatalogObject>): SceCatalogObject {
  return {
    id: "obj_1",
    monitorType: "oracle",
    displayName: "Object",
    provider: "Chainlink",
    chain: "Base",
    asset: "USDC",
    assetPair: null,
    route: null,
    pool: null,
    status: "active",
    canAlert: true,
    canBroadcast: false,
    canWatch: true,
    tags: [],
    commercialValue: null,
    purpose: null,
    ...overrides,
  };
}

describe("groupObjectsByMonitorType", () => {
  it("groups catalog objects into oracle/bridge/lp buckets", () => {
    const objects = [
      makeObject({ id: "o1", monitorType: "oracle" }),
      makeObject({ id: "b1", monitorType: "bridge" }),
      makeObject({ id: "b2", monitorType: "bridge" }),
      makeObject({ id: "l1", monitorType: "lp" }),
    ];

    const groups = groupObjectsByMonitorType(objects);

    expect(groups.oracle.map((o) => o.id)).toEqual(["o1"]);
    expect(groups.bridge.map((o) => o.id)).toEqual(["b1", "b2"]);
    expect(groups.lp.map((o) => o.id)).toEqual(["l1"]);
  });

  it("returns empty arrays for groups with no objects", () => {
    const groups = groupObjectsByMonitorType([]);
    expect(groups).toEqual({ oracle: [], bridge: [], lp: [] });
  });
});

describe("filterObjectsForPicker", () => {
  const objects = [
    makeObject({ id: "o1", monitorType: "oracle" }),
    makeObject({ id: "b1", monitorType: "bridge" }),
    makeObject({ id: "l1", monitorType: "lp" }),
  ];

  it("does not hide any objects by default (no monitor types selected)", () => {
    expect(filterObjectsForPicker(objects, [])).toHaveLength(3);
  });

  it("narrows the list to only the selected monitor types", () => {
    const result = filterObjectsForPicker(objects, ["oracle", "lp"]);
    expect(result.map((o) => o.id).sort()).toEqual(["l1", "o1"]);
  });

  it("returns an empty list when the selected monitor type matches nothing", () => {
    expect(filterObjectsForPicker([], ["oracle"])).toEqual([]);
  });
});
