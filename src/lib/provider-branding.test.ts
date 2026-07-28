import { describe, expect, it } from "vitest";
import { getProviderBrand } from "./provider-branding";

describe("provider-branding", () => {
  it("maps common provider keys to formal names and local icons", () => {
    expect(getProviderBrand("aerodome")).toMatchObject({
      key: "aerodrome",
      displayName: "Aerodrome Finance",
      iconSrc: "/providers/aerodrome.svg",
      monogram: "AF",
    });
    expect(getProviderBrand("chainlink")).toMatchObject({
      key: "chainlink",
      displayName: "Chainlink",
      iconSrc: "/providers/chainlink.png",
      monogram: "CH",
    });
    expect(getProviderBrand("pyth")).toMatchObject({
      key: "pyth",
      displayName: "Pyth Network",
      iconSrc: "/providers/pyth.png",
      monogram: "PN",
    });
    expect(getProviderBrand("across")).toMatchObject({
      key: "across",
      displayName: "Across Protocol",
      iconSrc: "/providers/across.svg",
      monogram: "AP",
    });
    expect(getProviderBrand("circle cctp")).toMatchObject({
      key: "circle",
      displayName: "Circle CCTP",
      iconSrc: "/providers/circle.svg",
      monogram: "CC",
    });
    expect(getProviderBrand("uniswap v3")).toMatchObject({
      key: "uniswap",
      displayName: "Uniswap",
      iconSrc: "/providers/uniswap.png",
      monogram: "UN",
    });
  });

  it("falls back to title case and a monogram for unknown providers", () => {
    expect(getProviderBrand("super_feed")).toMatchObject({
      key: "super feed",
      displayName: "Super Feed",
      iconSrc: null,
      monogram: "SF",
    });
  });
});
