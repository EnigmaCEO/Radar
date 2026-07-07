import { beforeEach, describe, expect, it, vi } from "vitest";

// React's `cache()` requires the "react-server" condition, which isn't present
// under plain Vitest — stub it as a passthrough since we're only testing the
// bootstrap logic inside, not per-request memoization.
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  cache: <T>(fn: T) => fn,
}));
vi.mock("@/lib/auth0", () => ({ auth0: { getSession: vi.fn() } }));
vi.mock("@/lib/db", () => ({ db: { radarAccount: { upsert: vi.fn() } } }));

import { auth0 } from "@/lib/auth0";
import { db } from "@/lib/db";
import { getAccount } from "./account";

describe("getAccount bootstrap", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null when there is no Auth0 session", async () => {
    vi.mocked(auth0.getSession).mockResolvedValue(null);
    const result = await getAccount();
    expect(result).toBeNull();
    expect(db.radarAccount.upsert).not.toHaveBeenCalled();
  });

  it("creates a Radar account on first login for a new Auth0 sub", async () => {
    vi.mocked(auth0.getSession).mockResolvedValue({
      user: { sub: "auth0|new-user", name: "New User", email: "new@example.com" },
    } as never);
    vi.mocked(db.radarAccount.upsert).mockResolvedValue({ id: "acct_new", ownerSub: "auth0|new-user" } as never);

    const result = await getAccount();

    expect(db.radarAccount.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ownerSub: "auth0|new-user" },
        create: expect.objectContaining({ ownerSub: "auth0|new-user" }),
      }),
    );
    expect(result?.id).toBe("acct_new");
  });
});
