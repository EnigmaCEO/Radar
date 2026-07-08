import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth0", () => ({ auth0: { getSession: vi.fn() } }));
vi.mock("@/lib/radar-api-backend", () => ({
  forwardRadarApiRequest: vi.fn(),
  toProxyResponse: vi.fn(),
}));

import { auth0 } from "@/lib/auth0";
import {
  forwardRadarApiRequest,
  toProxyResponse,
} from "@/lib/radar-api-backend";
import { GET, POST } from "./route";

describe("watchlists route backend adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth0.getSession).mockResolvedValue({ user: { sub: "auth0|1" } } as never);
    vi.mocked(toProxyResponse).mockImplementation((response: Response) => response);
  });

  it("proxies GET requests to the standalone backend", async () => {
    vi.mocked(forwardRadarApiRequest).mockResolvedValue(
      new Response("[]", {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const response = await GET(new NextRequest("http://localhost/api/watchlists"));

    expect(forwardRadarApiRequest).toHaveBeenCalledWith("/v1/watchlists", {
      method: "GET",
      session: { user: { sub: "auth0|1" } },
    });
    expect(response.status).toBe(200);
  });

  it("proxies POST requests to the standalone backend", async () => {
    vi.mocked(forwardRadarApiRequest).mockResolvedValue(
      new Response('{"id":"wl_1"}', {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );

    const response = await POST(
      new NextRequest("http://localhost/api/watchlists", {
        method: "POST",
        body: JSON.stringify({ name: "All" }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(forwardRadarApiRequest).toHaveBeenCalledWith("/v1/watchlists", {
      method: "POST",
      session: { user: { sub: "auth0|1" } },
      body: '{"name":"All"}',
      contentType: "application/json",
    });
    expect(response.status).toBe(201);
  });
});
