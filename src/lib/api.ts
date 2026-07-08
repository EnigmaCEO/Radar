import type {
  AccessRequest,
  RadarAlert,
  RadarClient,
  RadarClientEntitlementSummary,
  RadarDeliveryDestination,
  RadarWatchlist,
  SaasMeResponse,
} from "./api-types";
import { stripTrailingSlash } from "./utils";

const API_BASE = stripTrailingSlash(
  process.env.NEXT_PUBLIC_API_URL ?? "https://continuityengineserver.fly.dev",
);

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public detail?: unknown,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    let detail: unknown;
    try {
      detail = await res.json();
    } catch {
      detail = await res.text();
    }
    throw new ApiError(res.status, `API error ${res.status}`, detail);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ── Auth ───────────────────────────────────────────────────────────────────────

export async function login(email: string): Promise<SaasMeResponse> {
  return request<SaasMeResponse>("/saas/login", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function logout(): Promise<void> {
  return request<void>("/saas/logout", { method: "POST" });
}

export async function getMe(): Promise<SaasMeResponse> {
  return request<SaasMeResponse>("/saas/me");
}

export async function requestAccess(payload: {
  name: string;
  email: string;
  organization: string;
  roleTitle?: string;
  useCase?: string;
}): Promise<AccessRequest> {
  return request<AccessRequest>("/saas/request-access", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ── Alerts ────────────────────────────────────────────────────────────────────

export async function listAlerts(params?: {
  status?: string;
  severity?: string;
  monitorType?: string;
  limit?: number;
}): Promise<RadarAlert[]> {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.severity) query.set("severity", params.severity);
  if (params?.monitorType) query.set("monitor_type", params.monitorType);
  if (params?.limit) query.set("limit", String(params.limit));
  const qs = query.toString();
  return request<RadarAlert[]>(`/v1/sce/radar/alerts${qs ? `?${qs}` : ""}`);
}

export async function getAlert(id: string): Promise<RadarAlert> {
  return request<RadarAlert>(`/v1/sce/radar/alerts/${id}`);
}

// ── Clients ───────────────────────────────────────────────────────────────────

export async function getClient(clientId: string): Promise<RadarClient> {
  return request<RadarClient>(`/v1/sce/radar/clients/${clientId}`);
}

export async function getClientEntitlements(
  clientId: string,
): Promise<RadarClientEntitlementSummary> {
  return request<RadarClientEntitlementSummary>(
    `/v1/sce/radar/clients/${clientId}/entitlements`,
  );
}

// ── Watchlists ────────────────────────────────────────────────────────────────

export async function listWatchlists(clientId: string): Promise<RadarWatchlist[]> {
  return request<RadarWatchlist[]>(`/v1/sce/radar/watchlists?client_id=${clientId}`);
}

export async function createWatchlist(
  payload: Omit<RadarWatchlist, "id" | "createdAt" | "updatedAt">,
): Promise<RadarWatchlist> {
  return request<RadarWatchlist>("/v1/sce/radar/watchlists", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateWatchlist(
  id: string,
  payload: Partial<RadarWatchlist>,
): Promise<RadarWatchlist> {
  return request<RadarWatchlist>(`/v1/sce/radar/watchlists/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteWatchlist(id: string): Promise<void> {
  return request<void>(`/v1/sce/radar/watchlists/${id}`, { method: "DELETE" });
}

// ── Delivery destinations ─────────────────────────────────────────────────────

export async function listDeliveryDestinations(
  clientId: string,
): Promise<RadarDeliveryDestination[]> {
  return request<RadarDeliveryDestination[]>(
    `/v1/sce/radar/delivery-destinations?client_id=${clientId}`,
  );
}

export async function createDeliveryDestination(
  payload: Omit<RadarDeliveryDestination, "id" | "createdAt" | "updatedAt">,
): Promise<RadarDeliveryDestination> {
  return request<RadarDeliveryDestination>("/v1/sce/radar/delivery-destinations", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function deleteDeliveryDestination(id: string): Promise<void> {
  return request<void>(`/v1/sce/radar/delivery-destinations/${id}`, { method: "DELETE" });
}

export { ApiError };
