// Structured telemetry for every SCE alert read.
//
// Emits one machine-parseable line per read plus in-process counters. Alert
// bodies, upstream response bodies, headers, and credentials are never
// included: the fields below are all low-cardinality metadata.

import type { AlertDataErrorCode, AlertDataState, AlertDetailState } from "./alert-data-state";

export const ALERT_READ_EVENT = "radar.alert_read";

export type AlertReadCounter =
  | "success_nonempty"
  | "success_empty"
  | "degraded"
  | "unavailable"
  | "invalid_upstream_payload"
  | "auth_configuration_failure"
  | "timeout"
  | "rate_limited"
  | "not_found";

export interface AlertReadTelemetry {
  /** Radar-side route or surface performing the read. */
  route: string;
  /** Upstream path, without query values. */
  upstreamPath: string;
  state: AlertDataState | AlertDetailState;
  /** Upstream HTTP status, or null when the request never completed. */
  upstreamStatus: number | null;
  latencyMs: number;
  alertCount: number;
  source: "sce" | "cache";
  cacheAgeSeconds?: number;
  errorCode?: AlertDataErrorCode;
  requestId?: string;
  lastSuccessfulAt?: string;
}

const counters = new Map<AlertReadCounter, number>();

function bump(counter: AlertReadCounter): void {
  counters.set(counter, (counters.get(counter) ?? 0) + 1);
}

function countersFor(event: AlertReadTelemetry): AlertReadCounter[] {
  const result: AlertReadCounter[] = [];

  switch (event.state) {
    case "available":
      result.push("success_nonempty");
      break;
    case "empty":
      result.push("success_empty");
      break;
    case "not_found":
      result.push("not_found");
      break;
    case "degraded":
      result.push("degraded");
      break;
    case "unavailable":
      result.push("unavailable");
      break;
  }

  switch (event.errorCode) {
    case "INVALID_UPSTREAM_RESPONSE":
      result.push("invalid_upstream_payload");
      break;
    case "UPSTREAM_UNAUTHORIZED":
    case "CONFIGURATION_ERROR":
      result.push("auth_configuration_failure");
      break;
    case "UPSTREAM_TIMEOUT":
      result.push("timeout");
      break;
    case "UPSTREAM_RATE_LIMITED":
      result.push("rate_limited");
      break;
    default:
      break;
  }

  return result;
}

export function recordAlertRead(event: AlertReadTelemetry): void {
  for (const counter of countersFor(event)) bump(counter);

  const line = JSON.stringify({ event: ALERT_READ_EVENT, ...event });
  // An unavailable or degraded read is an operational failure signal; a
  // confirmed read is routine.
  if (event.state === "unavailable") console.error(line);
  else if (event.state === "degraded") console.warn(line);
  else console.info(line);
}

export function getAlertReadCounters(): Record<string, number> {
  return Object.fromEntries(counters);
}

/** Test hook. Not used by application code. */
export function resetAlertReadCounters(): void {
  counters.clear();
}
