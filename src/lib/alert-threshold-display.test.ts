import { describe, expect, it } from "vitest";
import {
  cleanThresholdValueLabel,
  formatThresholdValueWithRule,
  humanizeThresholdRule,
} from "./alert-threshold-display";

describe("alert threshold display helpers", () => {
  it("removes the generic threshold prefix from values", () => {
    expect(cleanThresholdValueLabel("Threshold: 2h")).toBe("2h");
  });

  it("formats heartbeat escalation rules explicitly for alert cards", () => {
    expect(
      formatThresholdValueWithRule({
        thresholdName: "post-heartbeat critical escalation threshold",
        thresholdValueLabel: "Threshold: 2h",
      }),
    ).toBe("Critical escalation threshold: 2h");
  });

  it("preserves domain-specific threshold names outside heartbeat alerts", () => {
    expect(humanizeThresholdRule("warning pool imbalance threshold")).toBe(
      "Warning Pool Imbalance Threshold",
    );
  });

  it("falls back to the applied threshold kind when the threshold name is absent", () => {
    expect(
      formatThresholdValueWithRule({
        thresholdValueLabel: "Threshold: 1h 15m",
        appliedThresholdKind: "warning_after_seconds",
      }),
    ).toBe("Warning threshold: 1h 15m");
  });
});
