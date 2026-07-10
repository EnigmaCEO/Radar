type AlertClassificationInput = {
  signalClass?: string | null;
  reasonCode: string;
  summary: string;
  openedAt?: string | null;
  createdAt: string;
  coverageTier?: string | null;
};

export type CoverageGapTier = "unresolved" | "coverage_warning" | "coverage_critical";

function elapsedHours(start: string, now: Date): number {
  const startTime = new Date(start).getTime();
  if (!Number.isFinite(startTime)) return 0;
  return Math.max(0, (now.getTime() - startTime) / (60 * 60 * 1000));
}

export function isCoverageGapAlert(alert: AlertClassificationInput): boolean {
  const signalClass = alert.signalClass?.trim().toLowerCase();
  if (signalClass === "coverage" || signalClass === "diagnostic") return true;

  const reasonCode = alert.reasonCode.trim().toUpperCase();
  if (reasonCode.includes("READ_ERROR")) return true;

  return alert.summary.toLowerCase().includes("source unavailable");
}

export function getCoverageGapTier(
  alert: AlertClassificationInput,
  now: Date = new Date(),
): CoverageGapTier {
  const explicitTier = alert.coverageTier?.trim().toLowerCase();
  if (
    explicitTier === "unresolved" ||
    explicitTier === "coverage_warning" ||
    explicitTier === "coverage_critical"
  ) {
    return explicitTier;
  }

  const openedAt = alert.openedAt ?? alert.createdAt;
  const hours = elapsedHours(openedAt, now);
  if (hours >= 6) return "coverage_critical";
  if (hours >= 3) return "coverage_warning";
  return "unresolved";
}

export function coverageGapBadgeLabel(tier: CoverageGapTier): string {
  if (tier === "coverage_critical") return "coverage critical";
  if (tier === "coverage_warning") return "coverage warning";
  return "unresolved";
}

export function humanizeReasonCode(reasonCode: string): string {
  return reasonCode
    .trim()
    .toLowerCase()
    .replace(/_/g, " ");
}
