"use client";

import { useEffect, useState } from "react";

type LocalDateTimePreset = "compact" | "detailed";

function formatZoneName(value: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "short",
  });
  const zonePart = formatter.formatToParts(value).find((part) => part.type === "timeZoneName");
  return zonePart?.value ?? "";
}

export function formatDateTimeForZone(
  value: string,
  preset: LocalDateTimePreset,
  timeZone?: string,
): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  if (preset === "detailed") {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      ...(timeZone ? { timeZone } : {}),
    }).format(date);
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
    ...(timeZone ? { timeZone } : {}),
  }).format(date);
}

export function formatDateWindowForZone(
  start: string,
  end: string,
  timeZone?: string,
): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return "";

  const formatterOptions = timeZone ? { timeZone } : undefined;
  const dateKey = (value: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      ...formatterOptions,
    }).format(value);
  const minuteKey = (value: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      ...formatterOptions,
    }).format(value);
  const dateLabel = (value: Date) =>
    new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      ...formatterOptions,
    }).format(value);
  const timeLabel = (value: Date) =>
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      ...formatterOptions,
    }).format(value);
  const zoneLabel = (value: Date) => formatZoneName(value, timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone);

  if (minuteKey(startDate) === minuteKey(endDate)) {
    return `${timeLabel(startDate)} ${dateLabel(startDate)} ${zoneLabel(startDate)}`;
  }
  if (dateKey(startDate) === dateKey(endDate)) {
    return `${timeLabel(startDate)}-${timeLabel(endDate)} ${dateLabel(startDate)} ${zoneLabel(endDate)}`;
  }
  return `${timeLabel(startDate)} ${dateLabel(startDate)} ${zoneLabel(startDate)} to ${timeLabel(endDate)} ${dateLabel(endDate)} ${zoneLabel(endDate)}`;
}

function utcTimeZone() {
  return "UTC";
}

export function LocalDateTime({
  value,
  preset = "compact",
}: {
  value: string;
  preset?: LocalDateTimePreset;
}) {
  const [formatted, setFormatted] = useState(() =>
    formatDateTimeForZone(value, preset, utcTimeZone()),
  );

  useEffect(() => {
    setFormatted(formatDateTimeForZone(value, preset));
  }, [value, preset]);

  return (
    <time dateTime={value} suppressHydrationWarning>
      {formatted}
    </time>
  );
}

export function LocalDateWindow({
  start,
  end,
}: {
  start: string;
  end: string;
}) {
  const [formatted, setFormatted] = useState(() =>
    formatDateWindowForZone(start, end, utcTimeZone()),
  );

  useEffect(() => {
    setFormatted(formatDateWindowForZone(start, end));
  }, [start, end]);

  return <span suppressHydrationWarning>{formatted}</span>;
}
