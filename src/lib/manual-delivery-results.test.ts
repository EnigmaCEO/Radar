import { describe, expect, it } from "vitest";
import {
  deriveExcludedEventsForDisplay,
  deriveMatchedAlertsForDisplay,
} from "./manual-delivery-results";

describe("manual-delivery-results", () => {
  it("prefers explicit matchedAlerts and excludedEvents when present", () => {
    const result = {
      matchedAlerts: [
        {
          alertId: "matched-1",
          severity: "warning",
          monitorType: "oracle",
          title: "Matched alert",
          matchedWatchlistIds: ["wl_1"],
          matchedWatchlistNames: ["All"],
        },
      ],
      excludedEvents: [
        {
          alertId: "excluded-1",
          eventId: "evt-1",
          eventType: "alert_resolved",
          status: "resolved",
          severity: "warning",
          monitorType: "oracle",
          title: "Resolved alert",
          skippedReasons: ["resolved_status_not_requested"],
        },
      ],
      alertResults: [
        {
          alertId: "debug-only",
          severity: "critical",
          monitorType: "bridge",
          title: "Debug alert",
          matchedWatchlistIds: [],
          matchedWatchlistNames: [],
          skippedReasons: ["no_active_watchlist_matched"],
        },
      ],
    };

    expect(deriveMatchedAlertsForDisplay(result)).toHaveLength(1);
    expect(deriveMatchedAlertsForDisplay(result)[0].alertId).toBe("matched-1");
    expect(deriveExcludedEventsForDisplay(result)).toHaveLength(1);
    expect(deriveExcludedEventsForDisplay(result)[0].alertId).toBe("excluded-1");
  });

  it("derives matched alerts and excluded events from alertResults for backward compatibility", () => {
    const result = {
      alertResults: [
        {
          alertId: "matched-1",
          eventId: "evt-1",
          eventType: "alert_updated",
          status: "active",
          severity: "warning",
          monitorType: "oracle",
          title: "Matched alert",
          matchedWatchlistIds: ["wl_1"],
          matchedWatchlistNames: ["All"],
          skippedReasons: [],
        },
        {
          alertId: "excluded-1",
          eventId: "evt-2",
          eventType: "alert_resolved",
          status: "resolved",
          severity: "warning",
          monitorType: "oracle",
          title: "Resolved alert",
          matchedWatchlistIds: [],
          matchedWatchlistNames: [],
          skippedReasons: ["resolved_status_not_requested"],
        },
      ],
    };

    expect(deriveMatchedAlertsForDisplay(result)).toEqual([
      expect.objectContaining({ alertId: "matched-1" }),
    ]);
    expect(deriveExcludedEventsForDisplay(result)).toEqual([
      expect.objectContaining({
        alertId: "excluded-1",
        eventType: "alert_resolved",
        skippedReasons: ["resolved_status_not_requested"],
      }),
    ]);
  });
});
