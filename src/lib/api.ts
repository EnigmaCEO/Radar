import type {
  AccessRequest,
  RadarAlert,
  RadarAlertPage,
  RadarClient,
  RadarClientEntitlementSummary,
  RadarDeliveryDestination,
  RadarWatchlist,
  SaasMeResponse,
} from "./api-types";
import type { DashboardBootstrapPayload } from "./dashboard-bootstrap-types";
import type { SceCatalogResponse } from "./sce-catalog-types";
import type { SceThresholdResponse } from "./sce-threshold-types";
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

async function requestSameOrigin<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
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

export interface ListAlertsParams {
  status?: string;
  severity?: string;
  monitorType?: string;
  limit?: number;
  historyMode?: "snapshot" | "ledger";
  window?: "24h" | "7d" | "30d" | "90d" | "all";
}

function normalizeAlertPage(payload: RadarAlert[] | RadarAlertPage): RadarAlertPage {
  if (Array.isArray(payload)) {
    return {
      alerts: payload,
      count: payload.length,
      pageCount: payload.length,
    };
  }

  const alerts = Array.isArray(payload.alerts) ? payload.alerts : [];
  const count =
    typeof payload.count === "number" && Number.isFinite(payload.count)
      ? Math.max(0, Math.trunc(payload.count))
      : alerts.length;
  const pageCount =
    typeof payload.pageCount === "number" && Number.isFinite(payload.pageCount)
      ? Math.max(0, Math.trunc(payload.pageCount))
      : alerts.length;

  return { alerts, count, pageCount };
}

export async function listAlertPage(params?: ListAlertsParams): Promise<RadarAlertPage> {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.severity) query.set("severity", params.severity);
  if (params?.monitorType) query.set("monitor_type", params.monitorType);
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.historyMode) query.set("history_mode", params.historyMode);
  if (params?.window) query.set("window", params.window);
  const qs = query.toString();
  const payload = await requestSameOrigin<RadarAlert[] | RadarAlertPage>(
    `/api/alerts${qs ? `?${qs}` : ""}`,
    { cache: "no-store" },
  );
  return normalizeAlertPage(payload);
}

export async function listAlerts(params?: ListAlertsParams): Promise<RadarAlert[]> {
  const page = await listAlertPage(params);
  return page.alerts;
}

export async function getAlert(id: string): Promise<RadarAlert> {
  return request<RadarAlert>(`/v1/sce/radar/alerts/${id}`);
}

export async function getRadarCatalog(): Promise<SceCatalogResponse> {
  return requestSameOrigin<SceCatalogResponse>("/api/radar/catalog");
}

export async function getDashboardBootstrap(): Promise<DashboardBootstrapPayload> {
  return requestSameOrigin<DashboardBootstrapPayload>("/api/dashboard/bootstrap", {
    cache: "no-store",
  });
}

export async function getRadarThresholds(): Promise<SceThresholdResponse> {
  return requestSameOrigin<SceThresholdResponse>("/api/radar/thresholds");
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
