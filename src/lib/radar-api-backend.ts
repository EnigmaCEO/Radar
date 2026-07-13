import type { SessionData } from "@auth0/nextjs-auth0/types";
import { headers } from "next/headers";
import type { RadarAccount } from "@/lib/radar-account";

function getRadarApiBaseUrl(): string | null {
  const value = process.env.RADAR_API_BASE_URL;
  return value && value.trim().length > 0 ? value.replace(/\/+$/, "") : null;
}

function getRadarApiSharedSecret(): string {
  const secret = process.env.RADAR_API_SHARED_SECRET;
  if (!secret || secret.trim().length === 0) {
    throw new Error("RADAR_API_SHARED_SECRET is not configured.");
  }
  return secret;
}

export function hasRadarApiBackend(): boolean {
  return getRadarApiBaseUrl() !== null;
}

function getUser(session: SessionData) {
  return session.user as { sub: string; name?: string; email?: string };
}

function extractHostname(value: string | null): string | null {
  if (!value) return null;
  const first = value.split(",")[0]?.trim();
  if (!first) return null;

  try {
    return new URL(first.includes("://") ? first : `http://${first}`).hostname.toLowerCase();
  } catch {
    return first.replace(/:\d+$/, "").toLowerCase();
  }
}

function isLocalHostname(hostname: string | null): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]";
}

async function isLocalDevRequest(): Promise<boolean> {
  try {
    const requestHeaders = await headers();
    const forwardedHost = requestHeaders.get("x-forwarded-host");
    const host = requestHeaders.get("host");
    return isLocalHostname(extractHostname(forwardedHost) ?? extractHostname(host));
  } catch {
    return false;
  }
}

function buildActorHeaders(session: SessionData, localDev = false): HeadersInit {
  const user = getUser(session);
  return {
    "x-radar-api-key": getRadarApiSharedSecret(),
    "x-radar-auth0-sub": user.sub,
    ...(user.name ? { "x-radar-auth0-name": user.name } : {}),
    ...(user.email ? { "x-radar-auth0-email": user.email } : {}),
    ...(localDev ? { "x-radar-local-dev": "true" } : {}),
  };
}

function authLogContext(session: SessionData) {
  const user = getUser(session);
  return {
    auth0Sub: user.sub,
    hasEmail: Boolean(user.email),
    hasName: Boolean(user.name),
  };
}

function summarizeAccount(account: Partial<RadarAccount>) {
  return {
    id: account.id ?? null,
    isAdmin: account.isAdmin ?? false,
    plan: account.plan ?? null,
    status: account.status ?? null,
    hasStripeCustomerId: Boolean(account.stripeCustomerId),
    hasStripeSubId: Boolean(account.stripeSubId),
  };
}

export async function bootstrapRadarAccount(session: SessionData) {
  const baseUrl = getRadarApiBaseUrl();
  if (!baseUrl) {
    throw new Error("RADAR_API_BASE_URL is not configured.");
  }
  const localDev = await isLocalDevRequest();

  console.info("[radar-auth] bootstrap account request", {
    ...authLogContext(session),
    baseUrl,
    localDev,
  });

  const response = await fetch(`${baseUrl}/v1/accounts/bootstrap`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildActorHeaders(session, localDev),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("[radar-auth] bootstrap account failed", {
      ...authLogContext(session),
      baseUrl,
      localDev,
      status: response.status,
      detail: detail.slice(0, 500),
    });
    throw new Error(`Radar API bootstrap failed (${response.status})${detail ? `: ${detail}` : ""}`);
  }

  const account = (await response.json()) as RadarAccount;
  console.info("[radar-auth] bootstrap account success", {
    ...authLogContext(session),
    baseUrl,
    localDev,
    account: summarizeAccount(account),
  });
  return account;
}

export async function forwardRadarApiRequest(
  path: string,
  {
    method = "GET",
    session,
    body,
    contentType,
    headers,
  }: {
    method?: string;
    session: SessionData;
    body?: string;
    contentType?: string | null;
    headers?: HeadersInit;
  },
) {
  const baseUrl = getRadarApiBaseUrl();
  if (!baseUrl) {
    throw new Error("RADAR_API_BASE_URL is not configured.");
  }
  const localDev = await isLocalDevRequest();

  const requestHeaders = new Headers(buildActorHeaders(session, localDev));
  if (contentType) {
    requestHeaders.set("Content-Type", contentType);
  }
  if (headers) {
    const extraHeaders = new Headers(headers);
    extraHeaders.forEach((value, key) => requestHeaders.set(key, value));
  }

  return fetch(`${baseUrl}${path}`, {
    method,
    headers: requestHeaders,
    body,
    cache: "no-store",
  });
}

export async function forwardRadarApiWebhook(
  path: string,
  {
    body,
    headers,
  }: {
    body: string;
    headers?: HeadersInit;
  },
) {
  const baseUrl = getRadarApiBaseUrl();
  if (!baseUrl) {
    throw new Error("RADAR_API_BASE_URL is not configured.");
  }

  const requestHeaders = new Headers({
    "x-radar-api-key": getRadarApiSharedSecret(),
  });
  if (headers) {
    const extraHeaders = new Headers(headers);
    extraHeaders.forEach((value, key) => requestHeaders.set(key, value));
  }

  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: requestHeaders,
    body,
    cache: "no-store",
  });
}

export function toProxyResponse(response: Response): Response {
  const headers = new Headers();
  const contentType = response.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  const cacheControl = response.headers.get("cache-control");
  if (cacheControl) headers.set("cache-control", cacheControl);
  return new Response(response.body, {
    status: response.status,
    headers,
  });
}
