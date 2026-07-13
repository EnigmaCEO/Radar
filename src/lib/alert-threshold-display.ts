function toTitleCase(value: string): string {
  return value
    .split(" ")
    .filter((part) => part.length > 0)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

export function cleanThresholdValueLabel(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return trimmed.replace(/^Threshold:\s*/i, "").trim();
}

export function humanizeThresholdRule(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase().replace(/[_-]+/g, " ");
  if (normalized.length === 0) return null;

  if (normalized === "watch after seconds") return "Watch threshold";
  if (normalized === "warning after seconds") return "Warning threshold";
  if (normalized === "critical after seconds") return "Critical threshold";
  if (normalized === "post heartbeat critical escalation threshold") {
    return "Critical escalation threshold";
  }
  if (normalized === "post heartbeat warning escalation threshold") {
    return "Warning escalation threshold";
  }

  return toTitleCase(normalized);
}

export function formatThresholdValueWithRule(input: {
  thresholdValueLabel?: string | null;
  thresholdName?: string | null;
  appliedThresholdKind?: string | null;
}): string | null {
  const value = cleanThresholdValueLabel(input.thresholdValueLabel);
  const rule =
    humanizeThresholdRule(input.thresholdName) ??
    humanizeThresholdRule(input.appliedThresholdKind);

  if (!value) return null;
  if (!rule) return `Threshold: ${value}`;
  return `${rule}: ${value}`;
}
