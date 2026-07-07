import { describe, expect, it } from "vitest";
import {
  formatManualDeliveryReason,
  getManualDeliveryIssueLabel,
  getManualDeliveryIssueTone,
} from "./manual-delivery-copy";

describe("manual delivery copy", () => {
  it("maps internal skip reasons to user-facing copy", () => {
    expect(formatManualDeliveryReason("below_destination_min_severity")).toBe(
      "No alerts met this destination's minimum severity.",
    );
  });

  it("preserves freeform transport errors", () => {
    expect(formatManualDeliveryReason("Webhook endpoint returned 500")).toBe(
      "Webhook endpoint returned 500",
    );
  });

  it("humanizes unknown internal reason codes", () => {
    expect(formatManualDeliveryReason("custom_internal_reason")).toBe(
      "Custom internal reason.",
    );
  });

  it("uses note copy for skipped results", () => {
    expect(getManualDeliveryIssueLabel("skipped")).toBe("Latest note");
    expect(getManualDeliveryIssueTone("skipped")).toBe("muted");
  });

  it("uses blocker copy for blocked results", () => {
    expect(getManualDeliveryIssueLabel("blocked")).toBe("Latest blocker");
    expect(getManualDeliveryIssueTone("blocked")).toBe("warning");
  });

  it("uses error copy for failed results", () => {
    expect(getManualDeliveryIssueLabel("failed")).toBe("Latest error");
    expect(getManualDeliveryIssueTone("failed")).toBe("error");
  });
});
