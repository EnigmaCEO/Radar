import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  PROVIDER_RELIABILITY_DEGRADED_LABEL,
  ProviderReliabilityView,
} from "./page";

describe("provider reliability page", () => {
  it("uses degraded-history wording and renders condition labels with numeric observability", () => {
    const html = renderToStaticMarkup(
      React.createElement(ProviderReliabilityView, {
        loading: false,
        planLabel: "Intel",
        rows: [
          {
            provider: "across",
            currentCondition: "No active issues",
            patternLabel: "Insufficient evidence",
            observabilityScore: 12,
            confidence: "low",
            findingsEvaluated: 1,
            verifiedFindings: 1,
            approvedFindings: 0,
            resolvedFindings: 1,
            observationCount: 3,
            successfulObservations: 1,
            failedObservations: 2,
            scoringWindowLabel: "30d history window",
            totalAlerts: 3,
            activeIncidents: 0,
            criticalFindings: 0,
            coverageIncidents: 2,
            excludedRecords: 2,
            medianDurationHours: 0.3,
            longestDurationHours: 0.3,
            recoveryRate: 100,
            recurrenceCount: 0,
            recurrenceRate: 0,
            totalBurden: 0.8,
            durationBurden: 0.1,
            recurrenceBurden: 0,
            dominantMonitorType: "bridge",
            latestEventAt: null,
            conditionFactors: [],
            observabilityFactors: [
              { label: "Coverage incidents", count: 2, impact: 2 },
              { label: "Successful observations", count: 1, impact: 0 },
              { label: "Observation volume", count: 3, impact: 0, detail: "30d history window" },
            ],
          },
          {
            provider: "chainlink",
            currentCondition: "Critical",
            patternLabel: "Persistent",
            observabilityScore: 99,
            confidence: "medium",
            findingsEvaluated: 4,
            verifiedFindings: 4,
            approvedFindings: 0,
            resolvedFindings: 3,
            observationCount: 6,
            successfulObservations: 6,
            failedObservations: 0,
            scoringWindowLabel: "30d history window",
            totalAlerts: 6,
            activeIncidents: 1,
            criticalFindings: 1,
            coverageIncidents: 0,
            excludedRecords: 2,
            medianDurationHours: 1.5,
            longestDurationHours: 48,
            recoveryRate: 75,
            recurrenceCount: 1,
            recurrenceRate: 25,
            totalBurden: 3.5,
            durationBurden: 0.9,
            recurrenceBurden: 0.4,
            dominantMonitorType: "oracle",
            latestEventAt: null,
            conditionFactors: [{ label: "Oracle freshness", count: 4, impact: 0 }],
            observabilityFactors: [
              { label: "Successful observations", count: 6, impact: 0 },
              { label: "Observation volume", count: 6, impact: 0, detail: "30d history window" },
            ],
          },
        ],
      }),
    );

    expect(PROVIDER_RELIABILITY_DEGRADED_LABEL).toBe(
      "Providers with degraded condition history",
    );
    expect(html).toContain("Insufficient evidence");
    expect(html).toContain("Observability: 12%");
    expect(html).toContain("Confidence");
    expect(html).toContain(">low<");
    expect(html).toContain("Providers with degraded condition history");
    expect(html).toContain("Across Protocol");
    expect(html).toContain("/providers/across.svg");
    expect(html).toContain("1 of 2");
    expect(html).toContain("Current condition: Critical");
    expect(html).toContain("30-day pattern: Persistent");
    expect(html).toContain("Clean 30-day pattern");
    expect(html).toContain("Evidence details");
    expect(html).not.toContain("total burden");
    expect(html).not.toContain("duration burden");
    expect(html).not.toContain("recurrence burden");
    expect(html).not.toContain("Score details");
  });
});
