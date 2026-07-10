import { describe, expect, it } from "vitest";
import {
  coverageGapBadgeLabel,
  getCoverageGapTier,
  isCoverageGapAlert,
} from "./alert-classification";

describe("alert-classification", () => {
  it("treats explicit coverage signalClass as a coverage gap", () => {
    expect(
      isCoverageGapAlert({
        signalClass: "coverage",
        reasonCode: "BRIDGE_ROUTE_CHECK_ERROR",
        summary: "Across route status source unavailable.",
        createdAt: "2026-07-10T05:05:00.000Z",
      }),
    ).toBe(true);
  });

  it("falls back to READ_ERROR and summary cues when signalClass is absent", () => {
    expect(
      isCoverageGapAlert({
        reasonCode: "LP_POOL_READ_ERROR",
        summary: "Pool source unavailable.",
        createdAt: "2026-07-10T05:05:00.000Z",
      }),
    ).toBe(true);
  });

  it("maps coverage gap age into the duration ladder", () => {
    const now = new Date("2026-07-10T11:05:00.000Z");

    expect(
      getCoverageGapTier(
        {
          reasonCode: "BRIDGE_ROUTE_CHECK_ERROR",
          summary: "Across route status source unavailable.",
          createdAt: "2026-07-10T10:05:00.000Z",
        },
        now,
      ),
    ).toBe("unresolved");

    expect(
      getCoverageGapTier(
        {
          reasonCode: "BRIDGE_ROUTE_CHECK_ERROR",
          summary: "Across route status source unavailable.",
          createdAt: "2026-07-10T07:05:00.000Z",
        },
        now,
      ),
    ).toBe("coverage_warning");

    expect(
      getCoverageGapTier(
        {
          reasonCode: "BRIDGE_ROUTE_CHECK_ERROR",
          summary: "Across route status source unavailable.",
          createdAt: "2026-07-10T04:05:00.000Z",
        },
        now,
      ),
    ).toBe("coverage_critical");
  });

  it("prefers an explicit SCE coverage tier when present", () => {
    expect(
      getCoverageGapTier(
        {
          reasonCode: "BRIDGE_ROUTE_CHECK_ERROR",
          summary: "Across route status source unavailable.",
          createdAt: "2026-07-10T10:05:00.000Z",
          coverageTier: "coverage_critical",
        },
        new Date("2026-07-10T11:05:00.000Z"),
      ),
    ).toBe("coverage_critical");
  });

  it("formats the coverage ladder labels", () => {
    expect(coverageGapBadgeLabel("unresolved")).toBe("unresolved");
    expect(coverageGapBadgeLabel("coverage_warning")).toBe("coverage warning");
    expect(coverageGapBadgeLabel("coverage_critical")).toBe("coverage critical");
  });
});
