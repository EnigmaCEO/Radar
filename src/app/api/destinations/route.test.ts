import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth0", () => ({ auth0: { getSession: vi.fn() } }));
vi.mock("@/lib/account", () => ({ getAccount: vi.fn() }));
vi.mock("@/lib/encryption", () => ({
  encrypt: vi.fn((value: string) => `encrypted:${value}`),
  maskUrl: vi.fn(() => "***masked***"),
}));
vi.mock("@/lib/db", () => ({
  db: {
    radarDeliveryDestination: {
      count: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import { auth0 } from "@/lib/auth0";
import { getAccount } from "@/lib/account";
import { db } from "@/lib/db";
import { POST } from "./route";

const account = { id: "acct_1", ownerSub: "auth0|1", plan: "radar_pro" };

function req(body: unknown) {
  return new NextRequest("http://localhost/api/destinations", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/destinations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth0.getSession).mockResolvedValue({ user: { sub: "auth0|1" } } as never);
    vi.mocked(getAccount).mockResolvedValue(account as never);
    vi.mocked(db.radarDeliveryDestination.count).mockResolvedValue(0 as never);
    vi.mocked(db.radarDeliveryDestination.create).mockImplementation(
      ((args: { data: Record<string, unknown> }) =>
        Promise.resolve({
          id: "dest_1",
          accountId: "acct_1",
          name: args.data.name,
          channel: args.data.channel,
          destinationUrl: args.data.destinationUrl,
          deliveryMode: args.data.deliveryMode,
          enabled: args.data.enabled,
          minimumSeverity: args.data.minimumSeverity,
          pollingFrequency: args.data.pollingFrequency,
          lastPolledAt: null,
          configPreview: null,
          createdAt: "2026-07-04T00:00:00.000Z",
          updatedAt: "2026-07-04T00:00:00.000Z",
        })) as never,
    );
  });

  it("defaults deliveryMode to alert_fanout", async () => {
    const res = await POST(
      req({
        name: "Ops webhook",
        channel: "webhook",
        destinationUrl: "https://example.test/hook",
      }),
    );
    const data = await res.json();
    const createArgs = vi.mocked(db.radarDeliveryDestination.create).mock.calls[0][0] as {
      data: Record<string, unknown>;
    };

    expect(res.status).toBe(201);
    expect(createArgs.data.deliveryMode).toBe("alert_fanout");
    expect(data.deliveryMode).toBe("alert_fanout");
  });

  it("stores an explicit deliveryMode", async () => {
    const res = await POST(
      req({
        name: "Public Discord",
        channel: "discord_webhook",
        destinationUrl: "https://discord.com/api/webhooks/x/y",
        deliveryMode: "public_thread",
      }),
    );
    const data = await res.json();
    const createArgs = vi.mocked(db.radarDeliveryDestination.create).mock.calls[0][0] as {
      data: Record<string, unknown>;
    };

    expect(res.status).toBe(201);
    expect(createArgs.data.deliveryMode).toBe("public_thread");
    expect(data.deliveryMode).toBe("public_thread");
  });

  it("rejects invalid deliveryMode values", async () => {
    const res = await POST(
      req({
        name: "Bad",
        channel: "webhook",
        destinationUrl: "https://example.test/hook",
        deliveryMode: "bad_mode",
      }),
    );

    expect(res.status).toBe(400);
    expect(db.radarDeliveryDestination.create).not.toHaveBeenCalled();
  });

  it("preserves destination limits", async () => {
    vi.mocked(db.radarDeliveryDestination.count).mockResolvedValue(10 as never);

    const res = await POST(
      req({
        name: "Over limit",
        channel: "webhook",
        destinationUrl: "https://example.test/hook",
      }),
    );

    expect(res.status).toBe(403);
    expect(db.radarDeliveryDestination.create).not.toHaveBeenCalled();
  });
});
