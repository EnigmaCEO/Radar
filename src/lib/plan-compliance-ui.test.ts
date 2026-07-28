import { describe, expect, it } from "vitest";
import {
  getEffectiveStatusClassName,
  getEffectiveStatusLabel,
  isPlanPausedStatus,
} from "./plan-compliance-ui";

describe("plan compliance UI helpers", () => {
  it("labels effective entitlement states", () => {
    expect(getEffectiveStatusLabel("active")).toBe("Active");
    expect(getEffectiveStatusLabel("paused_over_limit")).toBe("Paused - plan limit");
    expect(getEffectiveStatusLabel("paused_plan_required")).toBe("Paused - plan required");
    expect(getEffectiveStatusLabel("needs_selection")).toBe("Needs selection");
    expect(getEffectiveStatusLabel("inactive")).toBe("Inactive");
  });

  it("marks only plan-paused states as plan paused", () => {
    expect(isPlanPausedStatus("active")).toBe(false);
    expect(isPlanPausedStatus("paused_over_limit")).toBe(true);
    expect(isPlanPausedStatus("paused_plan_required")).toBe(true);
    expect(isPlanPausedStatus("needs_selection")).toBe(true);
    expect(isPlanPausedStatus("inactive")).toBe(false);
  });

  it("returns class names for every status", () => {
    expect(getEffectiveStatusClassName("active")).toContain("green");
    expect(getEffectiveStatusClassName("paused_plan_required")).toContain("violet");
    expect(getEffectiveStatusClassName("inactive")).toContain("slate");
  });
});
