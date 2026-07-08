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
import { POST } from "./route";

describe("manual delivery route backend adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth0.getSession).mockResolvedValue({ user: { sub: "auth0|1" } } as never);
    vi.mocked(toProxyResponse).mockImplementation((response: Response) => response);
  });

  it("forwards manual delivery requests to the standalone backend", async () => {
    vi.mocked(forwardRadarApiRequest).mockResolvedValue(
      new Response('{"status":"dry_run"}', {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const response = await POST(
      new NextRequest("http://localhost/api/radar/delivery/run-manual", {
        method: "POST",
        body: JSON.stringify({ dryRun: true, window: "24h" }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(forwardRadarApiRequest).toHaveBeenCalledWith("/v1/radar/delivery/run-manual", {
      method: "POST",
      session: { user: { sub: "auth0|1" } },
      body: '{"dryRun":true,"window":"24h"}',
      contentType: "application/json",
    });
    expect(response.status).toBe(200);
  });
});
