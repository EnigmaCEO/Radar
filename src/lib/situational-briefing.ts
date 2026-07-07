import type { SceAlert } from "./sce-alerts";
import { normalizeSeverity, type CanonicalSeverity } from "./delivery-matching";

export interface SituationalBriefingMeta {
  window?: string;
  windowStart?: string;
  windowEnd?: string;
  generatedAt?: string;
}

export interface BriefingSeverityCount {
  severity: CanonicalSeverity;
  count: number;
}

export interface BriefingAffectedObject {
  alertId: string;
  label: string;
  displayName: string;
  severity: CanonicalSeverity;
  chain: string | null;
  asset: string | null;
  assetPair: string | null;
  route: string | null;
  poolName: string | null;
  thresholdName: string | null;
  observedValueLabel: string | null;
  thresholdValueLabel: string | null;
}

export interface BriefingSeverityBucket {
  severity: CanonicalSeverity;
  alertCount: number;
  severityMeaning: string;
  affectedObjects: BriefingAffectedObject[];
}

export interface BriefingGroup {
  key: string;
  title: string;
  clusterLabel: string;
  monitorType: string;
  provider: string;
  reasonCode: string;
  dominantSeverity: CanonicalSeverity;
  affectedCount: number;
  affectedObjects: BriefingAffectedObject[];
  severityBuckets: BriefingSeverityBucket[];
  whatHappened: string;
  whyItMatters: string;
  severityMeaning: string;
  evidenceNotes: string[];
  radarStatus: string;
  nextWatch: string;
  signalClasses: string[];
  alertIds: string[];
}

export interface SituationalBriefing {
  headline: string;
  windowSummary: string;
  countsBySeverity: BriefingSeverityCount[];
  situationSummary: string[];
  groups: BriefingGroup[];
  nextWatch: string[];
  footer: string;
  alertCount: number;
  groupCount: number;
  generatedAt: string;
  window: string | null;
  windowStart: string | null;
  windowEnd: string | null;
}

const SEVERITY_ORDER: CanonicalSeverity[] = ["critical", "warning", "watch", "info"];
const TELEGRAM_OBJECT_LIMIT = 6;
const GROUP_EVIDENCE_LIMIT = 4;
const DISCORD_AFFECTED_OBJECT_LIMIT = 6;

function firstString(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return null;
}

function dedupe(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const items: string[] = [];
  for (const value of values) {
    const trimmed = firstString(value);
    if (!trimmed) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    items.push(trimmed);
  }
  return items;
}

function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter((part) => part.length > 0)
    .map((part) => part[0].toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function formatProviderLabel(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) return "Unknown provider";
  if (/[A-Z]/.test(trimmed)) return trimmed;
  return titleCase(trimmed);
}

function reasonClusterLabel(reasonCode: string, monitorType: string): string {
  const normalizedReason = reasonCode.trim().toUpperCase();
  if (normalizedReason === "ORACLE_STALE") return "Oracle Freshness Cluster";
  if (normalizedReason === "ORACLE_REFERENCE_DEVIATION") return "Oracle Reference Deviation Cluster";
  if (normalizedReason === "LP_POOL_IMBALANCE") return "LP Imbalance Cluster";
  if (normalizedReason === "LP_POOL_READ_ERROR") return "LP Diagnostic Cluster";
  if (normalizedReason === "BRIDGE_ROUTE_LATENCY" || normalizedReason === "BRIDGE_ROUTE_DELAYED") {
    return "Bridge Route Latency Cluster";
  }
  if (normalizedReason === "BRIDGE_ROUTE_ERROR") return "Bridge Route Error Cluster";
  return `${titleCase(monitorType)} ${titleCase(reasonCode.replace(/^[A-Z]+_/, "").toLowerCase())} Cluster`;
}

function formatWindowSummary(meta?: SituationalBriefingMeta): string {
  if (!meta) return "Window: manual delivery";
  const windowLabel = meta.window ? `${meta.window} window` : "manual delivery";
  const range = [firstString(meta.windowStart), firstString(meta.windowEnd)].filter(Boolean).join(" to ");
  return range ? `Window: ${windowLabel} (${range})` : `Window: ${windowLabel}`;
}

function formatCountsBySeverity(alerts: SceAlert[]): BriefingSeverityCount[] {
  return SEVERITY_ORDER.map((severity) => ({
    severity,
    count: alerts.filter((alert) => normalizeSeverity(alert.severity) === severity).length,
  })).filter((entry) => entry.count > 0);
}

function sortBySeverityDesc(a: CanonicalSeverity, b: CanonicalSeverity): number {
  return SEVERITY_ORDER.indexOf(a) - SEVERITY_ORDER.indexOf(b);
}

function fallbackSeverityMeaning(alerts: SceAlert[], severity: CanonicalSeverity): string {
  const firstAlert = alerts[0];
  const reasonCode = firstAlert?.reasonCode?.toUpperCase() ?? "";
  const signalClass = firstAlert?.signalClass?.toLowerCase() ?? "";

  if (signalClass === "diagnostic" || reasonCode.includes("READ_ERROR")) {
    return "Diagnostic: Radar could not read the source cleanly. This is a monitoring diagnostic, not a market condition.";
  }
  if (reasonCode === "ORACLE_STALE" && severity === "warning") {
    return "Warning: the price feed has not refreshed on schedule and may be stale.";
  }
  if (reasonCode === "ORACLE_STALE" && severity === "critical") {
    return "Critical: the price feed is out of date; caution is advised until the feed updates.";
  }
  if (reasonCode === "LP_POOL_IMBALANCE" && severity === "warning") {
    return "Warning: the pool crossed Radar's balance-concentration watch threshold.";
  }
  if (severity === "critical") return "Critical: Radar is tracking a high-severity condition from SCE.";
  if (severity === "warning") return "Warning: Radar is tracking a condition that needs attention.";
  if (severity === "watch") return "Watch: Radar is tracking an early warning condition.";
  return "Info: Radar is tracking a low-severity update.";
}

function formatObjectLabel(alert: SceAlert): string {
  const primary = primaryObjectLabel(alert);
  const scopeParts = [
    alert.chain,
    primary !== alert.route ? alert.route : null,
    primary !== alert.poolName ? alert.poolName : null,
  ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);
  const thresholdLabel =
    firstString(alert.observedValueLabel, alert.thresholdValueLabel)
      ? `${(alert.observedValueLabel ?? "-").replace(/^Observed\s+/i, "")} vs ${(alert.thresholdValueLabel ?? "-").replace(/^Threshold:\s*/i, "")}`
      : null;
  return [primary, scopeParts.join(" / "), thresholdLabel ? `(${thresholdLabel})` : null]
    .filter((value): value is string => value !== null && value.length > 0)
    .join(" - ");
}

function primaryObjectLabel(alert: SceAlert): string {
  return firstString(alert.assetPair, alert.asset, alert.route, alert.poolName, alert.objectId) ?? alert.id;
}

function cleanObservedValueLabel(value: string | null): string | null {
  const trimmed = firstString(value);
  if (!trimmed) return null;
  const withoutObserved = trimmed.replace(/^Observed\s+/i, "").trim();
  return withoutObserved.replace(/:\s*/g, " ").trim();
}

function cleanThresholdValueLabel(value: string | null): string | null {
  const trimmed = firstString(value);
  if (!trimmed) return null;
  return trimmed.replace(/^Threshold:\s*/i, "").trim();
}

function cleanThresholdName(value: string | null): string | null {
  const trimmed = firstString(value);
  if (!trimmed) return null;
  const normalized = trimmed.replace(/[_-]+/g, " ").trim().toLowerCase();
  const thresholdNamed = normalized.includes("threshold")
    ? normalized
    : normalized.replace(/^(critical|warning|watch|info)\s+after\b.*$/, "$1 threshold");
  return thresholdNamed === normalized && !thresholdNamed.includes("threshold")
    ? `${thresholdNamed} threshold`
    : thresholdNamed;
}

function formatTelegramAffectedObject(object: BriefingAffectedObject): string {
  const parts = [object.displayName];
  if (object.chain) parts.push(object.chain);

  const observed = cleanObservedValueLabel(object.observedValueLabel);
  if (observed) parts.push(observed);

  const thresholdValue = cleanThresholdValueLabel(object.thresholdValueLabel);
  const thresholdName = cleanThresholdName(object.thresholdName);
  if (thresholdValue && thresholdName) {
    parts.push(`breached ${thresholdName} ${thresholdValue}`);
  } else if (thresholdValue) {
    parts.push(`threshold ${thresholdValue}`);
  }

  return parts.join(" | ");
}

function buildAffectedObject(alert: SceAlert): BriefingAffectedObject {
  const displayName = primaryObjectLabel(alert);
  return {
    alertId: alert.id,
    label: formatObjectLabel(alert),
    displayName,
    severity: normalizeSeverity(alert.severity),
    chain: alert.chain,
    asset: alert.asset,
    assetPair: alert.assetPair ?? null,
    route: alert.route,
    poolName: alert.poolName ?? null,
    thresholdName: alert.thresholdName ?? null,
    observedValueLabel: alert.observedValueLabel ?? null,
    thresholdValueLabel: alert.thresholdValueLabel ?? null,
  };
}

function formatSeverityCountLine(counts: BriefingSeverityCount[]): string {
  return counts.map((entry) => `${titleCase(entry.severity)}: ${entry.count}`).join(", ");
}

function buildSeverityBuckets(alerts: SceAlert[]): BriefingSeverityBucket[] {
  return SEVERITY_ORDER.map((severity) => {
    const matches = alerts.filter((alert) => normalizeSeverity(alert.severity) === severity);
    if (matches.length === 0) return null;
    return {
      severity,
      alertCount: matches.length,
      severityMeaning:
        firstString(...matches.map((alert) => alert.severityExplanation)) ??
        fallbackSeverityMeaning(matches, severity),
      affectedObjects: matches
        .map(buildAffectedObject)
        .sort((a, b) => a.label.localeCompare(b.label)),
    };
  }).filter((bucket): bucket is BriefingSeverityBucket => bucket !== null);
}

function summarizeSituation(groups: BriefingGroup[]): string[] {
  return dedupe(
    groups.flatMap((group) => [group.whyItMatters, group.whatHappened]).slice(0, 6),
  ).slice(0, 4);
}

function summarizeNextWatch(groups: BriefingGroup[]): string[] {
  const items = dedupe(groups.map((group) => group.nextWatch));
  return items.length > 0 ? items : ["No additional next-watch guidance was provided by SCE."];
}

function buildEvidenceNotes(alerts: SceAlert[]): string[] {
  const notes: string[] = [];
  for (const alert of alerts) {
    const candidates = [
      alert.thresholdExplanation,
      alert.evidenceExplanation,
      alert.evidenceSummary,
      firstString(alert.observedValueLabel, alert.thresholdValueLabel)
        ? `Observed vs threshold: ${(alert.observedValueLabel ?? "-").replace(/^Observed\s+/i, "")} vs ${(alert.thresholdValueLabel ?? "-").replace(/^Threshold:\s*/i, "")}`
        : null,
    ];
    for (const candidate of candidates) {
      const note = firstString(candidate);
      if (!note || notes.includes(note)) continue;
      notes.push(note);
      if (notes.length >= GROUP_EVIDENCE_LIMIT) return notes;
    }
  }
  return notes;
}

function formatAffectedObjectsPreview(objects: BriefingAffectedObject[], limit: number): string {
  const lines = objects.slice(0, limit).map((object) => object.label);
  const extraCount = objects.length - lines.length;
  if (extraCount > 0) lines.push(`+ ${extraCount} more affected object${extraCount === 1 ? "" : "s"}`);
  return lines.join("\n") || "n/a";
}

export function buildSituationalBriefing(
  alerts: SceAlert[],
  meta?: SituationalBriefingMeta,
): SituationalBriefing {
  const generatedAt = meta?.generatedAt ?? new Date().toISOString();
  const grouped = new Map<string, SceAlert[]>();

  for (const alert of alerts) {
    const key = [
      alert.monitorType.trim().toLowerCase(),
      alert.provider.trim().toLowerCase(),
      alert.reasonCode.trim().toUpperCase(),
    ].join("|");
    grouped.set(key, [...(grouped.get(key) ?? []), alert]);
  }

  const groups = Array.from(grouped.entries())
    .map(([key, groupAlerts]) => {
      const firstAlert = groupAlerts[0];
      const severityBuckets = buildSeverityBuckets(groupAlerts);
      const dominantSeverity = severityBuckets[0]?.severity ?? "info";
      const clusterLabel = reasonClusterLabel(firstAlert.reasonCode, firstAlert.monitorType);
      const title = `${clusterLabel} - ${formatProviderLabel(firstString(firstAlert.provider, titleCase(firstAlert.monitorType)) ?? "provider")}`;
      const affectedObjects = groupAlerts
        .map(buildAffectedObject)
        .sort((a, b) => sortBySeverityDesc(a.severity, b.severity) || a.label.localeCompare(b.label));

      return {
        key,
        title,
        clusterLabel,
        monitorType: firstAlert.monitorType,
        provider: firstAlert.provider,
        reasonCode: firstAlert.reasonCode,
        dominantSeverity,
        affectedCount: groupAlerts.length,
        affectedObjects,
        severityBuckets,
        whatHappened:
          firstString(...groupAlerts.map((alert) => alert.whatHappened)) ??
          firstString(...groupAlerts.map((alert) => alert.summary)) ??
          "SCE reported a grouped Radar alert update.",
        whyItMatters:
          firstString(...groupAlerts.map((alert) => alert.whyItMatters)) ??
          firstString(...groupAlerts.map((alert) => alert.humanRiskSummary)) ??
          "SCE did not provide additional impact text for this group.",
        severityMeaning:
          firstString(...groupAlerts.map((alert) => alert.severityExplanation)) ??
          fallbackSeverityMeaning(groupAlerts, dominantSeverity),
        evidenceNotes: buildEvidenceNotes(groupAlerts),
        radarStatus:
          firstString(...groupAlerts.map((alert) => alert.radarStatus)) ??
          "Monitoring active alert resolution state.",
        nextWatch:
          firstString(...groupAlerts.map((alert) => alert.nextWatch)) ??
          "Watching for alert updates and resolution state.",
        signalClasses: dedupe(groupAlerts.map((alert) => alert.signalClass)),
        alertIds: groupAlerts.map((alert) => alert.id).sort((a, b) => a.localeCompare(b)),
      } satisfies BriefingGroup;
    })
    .sort((a, b) => {
      return (
        sortBySeverityDesc(a.dominantSeverity, b.dominantSeverity) ||
        b.affectedCount - a.affectedCount ||
        a.title.localeCompare(b.title)
      );
    });

  return {
    headline: `SCE Radar brief - ${alerts.length} alert${alerts.length === 1 ? "" : "s"} across ${groups.length} group${groups.length === 1 ? "" : "s"}`,
    windowSummary: formatWindowSummary(meta),
    countsBySeverity: formatCountsBySeverity(alerts),
    situationSummary: summarizeSituation(groups),
    groups,
    nextWatch: summarizeNextWatch(groups),
    footer: "Source: radar.sagitta.systems",
    alertCount: alerts.length,
    groupCount: groups.length,
    generatedAt,
    window: meta?.window ?? null,
    windowStart: meta?.windowStart ?? null,
    windowEnd: meta?.windowEnd ?? null,
  };
}

export function buildSituationalBriefingTelegramText(
  alerts: SceAlert[],
  meta?: SituationalBriefingMeta,
): string {
  const briefing = buildSituationalBriefing(alerts, meta);
  const lines: string[] = [
    meta?.window ? `SCE Radar brief - ${meta.window} window` : "SCE Radar brief",
    "",
    formatSeverityCountLine(briefing.countsBySeverity),
    "",
  ];

  for (const group of briefing.groups) {
    lines.push(group.title);
    lines.push(`Impact: ${group.whyItMatters}`);
    for (const bucket of group.severityBuckets) {
      lines.push(`${titleCase(bucket.severity)} (${bucket.alertCount})`);
      const objects = bucket.affectedObjects.slice(0, TELEGRAM_OBJECT_LIMIT);
      lines.push(...objects.map((object) => `- ${formatTelegramAffectedObject(object)}`));
      if (bucket.affectedObjects.length > objects.length) {
        lines.push(`- plus ${bucket.affectedObjects.length - objects.length} more`);
      }
    }
    lines.push(`Status: ${group.radarStatus}`);
    lines.push(`Next: ${group.nextWatch}`);
    lines.push("");
  }

  lines.push(briefing.footer);

  return lines.join("\n");
}

export function buildSituationalBriefingDiscordEmbeds(
  alerts: SceAlert[],
  meta?: SituationalBriefingMeta,
): Array<Record<string, unknown>> {
  const briefing = buildSituationalBriefing(alerts, meta);
  const embeds: Array<Record<string, unknown>> = [
    {
      title: "Radar situational briefing",
      description: [briefing.headline, briefing.windowSummary].join("\n"),
      fields: [
        {
          name: "Counts by severity",
          value: formatSeverityCountLine(briefing.countsBySeverity) || "none",
          inline: false,
        },
        {
          name: "Situation summary",
          value: briefing.situationSummary.join("\n") || "No situation summary provided.",
          inline: false,
        },
        {
          name: "Next watch",
          value: briefing.nextWatch.join("\n"),
          inline: false,
        },
      ],
      footer: { text: briefing.footer.replace("Source: ", "") },
      timestamp: briefing.generatedAt,
    },
  ];

  for (const group of briefing.groups.slice(0, 9)) {
    embeds.push({
      title: group.title,
      description: group.whatHappened,
      fields: [
        { name: "Severity", value: titleCase(group.dominantSeverity), inline: true },
        { name: "Affected", value: String(group.affectedCount), inline: true },
        { name: "Reason", value: group.reasonCode, inline: true },
        {
          name: "Affected objects",
          value: formatAffectedObjectsPreview(group.affectedObjects, DISCORD_AFFECTED_OBJECT_LIMIT).slice(0, 1024) || "n/a",
          inline: false,
        },
        { name: "Why it matters", value: group.whyItMatters.slice(0, 1024), inline: false },
        { name: "Severity meaning", value: group.severityMeaning.slice(0, 1024), inline: false },
        {
          name: "Evidence",
          value: (group.evidenceNotes.map((note) => `- ${note}`).join("\n") || "No evidence notes provided.").slice(0, 1024),
          inline: false,
        },
        { name: "Radar status", value: group.radarStatus.slice(0, 1024), inline: false },
        { name: "Next watch", value: group.nextWatch.slice(0, 1024), inline: false },
      ],
      footer: { text: briefing.footer.replace("Source: ", "") },
      timestamp: briefing.generatedAt,
    });
  }

  return embeds;
}
