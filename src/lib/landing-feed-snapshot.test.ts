import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock("./sce-alerts", () => ({ fetchSceAlertCollection: vi.fn() }));

import { alertDataError, type AlertCollectionResult } from "./alert-data-state";
import {
  LANDING_SNAPSHOT_FRESH_SECONDS,
  UnconfirmedLandingReadError,
  confirmedLandingRead,
  labelSnapshotAge,
  readLandingSnapshot,
} from "./landing-feed-snapshot";
import type { SceAlert } from "./sce-alerts";

const CONFIRMED_AT = "2026-11-15T12:00:00.000Z";
const alert = { id: "a1" } as unknown as SceAlert;

function available(): AlertCollectionResult<SceAlert> {
  return {
    state: "available",
    alerts: [alert],
    source: "sce",
    fetchedAt: CONFIRMED_AT,
    lastSuccessfulAt: CONFIRMED_AT,
  };
}

function unavailable(): AlertCollectionResult<SceAlert> {
  return {
    state: "unavailable",
    alerts: [],
    source: "sce",
    fetchedAt: CONFIRMED_AT,
    error: alertDataError("UPSTREAM_TIMEOUT"),
  };
}

const at = (secondsAfter: number) => new Date(Date.parse(CONFIRMED_AT) + secondsAfter * 1000);

describe("confirmedLandingRead", () => {
  it("passes confirmed reads through so they can be cached", async () => {
    await expect(confirmedLandingRead(async () => available())).resolves.toMatchObject({
      state: "available",
    });
  });

  it("throws on failed or degraded reads so they never replace the snapshot", async () => {
    await expect(confirmedLandingRead(async () => unavailable())).rejects.toBeInstanceOf(
      UnconfirmedLandingReadError,
    );
    await expect(
      confirmedLandingRead(async () => ({ ...available(), state: "degraded" })),
    ).rejects.toBeInstanceOf(UnconfirmedLandingReadError);
  });
});

describe("labelSnapshotAge", () => {
  it("leaves a fresh snapshot as available", () => {
    expect(labelSnapshotAge(available(), at(LANDING_SNAPSHOT_FRESH_SECONDS))).toEqual(available());
  });

  it("relabels an older snapshot as degraded with its age", () => {
    const result = labelSnapshotAge(available(), at(3600));
    expect(result).toMatchObject({
      state: "degraded",
      source: "cache",
      stale: true,
      cacheAgeSeconds: 3600,
      lastSuccessfulAt: CONFIRMED_AT,
      alerts: [alert],
    });
  });
});

describe("readLandingSnapshot", () => {
  it("serves the stored snapshot, labelled by age", async () => {
    const result = await readLandingSnapshot(async () => available(), () => at(600));
    expect(result.state).toBe("degraded");
    expect(result.alerts).toEqual([alert]);
  });

  it("returns the live failure state when no snapshot exists yet", async () => {
    const result = await readLandingSnapshot(async () => {
      throw new UnconfirmedLandingReadError(unavailable());
    });
    expect(result).toEqual(unavailable());
  });

  it("falls back to unavailable if the cache itself fails", async () => {
    const result = await readLandingSnapshot(async () => {
      throw new Error("cache backend down");
    }, () => at(0));
    expect(result.state).toBe("unavailable");
    expect(result.alerts).toEqual([]);
  });
});
