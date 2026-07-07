import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth0", () => ({ auth0: { getSession: vi.fn() } }));
vi.mock("@/lib/account", () => ({ getAccount: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    radarDeliveryDestination: {
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { auth0 } from "@/lib/auth0";
import { getAccount } from "@/lib/account";
import { db } from "@/lib/db";
import { PATCH } from "./route";

const account = { id: "acct_1", ownerSub: "auth0|1", plan: "radar_pro" };

function req(body: unknown) {
  return new NextRequest("http://localhost/api/destinations/dest_1", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("PATCH /api/destinations/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth0.getSession).mockResolvedValue({ user: { sub: "auth0|1" } } as never);
    vi.mocked(getAccount).mockResolvedValue(account as never);
    vi.mocked(db.radarDeliveryDestination.findFirst).mockResolvedValue({
      id: "dest_1",
      accountId: "acct_1",
    } as never);
    vi.mocked(db.radarDeliveryDestination.update).mockImplementation(
      ((args: { data: Record<string, unknown> }) =>
        Promise.resolve({
          id: "dest_1",
          accountId: "acct_1",
          name: "Updated destination",
          channel: "webhook",
          destinationUrl: "https://example.test/hook",
          deliveryMode: args.data.deliveryMode ?? "alert_fanout",
          enabled: true,
          minimumSeverity: "watch",
          pollingFrequency: "1hr",
          lastPolledAt: null,
          configPreview: null,
          createdAt: "2026-07-04T00:00:00.000Z",
          updatedAt: "2026-07-04T00:00:00.000Z",
        })) as never,
    );
  });

  it("updates deliveryMode", async () => {
    const res = await PATCH(req({ deliveryMode: "digest" }), { params: { id: "dest_1" } });
    const data = await res.json();
    const updateArgs = vi.mocked(db.radarDeliveryDestination.update).mock.calls[0][0] as {
      data: Record<string, unknown>;
    };

    expect(res.status).toBe(200);
    expect(updateArgs.data.deliveryMode).toBe("digest");
    expect(data.deliveryMode).toBe("digest");
  });

  it("rejects invalid deliveryMode values", async () => {
    const res = await PATCH(req({ deliveryMode: "bad_mode" }), { params: { id: "dest_1" } });

    expect(res.status).toBe(400);
    expect(db.radarDeliveryDestination.update).not.toHaveBeenCalled();
  });
});
