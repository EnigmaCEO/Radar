import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth0", () => ({ auth0: { getSession: vi.fn() } }));
vi.mock("@/lib/radar-api-backend", () => ({
  forwardRadarApiRequest: vi.fn(),
}));

import { auth0 } from "@/lib/auth0";
import { forwardRadarApiRequest } from "@/lib/radar-api-backend";
import { GET } from "./route";

describe("stripe portal route adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects unauthenticated users to login", async () => {
    vi.mocked(auth0.getSession).mockResolvedValue(null);

    const response = await GET(new NextRequest("https://radar.example.com/api/stripe/portal"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://radar.example.com/auth/login");
  });

  it("redirects to the backend-returned portal url", async () => {
    vi.mocked(auth0.getSession).mockResolvedValue({ user: { sub: "auth0|1" } } as never);
    vi.mocked(forwardRadarApiRequest).mockResolvedValue(
      new Response(JSON.stringify({ url: "https://billing.stripe.com/session/test" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const response = await GET(new NextRequest("https://radar.example.com/api/stripe/portal"));

    expect(forwardRadarApiRequest).toHaveBeenCalledWith("/v1/stripe/portal", {
      method: "GET",
      session: { user: { sub: "auth0|1" } },
    });
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://billing.stripe.com/session/test");
  });

  it("maps missing billing customers to the settings error redirect", async () => {
    vi.mocked(auth0.getSession).mockResolvedValue({ user: { sub: "auth0|1" } } as never);
    vi.mocked(forwardRadarApiRequest).mockResolvedValue(
      new Response(JSON.stringify({ error: "No billing customer" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      }),
    );

    const response = await GET(new NextRequest("https://radar.example.com/api/stripe/portal"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://radar.example.com/dashboard/settings?error=no_billing_customer",
    );
  });
});
