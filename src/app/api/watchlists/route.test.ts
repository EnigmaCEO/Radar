import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth0", () => ({ auth0: { getSession: vi.fn() } }));
vi.mock("@/lib/account", () => ({ getAccount: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    radarWatchlist: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import { auth0 } from "@/lib/auth0";
import { getAccount } from "@/lib/account";
import { db } from "@/lib/db";
import { GET, POST } from "./route";

function req(body?: unknown) {
  return new NextRequest("http://localhost/api/watchlists", {
    method: body ? "POST" : "GET",
    ...(body ? { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } } : {}),
  });
}

const account = { id: "acct_1", ownerSub: "auth0|1", plan: "free", status: "active" };

describe("GET /api/watchlists", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires an Auth0 session", async () => {
    vi.mocked(auth0.getSession).mockResolvedValue(null);
    const res = await GET(req());
    expect(res.status).toBe(401);
  });

  it("scopes results to the resolved account", async () => {
    vi.mocked(auth0.getSession).mockResolvedValue({ user: { sub: "auth0|1" } } as never);
    vi.mocked(getAccount).mockResolvedValue(account as never);
    vi.mocked(db.radarWatchlist.findMany).mockResolvedValue([]);

    await GET(req());

    expect(db.radarWatchlist.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { accountId: "acct_1" } }),
    );
  });
});

describe("POST /api/watchlists", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth0.getSession).mockResolvedValue({ user: { sub: "auth0|1" } } as never);
  });

  it("requires an Auth0 session", async () => {
    vi.mocked(auth0.getSession).mockResolvedValue(null);
    const res = await POST(req({ name: "x" }));
    expect(res.status).toBe(401);
  });

  it("blocks the 4th watchlist on the free plan (limit 3)", async () => {
    vi.mocked(getAccount).mockResolvedValue({ ...account, plan: "free" } as never);
    vi.mocked(db.radarWatchlist.count).mockResolvedValue(3);

    const res = await POST(req({ name: "New watchlist" }));

    expect(res.status).toBe(403);
    expect(db.radarWatchlist.create).not.toHaveBeenCalled();
  });

  it("blocks the 11th watchlist on the radar_live plan (limit 10)", async () => {
    vi.mocked(getAccount).mockResolvedValue({ ...account, plan: "radar_live" } as never);
    vi.mocked(db.radarWatchlist.count).mockResolvedValue(10);

    const res = await POST(req({ name: "New watchlist" }));

    expect(res.status).toBe(403);
    expect(db.radarWatchlist.create).not.toHaveBeenCalled();
  });

  it.each(["radar_pro", "managed", "internal"])(
    "allows unlimited watchlists on the %s plan",
    async (plan) => {
      vi.mocked(getAccount).mockResolvedValue({ ...account, plan } as never);
      vi.mocked(db.radarWatchlist.count).mockResolvedValue(500);
      vi.mocked(db.radarWatchlist.create).mockResolvedValue({ id: "wl_1", name: "New watchlist" } as never);

      const res = await POST(req({ name: "New watchlist" }));

      expect(res.status).toBe(201);
    },
  );

  it("stores monitor types, providers, chains, assets, and signal classes", async () => {
    vi.mocked(getAccount).mockResolvedValue({ ...account, plan: "radar_pro" } as never);
    vi.mocked(db.radarWatchlist.count).mockResolvedValue(0);
    vi.mocked(db.radarWatchlist.create).mockResolvedValue({ id: "wl_1" } as never);

    await POST(
      req({
        name: "All Base USDC infrastructure",
        monitorTypes: ["oracle", "lp"],
        providers: ["Chainlink"],
        chains: ["base"],
        assets: ["USDC"],
        signalClasses: ["alert", "watch"],
      }),
    );

    expect(db.radarWatchlist.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          monitorTypes: ["oracle", "lp"],
          providers: ["Chainlink"],
          chains: ["base"],
          assets: ["USDC"],
          signalClasses: ["alert", "watch"],
        }),
      }),
    );
  });

  it("creates a broad watchlist with no filters and no objectIds", async () => {
    vi.mocked(getAccount).mockResolvedValue({ ...account, plan: "radar_pro" } as never);
    vi.mocked(db.radarWatchlist.count).mockResolvedValue(0);
    vi.mocked(db.radarWatchlist.create).mockResolvedValue({ id: "wl_1" } as never);

    const res = await POST(req({ name: "Everything" }));

    expect(res.status).toBe(201);
    expect(db.radarWatchlist.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ monitorTypes: [], objectIds: [] }),
      }),
    );
  });

  it("rejects an invalid monitor type", async () => {
    vi.mocked(getAccount).mockResolvedValue({ ...account, plan: "radar_pro" } as never);
    vi.mocked(db.radarWatchlist.count).mockResolvedValue(0);

    const res = await POST(req({ name: "x", monitorTypes: ["governance"] }));

    expect(res.status).toBe(400);
    expect(db.radarWatchlist.create).not.toHaveBeenCalled();
  });

  it("requires a name", async () => {
    vi.mocked(getAccount).mockResolvedValue({ ...account, plan: "radar_pro" } as never);
    const res = await POST(req({}));
    expect(res.status).toBe(400);
  });
});
