"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Pencil, Plus, ToggleLeft, ToggleRight, Trash2 } from "lucide-react";
import { useAccount } from "@/lib/account-context";
import {
  allowsPrivateWatchlists,
  getPlanLabel,
  getWatchlistLimit,
  resolvePlan,
} from "@/lib/plan-limits";
import type { SceCatalogObject, SceCatalogResponse, SceMonitorType } from "@/lib/sce-catalog-types";
import {
  OBJECT_PICKER_MONITOR_TYPE_ORDER,
  filterObjectsForPicker,
  groupObjectsByMonitorType,
} from "@/lib/watchlist-object-picker";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Watchlist {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  matchMode: string;
  minSeverity: string;
  signalClasses: string[];
  monitorTypes: string[];
  providers: string[];
  chains: string[];
  assets: string[];
  objectIds: string[];
  tags: string[];
  purposes: string[];
  statuses: string[];
  createdAt: string;
}

const MONITOR_TYPE_LABEL: Record<string, string> = {
  oracle: "Oracle",
  bridge: "Bridge",
  lp: "LP",
};

function formatLabel(value: string): string {
  return value.replace(/_/g, " ");
}

const SIGNAL_CLASS_LABEL: Record<string, string> = {
  alert: "Alert",
  warning: "Warning",
  watch: "Watch",
  coverage: "Coverage",
};

const MATCH_MODE_COLORS: Record<string, string> = {
  any: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  all: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
};

// ── Coverage computation (mirrors backend watchlist-coverage.ts) ─────────────────

const OBJECT_FILTER_KEYS = [
  "monitorTypes",
  "providers",
  "chains",
  "assets",
  "objectIds",
  "tags",
  "purposes",
] as const;

interface CoverageSelection {
  matchMode: "any" | "all";
  monitorTypes: string[];
  providers: string[];
  chains: string[];
  assets: string[];
  objectIds: string[];
  tags: string[];
  purposes: string[];
}

function ciEquals(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function includesCi(values: string[], candidate: string | null): boolean {
  return candidate !== null && values.some((value) => ciEquals(value, candidate));
}

function objectMatchesDimension(
  key: (typeof OBJECT_FILTER_KEYS)[number],
  values: string[],
  object: SceCatalogObject,
): boolean {
  switch (key) {
    case "monitorTypes":
      return includesCi(values, object.monitorType);
    case "providers":
      return includesCi(values, object.provider);
    case "chains":
      return includesCi(values, object.chain);
    case "assets":
      return includesCi(values, object.asset ?? object.assetPair);
    case "objectIds":
      return values.includes(object.id);
    case "tags":
      return object.tags.some((tag) => includesCi(values, tag));
    case "purposes":
      return includesCi(values, object.purpose);
  }
}

// The set of catalog objects a selection resolves to. Unlike the backend (where an
// empty selection means "match all"), the builder treats an empty selection as
// covering nothing — a watchlist is opt-in per object, so coverage counts up from 0.
function computeCoveredObjectIds(
  selection: CoverageSelection,
  objects: SceCatalogObject[],
): Set<string> {
  const activeFilters = OBJECT_FILTER_KEYS.map((key) => ({ key, values: selection[key] })).filter(
    ({ values }) => values.length > 0,
  );
  if (activeFilters.length === 0) return new Set();

  const matched = objects.filter((object) => {
    const dimensions = activeFilters.map(({ key, values }) =>
      objectMatchesDimension(key, values, object),
    );
    return selection.matchMode === "all"
      ? dimensions.every(Boolean)
      : dimensions.some(Boolean);
  });
  return new Set(matched.map((object) => object.id));
}

// ── Checklist helper ───────────────────────────────────────────────────────────

function Checklist({
  label,
  options,
  labels,
  selected,
  onChange,
  disabled,
  lockUnselected,
}: {
  label: string;
  options: string[];
  labels?: Record<string, string>;
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  lockUnselected?: boolean;
}) {
  if (options.length === 0) return null;
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = selected.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              disabled={disabled || (lockUnselected && !active)}
              onClick={() =>
                onChange(active ? selected.filter((s) => s !== opt) : [...selected, opt])
              }
              className={`rounded-full border px-2.5 py-1 text-xs transition-colors disabled:opacity-50 ${
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              {labels?.[opt] ?? opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Object picker ──────────────────────────────────────────────────────────────

function ObjectPicker({
  objects,
  selectedMonitorTypes,
  selected,
  onChange,
  disabled,
  lockUnselected,
}: {
  objects: SceCatalogObject[];
  selectedMonitorTypes: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  lockUnselected?: boolean;
}) {
  const [viewGroup, setViewGroup] = useState<"all" | SceMonitorType>("all");

  // A row is locked when the plan's object limit is reached and it is not already
  // selected — you can still deselect to free capacity, but not add more.
  const isRowLocked = (id: string) => Boolean(lockUnselected) && !selected.includes(id);

  function toggle(id: string) {
    if (isRowLocked(id)) return;
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  }

  if (objects.length === 0) {
    return (
      <div className="space-y-2">
        <Label>Specific catalog objects (optional)</Label>
        <p className="text-xs text-muted-foreground">No catalog objects returned from SCE.</p>
      </div>
    );
  }

  const visible = filterObjectsForPicker(objects, selectedMonitorTypes);
  const groups = groupObjectsByMonitorType(visible);
  const groupsToRender =
    viewGroup === "all" ? OBJECT_PICKER_MONITOR_TYPE_ORDER : [viewGroup];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Label>Specific catalog objects (optional)</Label>
        <div className="flex items-center gap-3">
          {selected.length > 0 && (
            <span className="text-xs text-muted-foreground">{selected.length} selected</span>
          )}
          <Select
            value={viewGroup}
            onChange={(e) => setViewGroup(e.target.value as "all" | SceMonitorType)}
            disabled={disabled}
            className="h-7 w-40 text-xs"
            aria-label="Filter object table by type"
          >
            <option value="all">All types ({visible.length})</option>
            {OBJECT_PICKER_MONITOR_TYPE_ORDER.map((group) => (
              <option key={group} value={group}>
                {MONITOR_TYPE_LABEL[group]} ({groups[group].length})
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="max-h-80 overflow-x-auto overflow-y-auto rounded-md border border-border/60">
        <table className="min-w-[980px] w-full table-fixed border-collapse text-xs">
          <colgroup>
            <col className="w-8" />
            <col className="w-[36%]" />
            <col className="w-[14%]" />
            <col className="w-[12%]" />
            <col className="w-[14%]" />
            <col className="w-[14%]" />
            <col className="w-[10%]" />
          </colgroup>
          <thead className="sticky top-0 bg-background">
            <tr className="border-b border-border/60 text-left text-muted-foreground">
              <th className="px-2 py-1.5" />
              <th className="px-2 py-1.5 font-medium">Name</th>
              <th className="px-2 py-1.5 font-medium">Provider</th>
              <th className="px-2 py-1.5 font-medium">Chain</th>
              <th className="px-2 py-1.5 font-medium">Asset / pair</th>
              <th className="px-2 py-1.5 font-medium">Capabilities</th>
              <th className="px-2 py-1.5 font-medium">Tier</th>
            </tr>
          </thead>
          <tbody>
            {groupsToRender.flatMap((group) => {
              const items = groups[group];
              if (items.length === 0) return [];
              return [
                <tr key={`${group}-header`} className="bg-muted/40">
                  <td colSpan={7} className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {MONITOR_TYPE_LABEL[group]} ({items.length})
                  </td>
                </tr>,
                ...items.map((o) => {
                  const locked = isRowLocked(o.id);
                  return (
                  <tr
                    key={o.id}
                    onClick={() => toggle(o.id)}
                    className={`border-b border-border/30 last:border-b-0 ${
                      locked ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-muted/50"
                    }`}
                  >
                    <td className="px-2 py-1.5 align-top">
                      <input
                        type="checkbox"
                        checked={selected.includes(o.id)}
                        onChange={() => toggle(o.id)}
                        onClick={(e) => e.stopPropagation()}
                        disabled={disabled || locked}
                      />
                    </td>
                    <td className="truncate px-2 py-1.5 align-top font-medium" title={o.displayName}>
                      {o.displayName}
                    </td>
                    <td className="truncate px-2 py-1.5 align-top text-muted-foreground" title={o.provider}>
                      {o.provider}
                    </td>
                    <td className="truncate px-2 py-1.5 align-top text-muted-foreground" title={o.chain}>
                      {o.chain}
                    </td>
                    <td
                      className="truncate px-2 py-1.5 align-top text-muted-foreground"
                      title={o.assetPair ?? o.asset ?? o.route ?? o.pool ?? ""}
                    >
                      {o.assetPair ?? o.asset ?? o.route ?? o.pool ?? "—"}
                    </td>
                    <td className="px-1.5 py-1.5 align-top">
                      <div className="flex flex-nowrap items-start gap-1">
                        {o.canAlert && <Badge variant="watch" className="whitespace-nowrap px-1.5 py-0 text-[10px]">alertable</Badge>}
                        {o.canWatch && <Badge variant="secondary" className="whitespace-nowrap px-1.5 py-0 text-[10px]">watchable</Badge>}
                      </div>
                    </td>
                    <td className="px-1.5 py-1.5 align-top">
                      {o.commercialValue && (
                        <Badge variant="outline" className="whitespace-nowrap px-1.5 py-0 text-[10px]">
                          {formatLabel(o.commercialValue)}
                        </Badge>
                      )}
                    </td>
                  </tr>
                  );
                }),
              ];
            })}
          </tbody>
        </table>
        {visible.length === 0 ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">
            No catalog objects match the selected monitor types.
          </p>
        ) : (
          groupsToRender.every((g) => groups[g].length === 0) && (
            <p className="px-2 py-3 text-xs text-muted-foreground">
              No catalog objects for this type.
            </p>
          )
        )}
      </div>
    </div>
  );
}

// ── Watchlist card ─────────────────────────────────────────────────────────────

function WatchlistCard({
  watchlist,
  catalog,
  onDelete,
  onToggle,
  onUpdate,
}: {
  watchlist: Watchlist;
  catalog: SceCatalogResponse | null;
  onDelete: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
  onUpdate: (updated: Watchlist) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [editing, setEditing] = useState(false);

  async function handleDelete() {
    if (!confirm("Delete this watchlist?")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/watchlists/${watchlist.id}`, { method: "DELETE" });
      if (res.ok) onDelete(watchlist.id);
    } finally {
      setDeleting(false);
    }
  }

  async function handleToggle() {
    setToggling(true);
    try {
      const res = await fetch(`/api/watchlists/${watchlist.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !watchlist.enabled }),
      });
      if (res.ok) onToggle(watchlist.id, !watchlist.enabled);
    } finally {
      setToggling(false);
    }
  }

  if (editing && catalog) {
    return (
      <WatchlistForm
        catalog={catalog}
        initial={watchlist}
        onSaved={(updated) => {
          onUpdate(updated);
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  const summary: string[] = [];
  if (watchlist.monitorTypes.length) summary.push(watchlist.monitorTypes.map((t) => MONITOR_TYPE_LABEL[t] ?? t).join(", "));
  if (watchlist.providers.length) summary.push(`Providers: ${watchlist.providers.join(", ")}`);
  if (watchlist.chains.length) summary.push(`Chains: ${watchlist.chains.join(", ")}`);
  if (watchlist.assets.length) summary.push(`Assets: ${watchlist.assets.join(", ")}`);
  if (watchlist.tags.length) summary.push(`Tags: ${watchlist.tags.join(", ")}`);
  if (watchlist.objectIds.length) summary.push(`${watchlist.objectIds.length} specific object(s)`);
  const identifier = summary.length === 0 ? "No filters — matches all catalog objects." : summary.join(" · ");

  return (
    <Card className="border-border/60">
      <CardContent className="py-4 px-4 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{watchlist.name}</span>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${MATCH_MODE_COLORS[watchlist.matchMode] ?? ""}`}>
              Match {watchlist.matchMode}
            </span>
            <Badge variant={watchlist.enabled ? "default" : "secondary"} className="text-xs">
              {watchlist.enabled ? "active" : "paused"}
            </Badge>
          </div>
          {watchlist.description && (
            <p className="text-xs text-muted-foreground">{watchlist.description}</p>
          )}
          <p className="text-xs text-muted-foreground truncate">{identifier}</p>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>Min severity: {watchlist.minSeverity}</span>
            {watchlist.signalClasses.length > 0 && (
              <>
                <span>·</span>
                <span>Signals: {watchlist.signalClasses.map((s) => SIGNAL_CLASS_LABEL[s] ?? s).join(", ")}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={handleToggle}
            disabled={toggling}
            title={watchlist.enabled ? "Pause" : "Enable"}
          >
            {watchlist.enabled
              ? <ToggleRight className="h-4 w-4" />
              : <ToggleLeft className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => setEditing(true)}
            disabled={!catalog}
            title={catalog ? "Edit" : "Catalog still loading…"}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={handleDelete}
            disabled={deleting}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Create / edit form ────────────────────────────────────────────────────────

function WatchlistForm({
  catalog,
  initial,
  initialObjectIds,
  onSaved,
  onCancel,
}: {
  catalog: SceCatalogResponse;
  initial?: Watchlist;
  initialObjectIds?: string[];
  onSaved: (w: Watchlist) => void;
  onCancel: () => void;
}) {
  const isEdit = initial !== undefined;
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [matchMode, setMatchMode] = useState<"any" | "all">((initial?.matchMode as "any" | "all") ?? "any");
  const [minSeverity, setMinSeverity] = useState(initial?.minSeverity ?? "watch");
  const [monitorTypes, setMonitorTypes] = useState<string[]>(initial?.monitorTypes ?? []);
  const [signalClasses, setSignalClasses] = useState<string[]>(initial?.signalClasses ?? []);
  const [providers, setProviders] = useState<string[]>(initial?.providers ?? []);
  const [chains, setChains] = useState<string[]>(initial?.chains ?? []);
  const [assets, setAssets] = useState<string[]>(initial?.assets ?? []);
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [purposes, setPurposes] = useState<string[]>(initial?.purposes ?? []);
  const [objectIds, setObjectIds] = useState<string[]>(initial?.objectIds ?? initialObjectIds ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { account } = useAccount();
  const objectLimit = getWatchlistLimit(account.plan);
  const planLabel = getPlanLabel(account.plan);
  const hasLimit = Number.isFinite(objectLimit);

  const coveredIds = useMemo(
    () =>
      computeCoveredObjectIds(
        { matchMode, monitorTypes, providers, chains, assets, objectIds, tags, purposes },
        catalog.objects,
      ),
    [matchMode, monitorTypes, providers, chains, assets, objectIds, tags, purposes, catalog.objects],
  );
  const coverageCount = coveredIds.size;
  const overLimit = hasLimit && coverageCount > objectLimit;
  const atLimit = hasLimit && coverageCount >= objectLimit;
  // Only lock additions in "any" mode, where each selection widens coverage. In
  // "all" mode adding filters narrows coverage, so it must stay available to help
  // an over-limit selection get back under the cap.
  const lockAdd = matchMode === "any" && atLimit;
  const coverageBlocksSave = coverageCount === 0 || overLimit;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const url = isEdit ? `/api/watchlists/${initial.id}` : "/api/watchlists";
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || undefined,
          matchMode,
          minSeverity,
          monitorTypes,
          signalClasses,
          providers,
          chains,
          assets,
          tags,
          purposes,
          objectIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Failed to ${isEdit ? "save" : "create"} watchlist`);
      onSaved(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${isEdit ? "save" : "create"} watchlist`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="text-base">{isEdit ? "Edit watchlist" : "New watchlist"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="wl-name">Name *</Label>
              <Input
                id="wl-name"
                required
                placeholder="e.g. All Base USDC infrastructure"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wl-severity">Minimum severity</Label>
              <Select
                id="wl-severity"
                value={minSeverity}
                onChange={(e) => setMinSeverity(e.target.value)}
                disabled={loading}
              >
                <option value="watch">Watch</option>
                <option value="warning">Warning</option>
                <option value="critical">Critical</option>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="wl-desc">Description (optional)</Label>
            <Input
              id="wl-desc"
              placeholder="What this watchlist is for"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="wl-match">Match mode</Label>
            <Select
              id="wl-match"
              value={matchMode}
              onChange={(e) => setMatchMode(e.target.value as "any" | "all")}
              disabled={loading}
              className="w-48"
            >
              <option value="any">Match any selected filter</option>
              <option value="all">Match all selected filters</option>
            </Select>
          </div>

          <div
            className={`flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 ${
              overLimit
                ? "border-destructive/50 bg-destructive/5"
                : "border-border/60 bg-muted/30"
            }`}
          >
            <span className="text-sm font-medium">
              Coverage: {coverageCount}
              {hasLimit ? ` / ${objectLimit}` : ""} object{coverageCount === 1 ? "" : "s"}
            </span>
            <span className={`text-xs ${overLimit ? "text-destructive" : "text-muted-foreground"}`}>
              {coverageCount === 0
                ? "Select filters or specific objects — a watchlist covers nothing until you do."
                : overLimit
                  ? `Over the ${planLabel} limit of ${objectLimit}. Narrow your selection to save.`
                  : lockAdd
                    ? `Plan limit reached — deselect to add different objects.`
                    : hasLimit
                      ? `${objectLimit - coverageCount} remaining`
                      : "Monitoring these objects"}
            </span>
          </div>

          <Checklist
            label="Monitor types"
            options={["oracle", "bridge", "lp"]}
            labels={MONITOR_TYPE_LABEL}
            selected={monitorTypes}
            onChange={setMonitorTypes}
            disabled={loading}
            lockUnselected={lockAdd}
          />
          <Checklist
            label="Signal classes"
            options={["alert", "warning", "watch", "coverage"]}
            labels={SIGNAL_CLASS_LABEL}
            selected={signalClasses}
            onChange={setSignalClasses}
            disabled={loading}
          />
          <Checklist
            label="Providers"
            options={catalog.filters.providers}
            selected={providers}
            onChange={setProviders}
            disabled={loading}
            lockUnselected={lockAdd}
          />
          <Checklist
            label="Chains"
            options={catalog.filters.chains}
            selected={chains}
            onChange={setChains}
            disabled={loading}
            lockUnselected={lockAdd}
          />
          <Checklist
            label="Assets"
            options={catalog.filters.assets}
            selected={assets}
            onChange={setAssets}
            disabled={loading}
            lockUnselected={lockAdd}
          />
          <Checklist
            label="Tags"
            options={catalog.filters.tags}
            selected={tags}
            onChange={setTags}
            disabled={loading}
            lockUnselected={lockAdd}
          />
          <Checklist
            label="Purposes"
            options={catalog.filters.purposes}
            selected={purposes}
            onChange={setPurposes}
            disabled={loading}
            lockUnselected={lockAdd}
          />

          <ObjectPicker
            objects={catalog.objects}
            selectedMonitorTypes={monitorTypes}
            selected={objectIds}
            onChange={setObjectIds}
            disabled={loading}
            lockUnselected={lockAdd}
          />

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={loading || coverageBlocksSave}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              {loading ? (isEdit ? "Saving…" : "Creating…") : isEdit ? "Save changes" : "Create watchlist"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={loading}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function WatchlistsPage() {
  const { account } = useAccount();
  const searchParams = useSearchParams();
  const planAllowsPrivateWatchlists = allowsPrivateWatchlists(account.plan);
  const planLabel = getPlanLabel(account.plan);
  const preselectedObjectId = searchParams.get("objectId");
  const limit = Infinity;

  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [catalog, setCatalog] = useState<SceCatalogResponse | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/watchlists").then((r) => r.json()),
      fetch("/api/radar/catalog").then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Failed to load catalog");
        return data as SceCatalogResponse;
      }),
    ])
      .then(([w, c]) => {
        setWatchlists(w);
        setCatalog(c);
      })
      .catch((e) => setCatalogError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (preselectedObjectId && catalog && planAllowsPrivateWatchlists) {
      setShowForm(true);
    }
  }, [catalog, planAllowsPrivateWatchlists, preselectedObjectId]);

  const atLimit = !planAllowsPrivateWatchlists;

  return (
    <div className="max-w-7xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Watchlists</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {watchlists.length}
            {limit !== Infinity ? ` of ${limit}` : ""} watchlists · plan:{" "}
            <span>{planLabel}</span>
          </p>
        </div>
        {!atLimit && catalog && (
          <Button size="sm" onClick={() => setShowForm((p) => !p)}>
            <Plus className="mr-2 h-3.5 w-3.5" />
            {showForm ? "Cancel" : "New watchlist"}
          </Button>
        )}
      </div>

      {atLimit && (
        <Card className="border-violet-600/30 bg-violet-600/5">
          <CardContent className="py-4 px-4 flex items-center justify-between gap-4">
            <p className="text-sm">
              {resolvePlan(account.plan) === "radar_intel"
                ? "Intel does not include private watchlists."
                : "Private object monitoring starts on Watch. Upgrade to create watchlists."}
            </p>
            <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-white shrink-0" asChild>
              <Link href="/dashboard/settings">
                Upgrade <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {catalogError && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="py-3 px-4 text-sm text-destructive">{catalogError}</CardContent>
        </Card>
      )}

      {showForm && catalog && planAllowsPrivateWatchlists && (
        <WatchlistForm
          catalog={catalog}
          initialObjectIds={preselectedObjectId ? [preselectedObjectId] : undefined}
          onSaved={(w) => {
            setWatchlists((p) => [w, ...p]);
            setShowForm(false);
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : watchlists.length === 0 ? (
        <Card className="border-border/60">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No watchlists yet. Create one to filter alerts to your infrastructure.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {watchlists.map((w) => (
            <WatchlistCard
              key={w.id}
              watchlist={w}
              catalog={catalog}
              onDelete={(id) => setWatchlists((p) => p.filter((x) => x.id !== id))}
              onToggle={(id, enabled) =>
                setWatchlists((p) => p.map((x) => (x.id === id ? { ...x, enabled } : x)))
              }
              onUpdate={(updated) =>
                setWatchlists((p) => p.map((x) => (x.id === updated.id ? updated : x)))
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
