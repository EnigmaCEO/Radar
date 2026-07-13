import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  cache: <T>(fn: T) => fn,
}));
vi.mock("@/lib/auth0", () => ({ auth0: { getSession: vi.fn() } }));
vi.mock("@/lib/radar-api-backend", () => ({ bootstrapRadarAccount: vi.fn() }));

import { auth0 } from "@/lib/auth0";
import { bootstrapRadarAccount } from "@/lib/radar-api-backend";
import { getAccount } from "./account";

describe("getAccount bootstrap", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null when there is no Auth0 session", async () => {
    vi.mocked(auth0.getSession).mockResolvedValue(null);

    const result = await getAccount();

    expect(result).toBeNull();
    expect(bootstrapRadarAccount).not.toHaveBeenCalled();
  });

  it("bootstraps the account through the standalone backend", async () => {
    vi.mocked(auth0.getSession).mockResolvedValue({
      user: { sub: "auth0|new-user", name: "New User", email: "new@example.com" },
    } as never);
    vi.mocked(bootstrapRadarAccount).mockResolvedValue({
      id: "acct_new",
      ownerSub: "auth0|new-user",
      isAdmin: false,
    } as never);

    const result = await getAccount();

    expect(bootstrapRadarAccount).toHaveBeenCalledWith({
      user: { sub: "auth0|new-user", name: "New User", email: "new@example.com" },
    });
    expect(result?.id).toBe("acct_new");
  });
});
