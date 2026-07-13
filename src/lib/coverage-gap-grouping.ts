import type { RadarAlert, RadarStatus } from "./api-types";
import { isCoverageGapAlert } from "./alert-classification";
import {
  isDisabledAlertStatus,
  isSupersededAlertStatus,
} from "./alert-status";
import { formatDurationBetween } from "./alert-time";

export interface CoverageGapGroup {
  id: string;
  source: string;
  asset?: string;
  cause: string;
  alerts: RadarAlert[];
  routeCount: number;
  routes: string[];
  openedAt: string;
  resolvedAt?: string;
  status: RadarStatus;
  title: string;
  summary: string;
}

const COVERAGE_GROUP_WINDOW_MS = 3 * 60 * 60 * 1000;

function firstString(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return null;
}

function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter((part) => part.length > 0)
    .map((part) => part[0].toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function providerLabel(value: string): string {
  return /[A-Z]/.test(value) ? value : titleCase(value);
}

function humanize(value: string): string {
  return value.trim().toLowerCase().replace(/_/g, " ");
}

function coverageCause(alert: RadarAlert): string {
  if (alert.failureCause) return humanize(alert.failureCause);
  const summary = alert.summary.toLowerCase();
  if (summary.includes("source unavailable")) return "status source unavailable";
  return humanize(alert.reasonCode);
}

function openedAtValue(alert: RadarAlert): string {
  return alert.openedAt ?? alert.createdAt;
}

function resolvedAtValue(alert: RadarAlert): string | null {
  return alert.resolvedAt ?? null;
}

function routeKey(route: string): string {
  return route.replace(/\s+/g, " ").trim();
}

function foldReciprocalRoutes(routes: string[]): string[] {
  const pairs = new Map<string, { forward?: string; reverse?: string; parts: [string, string] }>();
  const passthrough: string[] = [];

  for (const route of routes) {
    const normalized = routeKey(route);
    const parts = normalized.split(/\s*(?:->|→)\s*/);
    if (parts.length !== 2) {
      passthrough.push(normalized);
      continue;
    }

    const [from, to] = parts as [string, string];
    const key = [from, to].sort((a, b) => a.localeCompare(b)).join("|");
    const existing = pairs.get(key) ?? { parts: [from, to] };
    if (existing.parts[0] === from && existing.parts[1] === to) {
      existing.forward = `${from}→${to}`;
    } else {
      existing.reverse = `${from}→${to}`;
    }
    pairs.set(key, existing);
  }

  const folded = Array.from(pairs.values()).map((entry) => {
    if (entry.forward && entry.reverse) {
      return `${entry.parts[0]}↔${entry.parts[1]}`;
    }
    return entry.forward ?? entry.reverse ?? "";
  });

  return [...folded.filter((route) => route.length > 0), ...passthrough].sort((a, b) =>
    a.localeCompare(b),
  );
}

function statusForAlerts(alerts: RadarAlert[]): RadarStatus {
  if (alerts.some((alert) => alert.status === "active")) return "active";
  if (alerts.some((alert) => isDisabledAlertStatus(alert.status))) return "disabled";
  if (alerts.some((alert) => isSupersededAlertStatus(alert.status))) return "superseded";
  return "resolved";
}

function buildGroupSummary(alerts: RadarAlert[]): string {
  const firstOpened = alerts[0];
  if (!firstOpened) return "";

  const groupStatus = statusForAlerts(alerts);
  const allClosedWithEnd = alerts.every((alert) => Boolean(resolvedAtValue(alert)));
  if (groupStatus === "resolved" && allClosedWithEnd) {
    const longestDurationMs = Math.max(
      ...alerts.map((alert) => {
        const opened = new Date(openedAtValue(alert)).getTime();
        const resolved = new Date(resolvedAtValue(alert) ?? openedAtValue(alert)).getTime();
        return Math.max(0, resolved - opened);
      }),
    );
    const end = new Date(new Date(openedAtValue(firstOpened)).getTime() + longestDurationMs);
    return `all restored within ${formatDurationBetween(openedAtValue(firstOpened), end)}`;
  }
  if (groupStatus !== "active") {
    if (allClosedWithEnd) {
      const longestDurationMs = Math.max(
        ...alerts.map((alert) => {
          const opened = new Date(openedAtValue(alert)).getTime();
          const resolved = new Date(resolvedAtValue(alert) ?? openedAtValue(alert)).getTime();
          return Math.max(0, resolved - opened);
        }),
      );
      const end = new Date(new Date(openedAtValue(firstOpened)).getTime() + longestDurationMs);
      return `closed after ${formatDurationBetween(openedAtValue(firstOpened), end)}`;
    }
    return "closed";
  }

  return `open for ${formatDurationBetween(openedAtValue(firstOpened))}`;
}

function groupIdentity(alert: RadarAlert): string {
  return [
    alert.monitorType,
    alert.source.trim().toLowerCase(),
    coverageCause(alert),
    (alert.asset ?? "").trim().toLowerCase(),
  ].join("|");
}

function shouldJoinIncident(current: RadarAlert[], candidate: RadarAlert): boolean {
  const last = current[current.length - 1];
  if (!last) return true;
  if (groupIdentity(last) !== groupIdentity(candidate)) return false;

  const delta =
    new Date(openedAtValue(candidate)).getTime() - new Date(openedAtValue(last)).getTime();
  return Math.abs(delta) <= COVERAGE_GROUP_WINDOW_MS;
}

function buildGroup(alerts: RadarAlert[]): CoverageGapGroup {
  const sorted = [...alerts].sort(
    (a, b) => new Date(openedAtValue(a)).getTime() - new Date(openedAtValue(b)).getTime(),
  );
  const first = sorted[0];
  const routes = foldReciprocalRoutes(
    sorted
      .map((alert) => firstString(alert.route))
      .filter((route): route is string => route !== null),
  );
  const rawRouteCount = new Set(
    sorted
      .map((alert) => firstString(alert.route))
      .filter((route): route is string => route !== null)
      .map(routeKey),
  ).size;
  const resolvedAlerts = sorted.filter((alert) => Boolean(resolvedAtValue(alert)));
  const latestResolvedAt =
    resolvedAlerts.length === sorted.length
      ? [...resolvedAlerts]
          .sort(
            (a, b) =>
              new Date(resolvedAtValue(b) ?? openedAtValue(b)).getTime() -
              new Date(resolvedAtValue(a) ?? openedAtValue(a)).getTime(),
          )[0]
          ?.resolvedAt
      : undefined;

  return {
    id: `coverage:${sorted.map((alert) => alert.id).join(",")}`,
    source: first.source,
    asset: first.asset ?? undefined,
    cause: coverageCause(first),
    alerts: sorted,
    routeCount: rawRouteCount,
    routes,
    openedAt: openedAtValue(first),
    resolvedAt: latestResolvedAt ?? undefined,
    status: statusForAlerts(sorted),
    title: [providerLabel(first.source), first.asset, "—", coverageCause(first)]
      .filter((part) => typeof part === "string" && part.length > 0)
      .join(" "),
    summary: buildGroupSummary(sorted),
  };
}

export function groupCoverageGapAlerts(alerts: RadarAlert[]): CoverageGapGroup[] {
  const eligible = alerts.filter((alert) => isCoverageGapAlert(alert));
  const buckets = new Map<string, RadarAlert[]>();

  for (const alert of eligible) {
    const key = groupIdentity(alert);
    buckets.set(key, [...(buckets.get(key) ?? []), alert]);
  }

  const groups: CoverageGapGroup[] = [];
  for (const bucket of buckets.values()) {
    const sorted = [...bucket].sort(
      (a, b) => new Date(openedAtValue(a)).getTime() - new Date(openedAtValue(b)).getTime(),
    );
    const incidents: RadarAlert[][] = [];
    for (const alert of sorted) {
      const current = incidents[incidents.length - 1];
      if (!current || !shouldJoinIncident(current, alert)) {
        incidents.push([alert]);
      } else {
        current.push(alert);
      }
    }

    for (const incident of incidents) {
      groups.push(buildGroup(incident));
    }
  }

  return groups.sort((a, b) => {
    const aTime = new Date(a.resolvedAt ?? a.openedAt).getTime();
    const bTime = new Date(b.resolvedAt ?? b.openedAt).getTime();
    return bTime - aTime;
  });
}
