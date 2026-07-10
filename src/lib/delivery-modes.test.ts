import { describe, expect, it } from "vitest";
import {
  DEFAULT_DELIVERY_MODE,
  DELIVERY_MODE_HELPER_TEXT,
  DELIVERY_MODE_LABEL,
  isDeliveryMode,
  normalizeDeliveryMode,
} from "./delivery-modes";

describe("delivery-modes", () => {
  it("defaults invalid input to alert_fanout", () => {
    expect(normalizeDeliveryMode(undefined)).toBe(DEFAULT_DELIVERY_MODE);
    expect(normalizeDeliveryMode("nope")).toBe(DEFAULT_DELIVERY_MODE);
  });

  it("recognizes supported delivery modes", () => {
    expect(isDeliveryMode("alert_fanout")).toBe(true);
    expect(isDeliveryMode("public_thread")).toBe(true);
    expect(isDeliveryMode("digest")).toBe(true);
    expect(isDeliveryMode("announcement_feed")).toBe(true);
    expect(isDeliveryMode("other")).toBe(false);
  });

  it("provides stable labels and helper text for UI display", () => {
    expect(DELIVERY_MODE_LABEL.public_thread).toBe("Public thread");
    expect(DELIVERY_MODE_LABEL.announcement_feed).toBe("Announcement feed");
    expect(DELIVERY_MODE_HELPER_TEXT.digest).toContain("situational briefing");
    expect(DELIVERY_MODE_HELPER_TEXT.alert_fanout).toContain("not public community feeds");
    expect(DELIVERY_MODE_HELPER_TEXT.public_thread).toContain("public or community channels");
    expect(DELIVERY_MODE_HELPER_TEXT.announcement_feed).toContain("tracked and shared independently");
  });
});
