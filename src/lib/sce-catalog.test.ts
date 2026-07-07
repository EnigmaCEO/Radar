import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SceCatalogError, fetchSceCatalog } from "./sce-catalog";

const ORIGINAL_ENV = { ...process.env };

describe("fetchSceCatalog", () => {
  beforeEach(() => {
    process.env.SCE_ADMIN_API_KEY = "test-admin-key";
    process.env.NEXT_PUBLIC_API_URL = "https://sce.example.test";
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.unstubAllGlobals();
  });

  it("sends the SCE admin key as a header and never in the response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ objects: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchSceCatalog();

    expect(fetchMock).toHaveBeenCalledWith(
      "https://sce.example.test/v1/sce/radar/catalog",
      expect.objectContaining({ headers: { "X-SCE-Admin-Key": "test-admin-key" } }),
    );
    expect(JSON.stringify(result)).not.toContain("test-admin-key");
  });

  it("sanitizes catalog objects to only known-safe fields", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          objects: [
            {
              id: "obj_1",
              monitorType: "oracle",
              displayName: "ETH/USD Chainlink",
              provider: "Chainlink",
              chain: "base",
              asset: "ETH",
              status: "active",
              canAlert: true,
              canBroadcast: false,
              tags: ["priority"],
              commercialValue: "high",
              purpose: "lending",
              // Field that should never leak through, e.g. an internal admin note.
              internalAdminSecret: "do-not-leak",
            },
          ],
        }),
      }),
    );

    const result = await fetchSceCatalog();

    expect(result.objects).toHaveLength(1);
    expect(result.objects[0]).not.toHaveProperty("internalAdminSecret");
    expect(result.objects[0].displayName).toBe("ETH/USD Chainlink");
  });

  it("derives filter option lists from the sanitized objects", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          objects: [
            {
              id: "obj_1",
              monitorType: "oracle",
              provider: "Chainlink",
              chain: "base",
              asset: "ETH",
              status: "active",
              tags: ["priority"],
              purpose: "lending",
            },
            {
              id: "obj_2",
              monitorType: "bridge",
              provider: "LayerZero",
              chain: "base",
              status: "degraded",
              tags: [],
            },
          ],
        }),
      }),
    );

    const result = await fetchSceCatalog();

    expect(result.filters.providers.sort()).toEqual(["Chainlink", "LayerZero"]);
    expect(result.filters.chains).toEqual(["base"]);
    expect(result.filters.statuses.sort()).toEqual(["active", "degraded"]);
  });

  it("parses SCE's real grouped response shape (oracle/bridge/lp arrays) and non-empty filters", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          updatedAt: "2026-07-03T00:00:00Z",
          oracle: [
            {
              objectId: "oracle-feed:chainlink:base:usdc-usd",
              monitorType: "oracle",
              provider: "chainlink",
              providerDisplayName: "Chainlink",
              chain: "Base",
              chainDisplayName: "Base",
              asset: "USDC",
              assetPair: "USDC/USD",
              displayName: "Chainlink USDC/USD (Base)",
              status: "active",
              canAlert: true,
              canBroadcast: true,
              canWatch: true,
              commercialValueTier: "very_high",
              purpose: "sagitta_dependency",
              tags: ["sagitta_dependency", "stablecoin"],
            },
          ],
          bridge: [
            {
              objectId: "cctp:USDC:Base->Ethereum",
              monitorType: "bridge",
              provider: "cctp",
              providerDisplayName: "CCTP",
              chain: "Base",
              chainDisplayName: "Base",
              asset: "USDC",
              route: "Base->Ethereum",
              routeDisplayName: "Base -> Ethereum",
              displayName: "CCTP USDC Base -> Ethereum",
              status: "active",
              canAlert: true,
              canBroadcast: false,
              canWatch: true,
              commercialValueTier: "very_high",
              purpose: "sagitta_dependency",
              tags: ["sagitta_dependency"],
            },
          ],
          lp: [
            {
              objectId: "lp:uniswap_v3:eth-usdc:base",
              monitorType: "lp",
              provider: "uniswap_v3",
              providerDisplayName: "Uniswap v3",
              chain: "Base",
              chainDisplayName: "Base",
              asset: "WETH",
              assetPair: "ETH/USDC",
              poolName: "Uniswap v3 ETH/USDC (Base 0.05%)",
              displayName: "Uniswap v3 ETH/USDC (Base 0.05%)",
              status: "disabled",
              canAlert: true,
              canBroadcast: false,
              canWatch: true,
              commercialValueTier: "very_high",
              purpose: "commercial_priority",
              tags: ["commercial_priority"],
            },
          ],
          providers: [],
          chains: [],
        }),
      }),
    );

    const result = await fetchSceCatalog();

    expect(result.objects).toHaveLength(3);
    expect(result.filters.providers.sort()).toEqual(["CCTP", "Chainlink", "Uniswap v3"]);
    expect(result.filters.chains).toEqual(["Base"]);
    expect(result.filters.assets.sort()).toEqual(["USDC", "WETH"]);
  });

  it("preserves oracle, bridge, and lp objects from the grouped response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          oracle: [{ objectId: "o1", monitorType: "oracle", displayName: "Oracle 1" }],
          bridge: [
            { objectId: "b1", monitorType: "bridge", displayName: "Bridge 1" },
            { objectId: "b2", monitorType: "bridge", displayName: "Bridge 2" },
          ],
          lp: [{ objectId: "l1", monitorType: "lp", displayName: "LP 1" }],
        }),
      }),
    );

    const result = await fetchSceCatalog();

    expect(result.objects.filter((o) => o.monitorType === "oracle")).toHaveLength(1);
    expect(result.objects.filter((o) => o.monitorType === "bridge")).toHaveLength(2);
    expect(result.objects.filter((o) => o.monitorType === "lp")).toHaveLength(1);
  });

  it("prefers providerDisplayName/chainDisplayName/commercialValueTier over raw machine keys", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          oracle: [
            {
              objectId: "o1",
              monitorType: "oracle",
              provider: "chainlink",
              providerDisplayName: "Chainlink",
              chain: "base",
              chainDisplayName: "Base",
              commercialValueTier: "high",
            },
          ],
        }),
      }),
    );

    const result = await fetchSceCatalog();

    expect(result.objects[0].provider).toBe("Chainlink");
    expect(result.objects[0].chain).toBe("Base");
    expect(result.objects[0].commercialValue).toBe("high");
  });

  it("throws SceCatalogError with a clear message when SCE is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    await expect(fetchSceCatalog()).rejects.toBeInstanceOf(SceCatalogError);
  });

  it("throws when SCE_ADMIN_API_KEY is not configured", async () => {
    delete process.env.SCE_ADMIN_API_KEY;
    await expect(fetchSceCatalog()).rejects.toBeInstanceOf(SceCatalogError);
  });
});
