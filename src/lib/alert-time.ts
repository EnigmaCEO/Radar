import type { RadarAlert } from "./api-types";
import { isClosedAlertStatus, isResolvedAlertStatus } from "./alert-status";

export function formatDurationBetween(start: string, end: string | Date = new Date()): string {
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime) return "0m";

  let remainingMinutes = Math.floor((endTime - startTime) / 60000);
  const days = Math.floor(remainingMinutes / (24 * 60));
  remainingMinutes -= days * 24 * 60;
  const hours = Math.floor(remainingMinutes / 60);
  remainingMinutes -= hours * 60;
  const minutes = remainingMinutes;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);
  return parts.join(" ");
}

export function formatAlertLifecycle(alert: Pick<RadarAlert, "status" | "openedAt" | "createdAt" | "resolvedAt">): string {
  const openedAt = alert.openedAt ?? alert.createdAt;
  if (isResolvedAlertStatus(alert.status) && alert.resolvedAt) {
    return `resolved in ${formatDurationBetween(openedAt, alert.resolvedAt)}`;
  }
  if (isClosedAlertStatus(alert.status)) {
    if (alert.resolvedAt) {
      return `closed after ${formatDurationBetween(openedAt, alert.resolvedAt)}`;
    }
    return "closed";
  }
  return `open for ${formatDurationBetween(openedAt)}`;
}

export function formatDateWindow(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return "";

  const sameDay =
    startDate.getUTCFullYear() === endDate.getUTCFullYear() &&
    startDate.getUTCMonth() === endDate.getUTCMonth() &&
    startDate.getUTCDate() === endDate.getUTCDate();
  const sameMinute =
    sameDay &&
    startDate.getUTCHours() === endDate.getUTCHours() &&
    startDate.getUTCMinutes() === endDate.getUTCMinutes();

  const dateLabel = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(startDate);
  const timeLabel = (value: Date) =>
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "UTC",
    }).format(value);

  if (sameMinute) return `${timeLabel(startDate)} ${dateLabel} UTC`;
  if (sameDay) return `${timeLabel(startDate)}-${timeLabel(endDate)} ${dateLabel} UTC`;
  return `${dateLabel} UTC to ${timeLabel(endDate)} ${new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(endDate)} UTC`;
}
