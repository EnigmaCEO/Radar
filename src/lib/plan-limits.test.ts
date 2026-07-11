import { describe, expect, it } from "vitest";
import {
  canConfigurePrivateDestinations,
  canRunManualDelivery,
  getAllowedDeliveryModes,
  getAllowedDestinationChannels,
  getDestinationLimit,
  getPlanLabel,
  getPrivateHistoryDays,
  getPrivateObjectLimit,
  getWatchlistLimit,
  resolvePlan,
} from "./plan-limits";

describe("plan-limits", () => {
  it("treats the legacy free plan as Public Record access, not a private monitoring tier", () => {
    expect(resolvePlan("free")).toBe("public_record");
    expect(getPlanLabel("free")).toBe("Public Record");
    expect(getWatchlistLimit("free")).toBe(0);
    expect(canConfigurePrivateDestinations("free")).toBe(false);
  });

  it("maps the legacy tier slugs to Intel, Signal, and Desk", () => {
    expect(resolvePlan("radar_live")).toBe("radar_intel");
    expect(resolvePlan("radar_pro")).toBe("radar_signal");
    expect(resolvePlan("radar")).toBe("radar_signal");
    expect(resolvePlan("managed")).toBe("desk");
    expect(getPlanLabel("radar_signal")).toBe("Signal");
    expect(getPlanLabel("radar_intel")).toBe("Intel");
  });

  it("enforces the new private object limits", () => {
    expect(getPrivateObjectLimit("watch")).toBe(5);
    expect(getPrivateObjectLimit("radar_signal")).toBe(25);
    expect(getPrivateObjectLimit("radar_intel")).toBe(0);
    expect(getPrivateObjectLimit("desk")).toBe(Infinity);
  });

  it("enforces channel and delivery-mode access by plan", () => {
    expect(getAllowedDestinationChannels("watch")).toEqual(["discord_webhook", "telegram_bot"]);
    expect(getAllowedDestinationChannels("radar_signal")).toEqual([
      "discord_webhook",
      "telegram_bot",
      "webhook",
    ]);
    expect(getAllowedDestinationChannels("radar_intel")).toEqual([]);
    expect(getAllowedDeliveryModes("watch")).toEqual(["digest"]);
    expect(getAllowedDeliveryModes("desk")).toContain("public_thread");
  });

  it("caps delivery destinations per plan", () => {
    expect(getDestinationLimit("watch")).toBe(1);
    expect(getDestinationLimit("radar_signal")).toBe(Infinity);
    expect(getDestinationLimit("desk")).toBe(Infinity);
    expect(getDestinationLimit("radar_intel")).toBe(0);
  });

  it("only allows manual delivery on Signal, Desk, and internal plans", () => {
    expect(canRunManualDelivery("watch")).toBe(false);
    expect(canRunManualDelivery("radar_signal")).toBe(true);
    expect(canRunManualDelivery("radar_intel")).toBe(false);
    expect(canRunManualDelivery("internal")).toBe(true);
  });

  it("returns plan-aware private history windows", () => {
    expect(getPrivateHistoryDays("watch")).toBe(7);
    expect(getPrivateHistoryDays("radar_signal")).toBe(90);
    expect(getPrivateHistoryDays("radar_intel")).toBe(0);
    expect(getPrivateHistoryDays("desk")).toBeNull();
  });
});
