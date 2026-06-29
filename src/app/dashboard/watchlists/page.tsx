"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { listWatchlists, createWatchlist, deleteWatchlist, getClientEntitlements } from "@/lib/api";
import type { RadarWatchlist, RadarClientEntitlementSummary } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

function WatchlistCard({
  watchlist,
  onDelete,
}: {
  watchlist: RadarWatchlist;
  onDelete: (id: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm("Delete this watchlist?")) return;
    setDeleting(true);
    try {
      await deleteWatchlist(watchlist.id);
      onDelete(watchlist.id);
    } catch (e) {
      console.error(e);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{watchlist.name}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={watchlist.enabled ? "default" : "secondary"}>
              {watchlist.enabled ? "enabled" : "paused"}
            </Badge>
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
        </div>
      </CardHeader>
      <CardContent className="text-xs text-muted-foreground space-y-1">
        {watchlist.monitorTypes.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {watchlist.monitorTypes.map((t) => (
              <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
            ))}
          </div>
        )}
        {watchlist.minimumSeverity && (
          <p>Min severity: <span className="text-foreground">{watchlist.minimumSeverity}</span></p>
        )}
        {watchlist.assets.length > 0 && (
          <p>Assets: {watchlist.assets.join(", ")}</p>
        )}
        {watchlist.chains.length > 0 && (
          <p>Chains: {watchlist.chains.join(", ")}</p>
        )}
        {watchlist.deliveryChannels.length > 0 && (
          <p>Delivery: {watchlist.deliveryChannels.join(", ")}</p>
        )}
      </CardContent>
    </Card>
  );
}

function CreateWatchlistForm({
  clientId,
  onCreated,
}: {
  clientId: string;
  onCreated: (w: RadarWatchlist) => void;
}) {
  const [name, setName] = useState("");
  const [minimumSeverity, setMinimumSeverity] = useState<"watch" | "warning" | "critical">("watch");
  const [monitorTypesRaw, setMonitorTypesRaw] = useState("");
  const [assetsRaw, setAssetsRaw] = useState("");
  const [chainsRaw, setChainsRaw] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const w = await createWatchlist({
        clientId,
        name,
        enabled: true,
        plan: "radar_live",
        minimumSeverity,
        monitorTypes: monitorTypesRaw
          ? (monitorTypesRaw.split(",").map((s) => s.trim()) as RadarWatchlist["monitorTypes"])
          : [],
        assets: assetsRaw ? assetsRaw.split(",").map((s) => s.trim()) : [],
        chains: chainsRaw ? chainsRaw.split(",").map((s) => s.trim()) : [],
        sources: [],
        routes: [],
        reasonCodes: [],
        deliveryChannels: [],
      });
      onCreated(w);
      setName("");
      setMonitorTypesRaw("");
      setAssetsRaw("");
      setChainsRaw("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create watchlist");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="text-base">New watchlist</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="wl-name">Name *</Label>
              <Input
                id="wl-name"
                required
                placeholder="e.g. Arbitrum oracle feeds"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wl-severity">Minimum severity</Label>
              <Select
                id="wl-severity"
                value={minimumSeverity}
                onChange={(e) =>
                  setMinimumSeverity(e.target.value as "watch" | "warning" | "critical")
                }
                disabled={loading}
              >
                <option value="watch">Watch</option>
                <option value="warning">Warning</option>
                <option value="critical">Critical</option>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="wl-types">Monitor types (comma-separated)</Label>
            <Input
              id="wl-types"
              placeholder="oracle, bridge, lp"
              value={monitorTypesRaw}
              onChange={(e) => setMonitorTypesRaw(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="wl-assets">Assets (optional)</Label>
              <Input
                id="wl-assets"
                placeholder="ETH, USDC"
                value={assetsRaw}
                onChange={(e) => setAssetsRaw(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wl-chains">Chains (optional)</Label>
              <Input
                id="wl-chains"
                placeholder="arbitrum, base"
                value={chainsRaw}
                onChange={(e) => setChainsRaw(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" size="sm" disabled={loading}>
            <Plus className="mr-2 h-3.5 w-3.5" />
            Create watchlist
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function WatchlistsPage() {
  const { me } = useAuth();
  const clientId = me?.activeAccount?.id ?? me?.memberships[0]?.account?.id ?? "";
  const [watchlists, setWatchlists] = useState<RadarWatchlist[]>([]);
  const [entitlements, setEntitlements] = useState<RadarClientEntitlementSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    Promise.all([listWatchlists(clientId), getClientEntitlements(clientId)])
      .then(([w, e]) => {
        setWatchlists(w);
        setEntitlements(e);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [clientId]);

  const atLimit =
    entitlements?.watchlistsLimit != null &&
    watchlists.length >= entitlements.watchlistsLimit;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Watchlists</h1>
          {entitlements && (
            <p className="text-sm text-muted-foreground mt-1">
              {watchlists.length}
              {entitlements.watchlistsLimit != null
                ? ` of ${entitlements.watchlistsLimit}`
                : ""}{" "}
              watchlists
            </p>
          )}
        </div>
        {!atLimit && (
          <Button size="sm" onClick={() => setShowForm((p) => !p)}>
            <Plus className="mr-2 h-3.5 w-3.5" />
            {showForm ? "Cancel" : "New watchlist"}
          </Button>
        )}
      </div>

      {atLimit && (
        <Card className="border-amber-500/40 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="py-3 px-4 text-sm">
            You&apos;ve reached your plan&apos;s watchlist limit. Upgrade to add more.
          </CardContent>
        </Card>
      )}

      {showForm && clientId && (
        <CreateWatchlistForm
          clientId={clientId}
          onCreated={(w) => {
            setWatchlists((p) => [w, ...p]);
            setShowForm(false);
          }}
        />
      )}

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : watchlists.length === 0 ? (
        <Card className="border-border/60">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No watchlists yet. Create one to filter alerts to your dependencies.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {watchlists.map((w) => (
            <WatchlistCard
              key={w.id}
              watchlist={w}
              onDelete={(id) => setWatchlists((p) => p.filter((x) => x.id !== id))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
