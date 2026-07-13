import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionData } from "@auth0/nextjs-auth0/types";
vi.mock("next/headers", () => ({ headers: vi.fn() }));

import { headers } from "next/headers";
import {
  bootstrapRadarAccount,
  forwardRadarApiRequest,
  forwardRadarApiWebhook,
  hasRadarApiBackend,
  toProxyResponse,
} from "./radar-api-backend";

const ORIGINAL_ENV = { ...process.env };

const session = {
  user: {
    sub: "auth0|abc",
    name: "Radar Ops",
    email: "ops@example.com",
  },
} as SessionData;

describe("radar-api-backend", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(headers).mockRejectedValue(new Error("outside request scope"));
    process.env.RADAR_API_BASE_URL = "https://radar-api.example.com/";
    process.env.RADAR_API_SHARED_SECRET = "shared-secret";
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("detects when the standalone backend is configured", () => {
    expect(hasRadarApiBackend()).toBe(true);
    delete process.env.RADAR_API_BASE_URL;
    expect(hasRadarApiBackend()).toBe(false);
  });

  it("bootstraps accounts through the backend with actor headers", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "acct_1" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await bootstrapRadarAccount(session);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);

    expect(url).toBe("https://radar-api.example.com/v1/accounts/bootstrap");
    expect(init.method).toBe("POST");
    expect(init.cache).toBe("no-store");
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.get("x-radar-api-key")).toBe("shared-secret");
    expect(headers.get("x-radar-auth0-sub")).toBe("auth0|abc");
    expect(headers.get("x-radar-auth0-name")).toBe("Radar Ops");
    expect(headers.get("x-radar-auth0-email")).toBe("ops@example.com");
  });

  it("forwards authenticated JSON requests to the backend", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(new Response(null, { status: 204 }));

    await forwardRadarApiRequest("/v1/watchlists", {
      method: "POST",
      session,
      body: '{"name":"All"}',
      contentType: "application/json",
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);

    expect(url).toBe("https://radar-api.example.com/v1/watchlists");
    expect(init.method).toBe("POST");
    expect(init.body).toBe('{"name":"All"}');
    expect(init.cache).toBe("no-store");
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.get("x-radar-api-key")).toBe("shared-secret");
    expect(headers.get("x-radar-auth0-sub")).toBe("auth0|abc");
  });

  it("marks localhost-origin requests as local dev", async () => {
    vi.mocked(headers).mockResolvedValue(
      new Headers({
        host: "localhost:3000",
      }) as never,
    );
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(new Response(null, { status: 204 }));

    await forwardRadarApiRequest("/v1/watchlists", {
      method: "POST",
      session,
      body: '{"name":"All"}',
      contentType: "application/json",
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const requestHeaders = new Headers(init.headers);
    expect(requestHeaders.get("x-radar-local-dev")).toBe("true");
  });

  it("forwards webhook payloads with only the shared secret and passthrough headers", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(new Response(null, { status: 200 }));

    await forwardRadarApiWebhook("/v1/stripe/webhook", {
      body: '{"id":"evt_1"}',
      headers: {
        "content-type": "application/json",
        "stripe-signature": "t=1,v1=test",
      },
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);

    expect(url).toBe("https://radar-api.example.com/v1/stripe/webhook");
    expect(init.method).toBe("POST");
    expect(init.body).toBe('{"id":"evt_1"}');
    expect(init.cache).toBe("no-store");
    expect(headers.get("x-radar-api-key")).toBe("shared-secret");
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("stripe-signature")).toBe("t=1,v1=test");
  });

  it("preserves status and selected headers when proxying backend responses", async () => {
    const response = new Response('{"ok":true}', {
      status: 202,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
        "x-internal-secret": "drop-me",
      },
    });

    const proxied = toProxyResponse(response);

    expect(proxied.status).toBe(202);
    expect(proxied.headers.get("content-type")).toBe("application/json");
    expect(proxied.headers.get("cache-control")).toBe("no-store");
    expect(proxied.headers.get("x-internal-secret")).toBeNull();
  });
});
