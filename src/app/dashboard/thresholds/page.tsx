"use client";

import { useEffect, useMemo, useState } from "react";
import { getRadarThresholds } from "@/lib/api";
import type {
  SceThresholdItem,
  SceThresholdMonitorType,
  SceThresholdResponse,
} from "@/lib/sce-threshold-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { LocalDateTime } from "@/components/local-time";

// ── Formatting helpers ───────────────────────────────────────────────────────

const MONITOR_TYPE_ORDER: SceThresholdMonitorType[] = [
  "oracle",
  "oracle_reference",
  "bridge",
  "lp",
];

const MONITOR_TYPE_LABEL: Record<SceThresholdMonitorType, string> = {
  oracle: "Oracle feeds",
  oracle_reference: "Oracle reference-deviation groups",
  bridge: "Bridge routes",
  lp: "LP pools",
};

// Per-monitor provenance note (Radar Alert Threshold Doctrine v1.0). Oracle
// thresholds are derived from each feed's declared heartbeat; bridge and LP
// thresholds are Radar-calibrated from observed distributions and are NOT
// official protocol health thresholds.
const MONITOR_TYPE_NOTE: Record<SceThresholdMonitorType, string> = {
  oracle:
    "Derived from each feed's declared heartbeat: watch = heartbeat × 1.00, warning = heartbeat × 1.25, critical = heartbeat × 2.00.",
  oracle_reference:
    "Basis-point deviation bands anchored to each feed's on-chain deviation threshold. Stablecoin critical bands double as de-peg signals.",
  bridge:
    "Radar-calibrated from observed settlement distributions (warning ≈ p95, critical ≈ p99) — not official protocol health thresholds.",
  lp:
    "Radar-calibrated from observed distributions (warning ≈ p95, critical ≈ p99) — not official protocol health thresholds. Imbalance means an object crossed Radar's balance-concentration watch threshold, not that the pool is unhealthy.",
};

function formatSeconds(value: number): string {
  if (value < 60) return `${value}s`;
  if (value < 3600) {
    const m = value / 60;
    return Number.isInteger(m) ? `${m}m` : `${m.toFixed(1)}m`;
  }
  const h = value / 3600;
  return Number.isInteger(h) ? `${h}h` : `${h.toFixed(1)}h`;
}

function formatThresholdValue(value: number | null | undefined, unit: string): string {
  if (value === null || value === undefined) return "—";
  if (unit === "bps") return `${value} bps`;
  // "seconds" and "mixed" both use seconds for the primary watch/warning/critical
  // columns; object-specific bps/pct thresholds live in extraThresholds.
  return formatSeconds(value);
}

function humanizeKey(key: string): string {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/Bps\b/, "(bps)")
    .replace(/Pct\b/, "(%)")
    .replace(/Url\b/, "URL")
    .replace(/Seconds\b/, "(s)");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function formatExtraValue(key: string, value: number | string | boolean | null): string {
  if (value === null) return "—";
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "number") {
    if (/Bps$/.test(key)) return `${value} bps`;
    if (/Pct$/.test(key)) return `${value}%`;
    if (/Seconds$/.test(key)) return formatSeconds(value);
    return String(value);
  }
  return value;
}

function isUrl(value: unknown): value is string {
  return typeof value === "string" && /^https?:\/\//.test(value);
}

function locationLabel(item: SceThresholdItem): string {
  if (item.sourceChain || item.destinationChain) {
    return `${item.sourceChain ?? "?"} → ${item.destinationChain ?? "?"}`;
  }
  return item.chain ?? "Global";
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ThresholdsPage() {
  const [data, setData] = useState<SceThresholdResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [monitorFilter, setMonitorFilter] = useState<"all" | SceThresholdMonitorType>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    getRadarThresholds()
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setError("Unable to load thresholds. You may not have access to this data.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredItems = useMemo(() => {
    if (!data) return [];
    const query = search.trim().toLowerCase();
    return data.items.filter((item) => {
      if (monitorFilter !== "all" && item.monitorType !== monitorFilter) return false;
      if (!query) return true;
      return (
        item.displayName.toLowerCase().includes(query) ||
        item.provider.toLowerCase().includes(query) ||
        (item.assetPair ?? "").toLowerCase().includes(query) ||
        (item.asset ?? "").toLowerCase().includes(query) ||
        locationLabel(item).toLowerCase().includes(query)
      );
    });
  }, [data, monitorFilter, search]);

  const grouped = useMemo(() => {
    const groups = new Map<SceThresholdMonitorType, SceThresholdItem[]>();
    for (const item of filteredItems) {
      const list = groups.get(item.monitorType) ?? [];
      list.push(item);
      groups.set(item.monitorType, list);
    }
    return MONITOR_TYPE_ORDER.filter((type) => groups.has(type)).map((type) => ({
      type,
      items: groups.get(type)!,
    }));
  }, [filteredItems]);

  if (loading) return <div className="text-sm text-muted-foreground">Loading thresholds...</div>;

  if (error) {
    return (
      <div className="max-w-5xl">
        <h1 className="text-2xl font-bold tracking-tight">Alert thresholds</h1>
        <Card className="mt-6 border-border/60">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">{error}</CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Alert thresholds</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The baseline and watch / warning / critical thresholds Radar applies to every monitored
          object. Last generated{" "}
          <LocalDateTime value={data.generatedAt} preset="compact" />.
        </p>
      </div>

      <Card className="border-border/60 bg-muted/30">
        <CardContent className="space-y-3 px-4 py-4 text-sm text-muted-foreground">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-foreground">How Radar sets these thresholds</p>
            <Badge variant="outline">oracle-monitor-v1.0</Badge>
          </div>
          <div className="grid gap-1.5">
            <ThresholdLegend tone="watch" label="Watch" desc="feed reached its declared heartbeat — a monitoring tripwire, not yet degraded." />
            <ThresholdLegend tone="warning" label="Warning" desc="feed age exceeded heartbeat × 1.25 — degradation is forming." />
            <ThresholdLegend tone="critical" label="Critical" desc="feed age exceeded heartbeat × 2.00 — materially overdue or outside the acceptable envelope." />
            <ThresholdLegend tone="resolved" label="Resolved" desc="feed refreshed back below the active threshold." />
          </div>
          <p>
            Oracle freshness thresholds are derived from each feed&apos;s declared heartbeat, so a
            healthy feed that updates a little after its heartbeat enters Watch rather than an
            immediate Warning. Bridge and LP thresholds are Radar-calibrated from observed
            distributions (warning ≈ p95, critical ≈ p99) and are not official protocol health
            thresholds.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryCard label="Total objects" value={data.summary.totalItems} />
        <SummaryCard label="Oracle feeds" value={data.summary.oracleFeedItems} />
        <SummaryCard label="Reference groups" value={data.summary.oracleReferenceGroupItems} />
        <SummaryCard label="Bridge routes" value={data.summary.bridgeRouteItems} />
        <SummaryCard label="LP pools" value={data.summary.lpPoolItems} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Label htmlFor="threshold-search">Search</Label>
          <Input
            id="threshold-search"
            placeholder="Filter by name, provider, asset, or chain"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="sm:w-64">
          <Label htmlFor="threshold-monitor">Monitor type</Label>
          <Select
            id="threshold-monitor"
            value={monitorFilter}
            onChange={(e) => setMonitorFilter(e.target.value as "all" | SceThresholdMonitorType)}
          >
            <option value="all">All monitor types</option>
            {MONITOR_TYPE_ORDER.map((type) => (
              <option key={type} value={type}>
                {MONITOR_TYPE_LABEL[type]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {grouped.length === 0 ? (
        <Card className="border-border/60">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No objects match your filters.
          </CardContent>
        </Card>
      ) : (
        grouped.map((group) => (
          <ThresholdGroup key={group.type} type={group.type} items={group.items} />
        ))
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

function ThresholdGroup({
  type,
  items,
}: {
  type: SceThresholdMonitorType;
  items: SceThresholdItem[];
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <h2 className="font-semibold">{MONITOR_TYPE_LABEL[type]}</h2>
        <Badge variant="secondary">{items.length}</Badge>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">{MONITOR_TYPE_NOTE[type]}</p>
      <div className="space-y-3">
        {items.map((item) => (
          <ThresholdRow key={`${item.objectType}:${item.objectId}`} item={item} />
        ))}
      </div>
    </div>
  );
}

function ThresholdRow({ item }: { item: SceThresholdItem }) {
  const extras = Object.entries(item.extraThresholds).filter(
    ([, value]) => value !== null && value !== undefined && value !== "",
  );

  return (
    <Card className="border-border/60">
      <CardContent className="space-y-3 px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{item.displayName}</p>
            <p className="text-xs text-muted-foreground">
              {item.provider} · {locationLabel(item)}
              {item.assetPair ? ` · ${item.assetPair}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {item.purpose && <Badge variant="outline">{item.purpose.replace(/_/g, " ")}</Badge>}
            <VerificationBadge item={item} />
            <Badge variant="secondary">{item.status.replace(/_/g, " ")}</Badge>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <ThresholdStat
            label={item.expectedBaselineLabel ?? "baseline"}
            value={formatThresholdValue(item.expectedBaselineValue, item.thresholdUnit)}
          />
          <ThresholdStat
            label="watch"
            tone="watch"
            value={formatThresholdValue(item.watchThresholdValue, item.thresholdUnit)}
          />
          <ThresholdStat
            label="warning"
            tone="warning"
            value={formatThresholdValue(item.warningThresholdValue, item.thresholdUnit)}
          />
          <ThresholdStat
            label="critical"
            tone="critical"
            value={formatThresholdValue(item.criticalThresholdValue, item.thresholdUnit)}
          />
        </div>

        {extras.length > 0 && (
          <div className="flex flex-wrap gap-1.5 border-t border-border/40 pt-3">
            {extras.map(([key, value]) => (
              <span
                key={key}
                className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
              >
                <span className="font-medium text-foreground/80">{humanizeKey(key)}:</span>{" "}
                {isUrl(value) ? (
                  <a
                    href={value}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    source
                  </a>
                ) : (
                  formatExtraValue(key, value)
                )}
              </span>
            ))}
          </div>
        )}

        {(item.notes || item.officialSourceUrl || item.doctrineClass) && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {item.doctrineClass && <span>doctrine: {item.doctrineClass.replace(/_/g, " ")}</span>}
            {item.officialSourceUrl && (
              <a
                href={item.officialSourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                official source
              </a>
            )}
            {item.notes && <span className="italic">{item.notes}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type ThresholdTone = "watch" | "warning" | "critical" | "resolved";

const TONE_TEXT_CLASS: Record<ThresholdTone, string> = {
  watch: "text-blue-500",
  warning: "text-orange-500",
  critical: "text-red-500",
  resolved: "text-green-500",
};

const TONE_DOT_CLASS: Record<ThresholdTone, string> = {
  watch: "bg-blue-500",
  warning: "bg-orange-500",
  critical: "bg-red-500",
  resolved: "bg-green-500",
};

function ThresholdLegend({
  tone,
  label,
  desc,
}: {
  tone: ThresholdTone;
  label: string;
  desc: string;
}) {
  return (
    <p className="flex items-start gap-2">
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${TONE_DOT_CLASS[tone]}`} />
      <span>
        <span className="font-medium text-foreground">{label}</span> — {desc}
      </span>
    </p>
  );
}

// Doctrine §4: "verified" is not docs-only. Only badge an object as verified
// when its official metadata status says so AND an official source URL backs it;
// otherwise surface the honest state (unverified / internal / diagnostic).
function VerificationBadge({ item }: { item: SceThresholdItem }) {
  const status = item.officialMetadataStatus?.trim().toLowerCase() ?? null;
  if (!status) return null;

  const isVerified = status === "verified" && Boolean(item.officialSourceUrl);
  if (isVerified) {
    return <Badge variant="resolved">verified</Badge>;
  }

  const label = status === "verified" ? "unverified" : status.replace(/_/g, " ");
  return <Badge variant="outline">{label}</Badge>;
}

function ThresholdStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: ThresholdTone;
}) {
  const toneClass = tone ? TONE_TEXT_CLASS[tone] : "text-foreground";
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-sm font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}
