import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth0", () => ({ auth0: { getSession: vi.fn() } }));
vi.mock("@/lib/account", () => ({ getAccount: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    radarWatchlist: {
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { auth0 } from "@/lib/auth0";
import { getAccount } from "@/lib/account";
import { db } from "@/lib/db";
import { DELETE, PATCH } from "./route";

const account = { id: "acct_1", ownerSub: "auth0|1", plan: "radar_pro" };

function patchReq(body: unknown) {
  return new NextRequest("http://localhost/api/watchlists/wl_1", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function deleteReq() {
  return new NextRequest("http://localhost/api/watchlists/wl_1", { method: "DELETE" });
}

describe("PATCH /api/watchlists/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth0.getSession).mockResolvedValue({ user: { sub: "auth0|1" } } as never);
    vi.mocked(getAccount).mockResolvedValue(account as never);
  });

  it("requires an Auth0 session", async () => {
    vi.mocked(auth0.getSession).mockResolvedValue(null);
    const res = await PATCH(patchReq({ enabled: false }), { params: { id: "wl_1" } });
    expect(res.status).toBe(401);
  });

  it("returns 404 (not another account's watchlist) when the watchlist is not owned by the caller's account", async () => {
    // findFirst is always scoped by accountId — a watchlist belonging to another
    // account will never match, simulating cross-account access being blocked.
    vi.mocked(db.radarWatchlist.findFirst).mockResolvedValue(null);

    const res = await PATCH(patchReq({ enabled: false }), { params: { id: "wl_1" } });

    expect(db.radarWatchlist.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "wl_1", accountId: "acct_1" } }),
    );
    expect(res.status).toBe(404);
    expect(db.radarWatchlist.update).not.toHaveBeenCalled();
  });

  it("updates an owned watchlist", async () => {
    vi.mocked(db.radarWatchlist.findFirst).mockResolvedValue({ id: "wl_1", accountId: "acct_1" } as never);
    vi.mocked(db.radarWatchlist.update).mockResolvedValue({ id: "wl_1", enabled: false } as never);

    const res = await PATCH(patchReq({ enabled: false }), { params: { id: "wl_1" } });

    expect(res.status).toBe(200);
    expect(db.radarWatchlist.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "wl_1" }, data: expect.objectContaining({ enabled: false }) }),
    );
  });

  it("rejects invalid filter values on update", async () => {
    vi.mocked(db.radarWatchlist.findFirst).mockResolvedValue({ id: "wl_1", accountId: "acct_1" } as never);

    const res = await PATCH(patchReq({ minSeverity: "info" }), { params: { id: "wl_1" } });

    expect(res.status).toBe(400);
    expect(db.radarWatchlist.update).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/watchlists/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth0.getSession).mockResolvedValue({ user: { sub: "auth0|1" } } as never);
    vi.mocked(getAccount).mockResolvedValue(account as never);
  });

  it("requires an Auth0 session", async () => {
    vi.mocked(auth0.getSession).mockResolvedValue(null);
    const res = await DELETE(deleteReq(), { params: { id: "wl_1" } });
    expect(res.status).toBe(401);
  });

  it("returns 404 (not another account's watchlist) when not owned by the caller's account", async () => {
    vi.mocked(db.radarWatchlist.findFirst).mockResolvedValue(null);

    const res = await DELETE(deleteReq(), { params: { id: "wl_1" } });

    expect(res.status).toBe(404);
    expect(db.radarWatchlist.delete).not.toHaveBeenCalled();
  });

  it("deletes an owned watchlist", async () => {
    vi.mocked(db.radarWatchlist.findFirst).mockResolvedValue({ id: "wl_1", accountId: "acct_1" } as never);
    vi.mocked(db.radarWatchlist.delete).mockResolvedValue({} as never);

    const res = await DELETE(deleteReq(), { params: { id: "wl_1" } });

    expect(res.status).toBe(204);
    expect(db.radarWatchlist.delete).toHaveBeenCalledWith({ where: { id: "wl_1" } });
  });
});
