import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}));

import {
  fetchMonitoredValueUsd,
  formatUsd,
  getMonitoredValueUsd,
  monitoredValueFromGms,
} from "./radar-stats";

const ORIGINAL_ENV = { ...process.env };

describe("fetchMonitoredValueUsd", () => {
  beforeEach(() => {
    process.env = {
      ...ORIGINAL_ENV,
      NEXT_PUBLIC_API_URL: "http://127.0.0.1:8000",
      SCE_ADMIN_API_KEY: "localhost",
    };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.unstubAllGlobals();
  });

  it("uses the SCE admin header and returns grossMonitoredSurfaceUsd when positive", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ grossMonitoredSurfaceUsd: 123_000_000 }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchMonitoredValueUsd()).resolves.toBe(123_000_000);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/v1/sce/radar/gms"),
      expect.objectContaining({ headers: { "X-SCE-Admin-Key": "localhost" } }),
    );
  });

  it("throws rather than inventing a value when the surface amount is zero", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ grossMonitoredSurfaceUsd: 0, monitoredValueUsd: 0 }),
      }),
    );

    await expect(fetchMonitoredValueUsd()).rejects.toThrow(/no monitored value/);
  });

  it("throws on a failed response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    await expect(fetchMonitoredValueUsd()).rejects.toThrow(/503/);
  });

  it("throws without an admin key", async () => {
    delete process.env.SCE_ADMIN_API_KEY;
    await expect(fetchMonitoredValueUsd()).rejects.toThrow(/SCE_ADMIN_API_KEY/);
  });
});

describe("monitoredValueFromGms", () => {
  it("sums oracle TVS and LP TVL, leaving bridge volume out as SCE does", () => {
    expect(
      monitoredValueFromGms({
        oracleTvsUsd: 100_000_000,
        bridgeVolume24hUsd: 25_000_000,
        lpTvlUsd: 5_000_000,
      } as never),
    ).toBe(105_000_000);
  });

  it("returns null when nothing is positive", () => {
    expect(monitoredValueFromGms({ oracleTvsUsd: 0, lpTvlUsd: null } as never)).toBeNull();
  });
});

describe("getMonitoredValueUsd", () => {
  it("returns the reading when one succeeds", async () => {
    await expect(getMonitoredValueUsd(async () => 328_393_000_000)).resolves.toBe(328_393_000_000);
  });

  it("returns null instead of a made-up figure when no reading exists", async () => {
    await expect(
      getMonitoredValueUsd(async () => {
        throw new Error("down");
      }),
    ).resolves.toBeNull();
  });
});

describe("formatUsd", () => {
  it("formats billion-scale values compactly", () => {
    expect(formatUsd(328_393_000_000)).toBe("$328.4B");
  });

  it("formats million-scale values compactly", () => {
    expect(formatUsd(950_000_000)).toBe("$950M");
  });
});
