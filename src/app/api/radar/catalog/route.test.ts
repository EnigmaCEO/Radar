import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth0", () => ({ auth0: { getSession: vi.fn() } }));
vi.mock("@/lib/sce-catalog", () => ({
  SceCatalogError: class SceCatalogError extends Error {},
  fetchSceCatalog: vi.fn(),
}));

import { auth0 } from "@/lib/auth0";
import { fetchSceCatalog } from "@/lib/sce-catalog";
import { GET } from "./route";

function req() {
  return new NextRequest("http://localhost/api/radar/catalog");
}

describe("GET /api/radar/catalog", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires an Auth0 session", async () => {
    vi.mocked(auth0.getSession).mockResolvedValue(null);

    const res = await GET(req());

    expect(res.status).toBe(401);
    expect(fetchSceCatalog).not.toHaveBeenCalled();
  });

  it("calls the SCE catalog server-side once authenticated", async () => {
    vi.mocked(auth0.getSession).mockResolvedValue({ user: { sub: "auth0|1" } } as never);
    vi.mocked(fetchSceCatalog).mockResolvedValue({
      objects: [],
      filters: { providers: [], chains: [], assets: [], tags: [], purposes: [], statuses: [] },
    });

    const res = await GET(req());

    expect(res.status).toBe(200);
    expect(fetchSceCatalog).toHaveBeenCalledOnce();
  });

  it("never exposes raw error detail (e.g. the admin key) for non-catalog errors", async () => {
    vi.mocked(auth0.getSession).mockResolvedValue({ user: { sub: "auth0|1" } } as never);
    vi.mocked(fetchSceCatalog).mockRejectedValue(new Error("X-SCE-Admin-Key: super-secret-value"));

    const res = await GET(req());
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(JSON.stringify(body)).not.toContain("super-secret-value");
  });
});
