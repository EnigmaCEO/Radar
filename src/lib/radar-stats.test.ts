import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearMonitoredValueUsdCache, formatUsd, getMonitoredValueUsd } from "./radar-stats";

const ORIGINAL_ENV = { ...process.env };

describe("getMonitoredValueUsd", () => {
  beforeEach(() => {
    process.env = {
      ...ORIGINAL_ENV,
      NEXT_PUBLIC_API_URL: "http://127.0.0.1:8000",
      SCE_ADMIN_API_KEY: "localhost",
    };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    clearMonitoredValueUsdCache();
    vi.unstubAllGlobals();
  });

  it("uses the SCE admin header and returns grossMonitoredSurfaceUsd when positive", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ grossMonitoredSurfaceUsd: 123_000_000 }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const value = await getMonitoredValueUsd();

    expect(value).toBe(123_000_000);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/v1/sce/radar/gms"),
      expect.objectContaining({
        headers: { "X-SCE-Admin-Key": "localhost" },
      }),
    );
  });

  it("falls back when the response surface amount is zero", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ grossMonitoredSurfaceUsd: 0, monitoredValueUsd: 0 }),
      }),
    );

    const value = await getMonitoredValueUsd();

    expect(value).toBe(3_000_000_000);
  });

  it("sums component fields when no direct amount is present", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          oracleTvsUsd: 100_000_000,
          bridgeVolume24hUsd: 25_000_000,
          lpTvlUsd: null,
        }),
      }),
    );

    const value = await getMonitoredValueUsd();

    expect(value).toBe(125_000_000);
  });

  it("caches the fetched value for subsequent calls", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ grossMonitoredSurfaceUsd: 456_000_000 }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const first = await getMonitoredValueUsd();
    const second = await getMonitoredValueUsd();

    expect(first).toBe(456_000_000);
    expect(second).toBe(456_000_000);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});

describe("formatUsd", () => {
  it("formats million-scale values compactly", () => {
    expect(formatUsd(3_000_000_000)).toBe("$3,000M");
  });
});
