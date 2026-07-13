"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Pencil, Plus, ToggleLeft, ToggleRight, Trash2 } from "lucide-react";
import { useAccount } from "@/lib/account-context";
import { allowsPrivateWatchlists, getPlanLabel, resolvePlan } from "@/lib/plan-limits";
import type { SceCatalogObject, SceCatalogResponse, SceMonitorType } from "@/lib/sce-catalog-types";
import {
  analyzeWatchlistCoverage,
  WATCHLIST_SCOPE_AVAILABILITY,
  WATCHLIST_SCOPE_LABELS,
  type WatchlistScopeIssue,
} from "@/lib/watchlist-coverage";
import type { WatchlistScopeType } from "@/lib/watchlist-filters";
import {
  OBJECT_PICKER_MONITOR_TYPE_ORDER,
  filterObjectsForPicker,
  groupObjectsByMonitorType,
} from "@/lib/watchlist-object-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

interface Watchlist {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  scopeType: WatchlistScopeType | null;
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
  coverageCount: number;
  issue: WatchlistScopeIssue | null;
  createdAt: string;
  updatedAt: string;
}

const MONITOR_TYPE_LABEL: Record<string, string> = {
  oracle: "Oracle",
  bridge: "Bridge",
  lp: "LP",
};

const SIGNAL_CLASS_LABEL: Record<string, string> = {
  alert: "Alert",
  warning: "Warning",
  watch: "Watch",
  coverage: "Coverage",
};

const STANDARD_SCOPE_TYPES: Exclude<WatchlistScopeType, "custom_monitor">[] = [
  "exact_objects",
  "asset_lens",
  "chain_lens",
  "provider_lens",
  "pillar_lens",
  "full_catalog",
];

function uniq(values: string[]): string[] {
  return Array.from(new Set(values));
}

function describeScope(watchlist: Pick<Watchlist, "scopeType" | "assets" | "chains" | "providers" | "monitorTypes" | "objectIds" | "issue">): string {
  switch (watchlist.scopeType) {
    case "exact_objects":
      return `${watchlist.objectIds.length} exact object${watchlist.objectIds.length === 1 ? "" : "s"}`;
    case "asset_lens":
      return `${watchlist.assets[0] ?? "Asset"} asset lens`;
    case "chain_lens":
      return `${watchlist.chains[0] ?? "Chain"} chain lens`;
    case "provider_lens":
      return `${watchlist.providers[0] ?? "Provider"} provider lens`;
    case "pillar_lens":
      return `${MONITOR_TYPE_LABEL[watchlist.monitorTypes[0] ?? ""] ?? "Pillar"} pillar lens`;
    case "full_catalog":
      return "Full standard catalog";
    case "custom_monitor":
      return "Custom monitor";
    default:
      return watchlist.issue ? "Action needed" : "No scope selected";
  }
}

function scopePlanLine(scopeType: Exclude<WatchlistScopeType, "custom_monitor">): string {
  const labels = WATCHLIST_SCOPE_AVAILABILITY[scopeType]
    .filter((plan) => plan !== "internal")
    .map((plan) => (plan === "radar_signal" ? "Signal" : getPlanLabel(plan)));
  return labels.join(", ");
}

function buildScopeUpgradeMessage(scopeType: WatchlistScopeType | null): string | null {
  switch (scopeType) {
    case "chain_lens":
      return "This scope requires Signal because it monitors an entire chain.";
    case "provider_lens":
      return "This scope requires Signal because it monitors an entire provider.";
    case "pillar_lens":
      return "This scope requires Signal because it monitors an entire pillar.";
    case "full_catalog":
      return "Full standard catalog coverage requires Signal.";
    default:
      return null;
  }
}

function ScopeCard({
  scopeType,
  active,
  onSelect,
}: {
  scopeType: Exclude<WatchlistScopeType, "custom_monitor">;
  active: boolean;
  onSelect: (scopeType: Exclude<WatchlistScopeType, "custom_monitor">) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(scopeType)}
      className={`rounded-xl border p-4 text-left transition-colors ${
        active
          ? "border-primary bg-primary/5"
          : "border-border/60 bg-background hover:border-primary/40"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">{WATCHLIST_SCOPE_LABELS[scopeType]}</span>
        {active && <Badge variant="default">Selected</Badge>}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Available on {scopePlanLine(scopeType)}</p>
    </button>
  );
}

function SignalClassChips({
  selected,
  onChange,
  disabled,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>Signal classes</Label>
      <div className="flex flex-wrap gap-2">
        {(["alert", "warning", "watch", "coverage"] as const).map((option) => {
          const active = selected.includes(option);

          return (
            <button
              key={option}
              type="button"
              disabled={disabled}
              onClick={() =>
                onChange(active ? selected.filter((value) => value !== option) : [...selected, option])
              }
              className={`rounded-full border px-2.5 py-1 text-xs transition-colors disabled:opacity-50 ${
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              {SIGNAL_CLASS_LABEL[option]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ObjectPicker({
  objects,
  selected,
  onChange,
  disabled,
  lockUnselected,
}: {
  objects: SceCatalogObject[];
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  lockUnselected?: boolean;
}) {
  const [viewGroup, setViewGroup] = useState<"all" | SceMonitorType>("all");

  function toggle(id: string) {
    if (lockUnselected && !selected.includes(id)) return;
    onChange(selected.includes(id) ? selected.filter((value) => value !== id) : [...selected, id]);
  }

  const visible = filterObjectsForPicker(objects, []);
  const groups = groupObjectsByMonitorType(visible);
  const groupsToRender = viewGroup === "all" ? OBJECT_PICKER_MONITOR_TYPE_ORDER : [viewGroup];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Label>Exact catalog objects</Label>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{selected.length} selected</span>
          <Select
            value={viewGroup}
            onChange={(event) => setViewGroup(event.target.value as "all" | SceMonitorType)}
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
                ...items.map((object) => (
                  <tr
                    key={object.id}
                    onClick={() => toggle(object.id)}
                    className="cursor-pointer border-b border-border/30 hover:bg-muted/50 last:border-b-0"
                  >
                    <td className="px-2 py-1.5 align-top">
                      <input
                        type="checkbox"
                        checked={selected.includes(object.id)}
                        onChange={() => toggle(object.id)}
                        onClick={(event) => event.stopPropagation()}
                        disabled={disabled || (lockUnselected && !selected.includes(object.id))}
                      />
                    </td>
                    <td className="truncate px-2 py-1.5 align-top font-medium" title={object.displayName}>
                      {object.displayName}
                    </td>
                    <td className="truncate px-2 py-1.5 align-top text-muted-foreground" title={object.provider}>
                      {object.provider}
                    </td>
                    <td className="truncate px-2 py-1.5 align-top text-muted-foreground" title={object.chain}>
                      {object.chain}
                    </td>
                    <td
                      className="truncate px-2 py-1.5 align-top text-muted-foreground"
                      title={object.assetPair ?? object.asset ?? object.route ?? object.pool ?? ""}
                    >
                      {object.assetPair ?? object.asset ?? object.route ?? object.pool ?? "-"}
                    </td>
                    <td className="px-1.5 py-1.5 align-top">
                      <div className="flex flex-nowrap items-start gap-1">
                        {object.canAlert && (
                          <Badge variant="watch" className="whitespace-nowrap px-1.5 py-0 text-[10px]">
                            alertable
                          </Badge>
                        )}
                        {object.canWatch && (
                          <Badge variant="secondary" className="whitespace-nowrap px-1.5 py-0 text-[10px]">
                            watchable
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-1.5 py-1.5 align-top">
                      {object.commercialValue && (
                        <Badge variant="outline" className="whitespace-nowrap px-1.5 py-0 text-[10px]">
                          {object.commercialValue.replace(/_/g, " ")}
                        </Badge>
                      )}
                    </td>
                  </tr>
                )),
              ];
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WatchlistSummaryCard({
  watchlist,
  onDelete,
  onEdit,
  onToggle,
}: {
  watchlist: Watchlist;
  onDelete: (id: string) => void;
  onEdit: () => void;
  onToggle: (id: string, enabled: boolean) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [toggling, setToggling] = useState(false);

  async function handleDelete() {
    if (!confirm("Delete this watchlist?")) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/watchlists/${watchlist.id}`, { method: "DELETE" });
      if (response.ok) onDelete(watchlist.id);
    } finally {
      setDeleting(false);
    }
  }

  async function handleToggle() {
    setToggling(true);
    try {
      const response = await fetch(`/api/watchlists/${watchlist.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !watchlist.enabled }),
      });
      if (response.ok) onToggle(watchlist.id, !watchlist.enabled);
    } finally {
      setToggling(false);
    }
  }

  return (
    <Card className="border-border/60">
      <CardContent className="flex items-start justify-between gap-4 px-4 py-4">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{watchlist.name}</span>
            <Badge variant={watchlist.enabled ? "default" : "secondary"} className="text-xs">
              {watchlist.enabled ? "active" : "paused"}
            </Badge>
            {watchlist.issue && <Badge variant="warning">Action needed</Badge>}
          </div>
          {watchlist.description && <p className="text-xs text-muted-foreground">{watchlist.description}</p>}
          <p className="text-xs text-muted-foreground">Scope: {describeScope(watchlist)}</p>
          <p className="text-xs text-muted-foreground">
            Coverage: {watchlist.coverageCount} standard catalog object{watchlist.coverageCount === 1 ? "" : "s"}
          </p>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>Min severity: {watchlist.minSeverity}</span>
            {watchlist.signalClasses.length > 0 && (
              <span>Signals: {watchlist.signalClasses.map((value) => SIGNAL_CLASS_LABEL[value] ?? value).join(", ")}</span>
            )}
          </div>
          {watchlist.issue && <p className="text-xs text-amber-500">{watchlist.issue.message}</p>}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={handleToggle}
            disabled={toggling}
            title={watchlist.enabled ? "Pause" : "Enable"}
          >
            {watchlist.enabled ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={onEdit}
            title="Edit"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={handleDelete}
            disabled={deleting}
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function WatchlistForm({
  catalog,
  initial,
  seedObjectIds,
  onSaved,
  onCancel,
}: {
  catalog: SceCatalogResponse;
  initial?: Watchlist;
  seedObjectIds?: string[];
  onSaved: (watchlist: Watchlist) => void;
  onCancel: () => void;
}) {
  const isEdit = initial !== undefined;
  const { account } = useAccount();
  const resolvedPlan = resolvePlan(account.plan, account.isAdmin);

  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [scopeType, setScopeType] = useState<Exclude<WatchlistScopeType, "custom_monitor"> | null>(
    initial?.scopeType && initial.scopeType !== "custom_monitor" ? initial.scopeType : seedObjectIds?.length ? "exact_objects" : null,
  );
  const [minSeverity, setMinSeverity] = useState(initial?.minSeverity ?? "watch");
  const [signalClasses, setSignalClasses] = useState<string[]>(initial?.signalClasses ?? []);
  const [objectIds, setObjectIds] = useState<string[]>(uniq([...(initial?.objectIds ?? []), ...(seedObjectIds ?? [])]));
  const [asset, setAsset] = useState(initial?.scopeType === "asset_lens" ? initial.assets[0] ?? "" : "");
  const [chain, setChain] = useState(initial?.scopeType === "chain_lens" ? initial.chains[0] ?? "" : "");
  const [provider, setProvider] = useState(initial?.scopeType === "provider_lens" ? initial.providers[0] ?? "" : "");
  const [pillar, setPillar] = useState(initial?.scopeType === "pillar_lens" ? initial.monitorTypes[0] ?? "" : "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scopeState = useMemo(() => {
    return {
      scopeType,
      matchMode: "any",
      minSeverity,
      signalClasses,
      monitorTypes: scopeType === "pillar_lens" && pillar ? [pillar] : [],
      providers: scopeType === "provider_lens" && provider ? [provider] : [],
      chains: scopeType === "chain_lens" && chain ? [chain] : [],
      assets: scopeType === "asset_lens" && asset ? [asset] : [],
      objectIds: scopeType === "exact_objects" ? objectIds : [],
      tags: [],
      purposes: [],
      statuses: [],
    };
  }, [asset, chain, minSeverity, objectIds, pillar, provider, scopeType, signalClasses]);

  const analysis = useMemo(
    () => analyzeWatchlistCoverage(scopeState, catalog.objects, { blankBehavior: "empty" }),
    [catalog.objects, scopeState],
  );

  const watchExactObjectLimitReached =
    resolvedPlan === "watch" && scopeType === "exact_objects" && objectIds.length >= 5;
  const scopeAvailable =
    scopeType !== null &&
    WATCHLIST_SCOPE_AVAILABILITY[scopeType].includes(resolvedPlan);
  const upgradeMessage = scopeType && !scopeAvailable ? buildScopeUpgradeMessage(scopeType) : null;
  const exactObjectLimitMessage =
    resolvedPlan === "watch" && scopeType === "exact_objects" && objectIds.length > 5
      ? "Watch allows up to 5 exact catalog objects."
      : null;
  const saveDisabled =
    loading ||
    analysis.coverageCount === 0 ||
    Boolean(analysis.issue) ||
    Boolean(upgradeMessage) ||
    Boolean(exactObjectLimitMessage);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const url = isEdit ? `/api/watchlists/${initial.id}` : "/api/watchlists";
      const response = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || undefined,
          scopeType,
          matchMode: "any",
          minSeverity,
          signalClasses,
          monitorTypes: scopeState.monitorTypes,
          providers: scopeState.providers,
          chains: scopeState.chains,
          assets: scopeState.assets,
          objectIds: scopeState.objectIds,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? `Failed to ${isEdit ? "save" : "create"} watchlist`);
      }

      onSaved(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `Failed to ${isEdit ? "save" : "create"} watchlist`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="text-base">{isEdit ? "Edit main watchlist" : "Create main watchlist"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="wl-name">Name *</Label>
              <Input
                id="wl-name"
                required
                placeholder="e.g. USDC core infrastructure"
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wl-severity">Minimum severity</Label>
              <Select
                id="wl-severity"
                value={minSeverity}
                onChange={(event) => setMinSeverity(event.target.value)}
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
              onChange={(event) => setDescription(event.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium">Step 1: Choose scope</p>
              <p className="text-xs text-muted-foreground">
                Monitoring is scoped by coverage lens first. Object count is shown as transparency.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {STANDARD_SCOPE_TYPES.map((entry) => (
                <ScopeCard key={entry} scopeType={entry} active={scopeType === entry} onSelect={setScopeType} />
              ))}
            </div>
          </div>

          <div className="space-y-4 rounded-xl border border-border/60 p-4">
            <div>
              <p className="text-sm font-medium">Step 2: Configure scope</p>
              <p className="text-xs text-muted-foreground">
                Blank watchlists cover nothing. Full catalog coverage only starts when you explicitly choose it.
              </p>
            </div>

            {scopeType === "exact_objects" && (
              <ObjectPicker
                objects={catalog.objects}
                selected={objectIds}
                onChange={setObjectIds}
                disabled={loading}
                lockUnselected={watchExactObjectLimitReached}
              />
            )}

            {scopeType === "asset_lens" && (
              <div className="space-y-2">
                <Label htmlFor="asset-lens">Asset</Label>
                <Select id="asset-lens" value={asset} onChange={(event) => setAsset(event.target.value)} disabled={loading}>
                  <option value="">Select one asset</option>
                  {catalog.filters.assets.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </Select>
                <p className="text-xs text-muted-foreground">Watch supports one asset lens even when it resolves to more than 5 catalog objects.</p>
              </div>
            )}

            {scopeType === "chain_lens" && (
              <div className="space-y-2">
                <Label htmlFor="chain-lens">Chain</Label>
                <Select id="chain-lens" value={chain} onChange={(event) => setChain(event.target.value)} disabled={loading}>
                  <option value="">Select one chain</option>
                  {catalog.filters.chains.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            {scopeType === "provider_lens" && (
              <div className="space-y-2">
                <Label htmlFor="provider-lens">Provider</Label>
                <Select id="provider-lens" value={provider} onChange={(event) => setProvider(event.target.value)} disabled={loading}>
                  <option value="">Select one provider</option>
                  {catalog.filters.providers.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            {scopeType === "pillar_lens" && (
              <div className="space-y-2">
                <Label htmlFor="pillar-lens">Pillar</Label>
                <Select id="pillar-lens" value={pillar} onChange={(event) => setPillar(event.target.value)} disabled={loading}>
                  <option value="">Select one pillar</option>
                  <option value="oracle">Oracle</option>
                  <option value="bridge">Bridge</option>
                  <option value="lp">LP</option>
                </Select>
              </div>
            )}

            {scopeType === "full_catalog" && (
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-sm text-muted-foreground">
                Full catalog coverage monitors the entire current standard Radar catalog.
              </div>
            )}
          </div>

          <SignalClassChips selected={signalClasses} onChange={setSignalClasses} disabled={loading} />

          <div className={`rounded-xl border px-4 py-3 ${upgradeMessage || analysis.issue || exactObjectLimitMessage ? "border-amber-500/30 bg-amber-500/5" : "border-border/60 bg-muted/20"}`}>
            <p className="text-sm font-medium">
              Scope: {scopeType ? describeScope({ scopeType, assets: scopeState.assets, chains: scopeState.chains, providers: scopeState.providers, monitorTypes: scopeState.monitorTypes, objectIds: scopeState.objectIds, issue: null }) : "None selected"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Coverage: {analysis.coverageCount} standard catalog object{analysis.coverageCount === 1 ? "" : "s"}
            </p>
            <p className={`mt-1 text-xs ${upgradeMessage || analysis.issue || exactObjectLimitMessage ? "text-amber-500" : "text-muted-foreground"}`}>
              {analysis.coverageCount === 0
                ? "Select a scope and configure it to cover at least one catalog object."
                : exactObjectLimitMessage ??
                  upgradeMessage ??
                  analysis.issue?.message ??
                  (watchExactObjectLimitReached
                    ? "Watch is at its exact-object limit. Deselect an object to free capacity."
                    : `Available on ${scopeType ? scopePlanLine(scopeType) : getPlanLabel(account.plan)}.`)}
            </p>
          </div>

          {initial?.issue && scopeType === null && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-500">
              {initial.issue.message}
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={saveDisabled}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              {loading ? (isEdit ? "Saving..." : "Creating...") : isEdit ? "Save changes" : "Create watchlist"}
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

export default function WatchlistsPage() {
  const { account } = useAccount();
  const searchParams = useSearchParams();
  const planAllowsPrivateWatchlists = allowsPrivateWatchlists(account.plan, account.isAdmin);
  const planLabel = getPlanLabel(account.plan);
  const preselectedObjectId = searchParams.get("objectId");

  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [catalog, setCatalog] = useState<SceCatalogResponse | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [seedObjectIds, setSeedObjectIds] = useState<string[]>(preselectedObjectId ? [preselectedObjectId] : []);

  useEffect(() => {
    Promise.all([
      fetch("/api/watchlists").then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Failed to load watchlist");
        return data as Watchlist[];
      }),
      fetch("/api/radar/catalog").then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Failed to load catalog");
        return data as SceCatalogResponse;
      }),
    ])
      .then(([loadedWatchlists, loadedCatalog]) => {
        setWatchlists(loadedWatchlists);
        setCatalog(loadedCatalog);
      })
      .catch((cause) => {
        setCatalogError(cause instanceof Error ? cause.message : "Failed to load watchlist data");
      })
      .finally(() => setLoading(false));
  }, []);

  const mainWatchlist = watchlists[0] ?? null;
  const watchlistsUnavailable = !planAllowsPrivateWatchlists;
  const formVisible =
    showForm || (Boolean(catalog) && planAllowsPrivateWatchlists && (seedObjectIds.length > 0 || !mainWatchlist));

  return (
    <div className="max-w-7xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Watchlist</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mainWatchlist ? "Main watchlist configured" : "No main watchlist yet"} · plan: <span>{planLabel}</span>
          </p>
        </div>
        {!watchlistsUnavailable && catalog && mainWatchlist && (
          <Button size="sm" onClick={() => setShowForm((current) => !current)}>
            {formVisible ? "Cancel" : <><Pencil className="mr-2 h-3.5 w-3.5" />Edit watchlist</>}
          </Button>
        )}
      </div>

      {watchlistsUnavailable && (
        <Card className="border-violet-600/30 bg-violet-600/5">
          <CardContent className="flex items-center justify-between gap-4 px-4 py-4">
            <p className="text-sm">
              {resolvePlan(account.plan, account.isAdmin) === "radar_intel"
                ? "Intel does not include private watchlists."
                : "Private monitoring starts on Watch. Upgrade to create a watchlist."}
            </p>
            <Button size="sm" className="shrink-0 bg-violet-600 text-white hover:bg-violet-700" asChild>
              <Link href="/dashboard/settings">
                Upgrade <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {catalogError && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="px-4 py-3 text-sm text-destructive">{catalogError}</CardContent>
        </Card>
      )}

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : (
        <>
          {formVisible && catalog && planAllowsPrivateWatchlists && (
            <WatchlistForm
              catalog={catalog}
              initial={mainWatchlist ?? undefined}
              seedObjectIds={seedObjectIds.length > 0 ? seedObjectIds : undefined}
              onSaved={(watchlist) => {
                setSeedObjectIds([]);
                setWatchlists([watchlist]);
                setShowForm(false);
              }}
              onCancel={() => {
                setSeedObjectIds([]);
                setShowForm(false);
              }}
            />
          )}

          {!formVisible && mainWatchlist && (
            <WatchlistSummaryCard
              watchlist={mainWatchlist}
              onDelete={() => setWatchlists([])}
              onEdit={() => setShowForm(true)}
              onToggle={(id, enabled) =>
                setWatchlists((current) =>
                  current.map((watchlist) => (watchlist.id === id ? { ...watchlist, enabled } : watchlist)),
                )
              }
            />
          )}

          {!formVisible && !mainWatchlist && !watchlistsUnavailable && (
            <Card className="border-border/60">
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Choose a scope to monitor one asset lens, exact objects, or the full standard catalog on eligible plans.
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
