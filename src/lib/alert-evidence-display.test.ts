import { describe, expect, it } from "vitest";
import { extractAlertEvidenceDetails } from "./alert-evidence-display";

describe("alert evidence display helpers", () => {
  it("extracts heartbeat doctrine metadata from evidence explanation text", () => {
    expect(
      extractAlertEvidenceDetails(
        "Observed evidence: feed age 3h 34m at 2026-07-13T17:58:59.350922Z. Threshold metadata comes from verified official feed metadata: expected heartbeat 1h, warning threshold 1h 15m, and critical threshold 2h. Evidence state: inferred. Public verification: internal_finding.",
      ),
    ).toEqual({
      thresholdSourceLabel: "verified official feed metadata",
      expectedHeartbeat: "1h",
      warningThreshold: "1h 15m",
      criticalThreshold: "2h",
      evidenceState: "inferred",
      publicVerificationState: "internal_finding",
    });
  });

  it("returns empty details when no explanation is present", () => {
    expect(extractAlertEvidenceDetails(null)).toEqual({
      thresholdSourceLabel: null,
      expectedHeartbeat: null,
      warningThreshold: null,
      criticalThreshold: null,
      evidenceState: null,
      publicVerificationState: null,
    });
  });
});
