import { describe, expect, it } from "vitest";
import type { SceAlert } from "./sce-alerts";
import { buildSituationalBriefing, buildSituationalBriefingTelegramText } from "./situational-briefing";

function makeAlert(overrides: Partial<SceAlert> = {}): SceAlert {
  return {
    id: "RADAR-1",
    monitorType: "oracle",
    provider: "Chainlink",
    chain: "Ethereum",
    asset: "USDC",
    assetPair: "USDC/USD",
    route: null,
    poolName: null,
    objectId: "oracle-feed:1",
    objectType: "oracle_feed",
    purpose: "sagitta_dependency",
    severity: "warning",
    status: "active",
    reasonCode: "ORACLE_STALE",
    summary: "Chainlink USDC/USD on Ethereum is stale beyond expected heartbeat.",
    publicSummary: null,
    signalClass: "coverage",
    evidenceSummary: "Heartbeat delay remains elevated.",
    tags: [],
    severityExplanation: "Warning: the price feed has not refreshed on schedule and may be stale.",
    thresholdExplanation: "Threshold crossed after 300 seconds.",
    humanRiskSummary: "Dependent systems may keep reading older values until updates resume.",
    whatHappened: "Several monitored Chainlink feeds have not refreshed on schedule.",
    whyItMatters: "Dependent systems can continue reading older values until updates resume.",
    radarStatus: "Monitoring feed freshness and resolution state.",
    nextWatch: "Watch for new on-chain oracle updates.",
    evidenceExplanation: "Observed heartbeat delay remains above threshold.",
    thresholdName: "warning_after_seconds",
    observedValueLabel: "420s",
    thresholdValueLabel: "300s",
    createdAt: "2026-07-03T11:00:00Z",
    updatedAt: "2026-07-03T11:50:00Z",
    ...overrides,
  };
}

describe("buildSituationalBriefing", () => {
  it("groups oracle stale alerts into one Chainlink freshness cluster with severity buckets", () => {
    const briefing = buildSituationalBriefing([
      makeAlert({ id: "a1", asset: "USDC", assetPair: "USDC/USD", severity: "critical" }),
      makeAlert({ id: "a2", asset: "USDe", assetPair: "USDe/USD", severity: "critical" }),
      makeAlert({ id: "a3", asset: "rETH", assetPair: "rETH/ETH", severity: "warning" }),
    ]);

    expect(briefing.groupCount).toBe(1);
    expect(briefing.groups[0]).toMatchObject({
      title: "Oracle Freshness Cluster - Chainlink",
      affectedCount: 3,
    });
    expect(briefing.groups[0].severityBuckets.map((bucket) => bucket.severity)).toEqual([
      "critical",
      "warning",
    ]);
    expect(briefing.groups[0].severityBuckets[0].affectedObjects.map((object) => object.label)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("USDC/USD"),
        expect.stringContaining("USDe/USD"),
      ]),
    );
    expect(briefing.groups[0].severityBuckets[1].affectedObjects[0].label).toContain("rETH/ETH");
  });

  it("uses deterministic fallback text without introducing unsupported words", () => {
    const briefing = buildSituationalBriefing([
      makeAlert({
        reasonCode: "LP_POOL_IMBALANCE",
        monitorType: "lp",
        provider: "Curve",
        asset: "3pool",
        assetPair: null,
        severity: "warning",
        severityExplanation: null,
        thresholdExplanation: null,
        humanRiskSummary: null,
        whatHappened: null,
        whyItMatters: null,
        radarStatus: null,
        nextWatch: null,
        evidenceExplanation: null,
        evidenceSummary: null,
      }),
    ]);

    expect(briefing.groups[0].severityMeaning).toBe(
      "Warning: the pool crossed Radar's balance-concentration watch threshold.",
    );
    expect(JSON.stringify(briefing)).not.toMatch(
      /\b(hacked|exploit|attack|manipulated|unsafe|depeg|insolvent|broken)\b/i,
    );
  });

  it("polishes lowercase provider labels and compresses evidence notes", () => {
    const briefing = buildSituationalBriefing([
      makeAlert({
        provider: "chainlink",
        thresholdName: "critical freshness threshold",
        observedValueLabel: "Observed feed age: 18h 36m",
        thresholdValueLabel: "Threshold: 12h",
      }),
      makeAlert({
        id: "a2",
        provider: "chainlink",
        asset: "USDe",
        assetPair: "USDe/USD",
        thresholdName: "critical freshness threshold",
        observedValueLabel: "Observed feed age: 18h 47m",
        thresholdValueLabel: "Threshold: 12h",
        evidenceExplanation: "Observed heartbeat delay remains above threshold.",
      }),
    ]);

    expect(briefing.groups[0].title).toBe("Oracle Freshness Cluster - Chainlink");
    expect(briefing.groups[0].evidenceNotes.length).toBeLessThanOrEqual(4);
    expect(briefing.groups[0].affectedObjects[0].label).toContain("18h");
    expect(briefing.groups[0].affectedObjects[0].label).not.toContain("Observed ");
    expect(briefing.groups[0].affectedObjects[0].label).not.toContain("Threshold:");
  });

  it("renders Telegram as an operational summary with explicit breached thresholds", () => {
    const text = buildSituationalBriefingTelegramText([
      makeAlert({
        id: "critical-alert",
        severity: "critical",
        thresholdName: "critical freshness threshold",
        observedValueLabel: "Observed feed age: 13h 42m",
        thresholdValueLabel: "Threshold: 12h",
      }),
      makeAlert({
        id: "warning-alert",
        asset: "cbETH",
        assetPair: "cbETH/ETH",
        chain: "Base",
        thresholdName: "warning freshness threshold",
        observedValueLabel: "Observed feed age: 18h 52m",
        thresholdValueLabel: "Threshold: 12h",
      }),
    ]);

    expect(text).toContain("Impact:");
    expect(text).toContain("Critical (1)");
    expect(text).toContain("Warning (1)");
    expect(text).toContain("USDC/USD | Ethereum | feed age 13h 42m | breached critical freshness threshold 12h");
    expect(text).toContain("cbETH/ETH | Base | feed age 18h 52m | breached warning freshness threshold 12h");
    expect(text).not.toContain("What this means:");
    expect(text).not.toContain("Severity meaning:");
    expect(text).not.toContain("Evidence notes:");
  });

  it("skips the top-level Telegram situation summary and footer next-watch recap", () => {
    const text = buildSituationalBriefingTelegramText([makeAlert()]);

    expect(text).not.toContain("\nSituation:\n");
    expect(text).not.toContain("\nNext watch:\n");
    expect(text).toContain("Oracle Freshness Cluster - Chainlink");
    expect(text).toContain("Impact:");
    expect(text).toContain("Status:");
    expect(text).toContain("Next:");
  });
});
