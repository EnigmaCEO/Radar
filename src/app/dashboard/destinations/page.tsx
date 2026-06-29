"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  listDeliveryDestinations,
  createDeliveryDestination,
  deleteDeliveryDestination,
  getClientEntitlements,
} from "@/lib/api";
import type { RadarDeliveryDestination, RadarClientEntitlementSummary } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

function DestCard({
  dest,
  onDelete,
}: {
  dest: RadarDeliveryDestination;
  onDelete: (id: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm("Remove this delivery destination?")) return;
    setDeleting(true);
    try {
      await deleteDeliveryDestination(dest.id);
      onDelete(dest.id);
    } finally {
      setDeleting(false);
    }
  }

  const channelColors: Record<string, string> = {
    discord: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
    telegram: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
    webhook: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  };

  return (
    <Card className="border-border/60">
      <CardContent className="py-4 px-4 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{dest.name}</span>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${channelColors[dest.channel] ?? ""}`}
            >
              {dest.channel}
            </span>
            <Badge variant={dest.enabled ? "default" : "secondary"} className="text-xs">
              {dest.deliveryMode === "dry_run" ? "dry run" : dest.enabled ? "live" : "paused"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground truncate">{dest.destinationUrl}</p>
          {dest.purpose && (
            <p className="text-xs text-muted-foreground">Purpose: {dest.purpose}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Min severity: {dest.minimumSeverity}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
          onClick={handleDelete}
          disabled={deleting}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </CardContent>
    </Card>
  );
}

function CreateDestForm({
  clientId,
  entitlements,
  onCreated,
}: {
  clientId: string;
  entitlements: RadarClientEntitlementSummary;
  onCreated: (d: RadarDeliveryDestination) => void;
}) {
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<"discord" | "telegram" | "webhook">("discord");
  const [url, setUrl] = useState("");
  const [purpose, setPurpose] = useState("");
  const [minimumSeverity, setMinimumSeverity] = useState<"watch" | "warning" | "critical">("watch");
  const [mode, setMode] = useState<"live" | "dry_run">("live");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableChannels = [
    { value: "discord", label: "Discord", enabled: entitlements.discordEnabled },
    { value: "telegram", label: "Telegram", enabled: entitlements.telegramEnabled },
    { value: "webhook", label: "Webhook", enabled: entitlements.webhookEnabled },
  ].filter((c) => c.enabled);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const d = await createDeliveryDestination({
        clientId,
        name,
        channel,
        destinationUrl: url,
        purpose: purpose || undefined,
        enabled: true,
        deliveryMode: mode,
        minimumSeverity,
        monitorTypes: [],
        sources: [],
        assets: [],
        chains: [],
        routes: [],
      });
      onCreated(d);
      setName("");
      setUrl("");
      setPurpose("");
    } catch (err: unknown) {
      const detail = (err as { detail?: { detail?: string } })?.detail?.detail;
      setError(detail ?? (err instanceof Error ? err.message : "Failed to create destination"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="text-base">New delivery destination</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="dest-name">Name *</Label>
              <Input
                id="dest-name"
                required
                placeholder="e.g. #alerts-critical"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dest-channel">Channel *</Label>
              <Select
                id="dest-channel"
                value={channel}
                onChange={(e) => setChannel(e.target.value as typeof channel)}
                disabled={loading}
              >
                {availableChannels.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dest-url">
              {channel === "discord" ? "Webhook URL" : channel === "telegram" ? "Bot token / chat ID URL" : "Webhook URL"} *
            </Label>
            <Input
              id="dest-url"
              required
              type="url"
              placeholder="https://…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="dest-severity">Min severity</Label>
              <Select
                id="dest-severity"
                value={minimumSeverity}
                onChange={(e) => setMinimumSeverity(e.target.value as typeof minimumSeverity)}
                disabled={loading}
              >
                <option value="watch">Watch</option>
                <option value="warning">Warning</option>
                <option value="critical">Critical</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dest-mode">Mode</Label>
              <Select
                id="dest-mode"
                value={mode}
                onChange={(e) => setMode(e.target.value as typeof mode)}
                disabled={loading}
              >
                <option value="live">Live</option>
                <option value="dry_run">Dry run</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dest-purpose">Purpose (optional)</Label>
              <Input
                id="dest-purpose"
                placeholder="e.g. critical-only"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" size="sm" disabled={loading}>
            <Plus className="mr-2 h-3.5 w-3.5" />
            Add destination
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function DestinationsPage() {
  const { me } = useAuth();
  const clientId = me?.activeAccount?.id ?? me?.memberships[0]?.account?.id ?? "";
  const [destinations, setDestinations] = useState<RadarDeliveryDestination[]>([]);
  const [entitlements, setEntitlements] = useState<RadarClientEntitlementSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    Promise.all([listDeliveryDestinations(clientId), getClientEntitlements(clientId)])
      .then(([d, e]) => {
        setDestinations(d);
        setEntitlements(e);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [clientId]);

  const canAdd =
    entitlements?.liveDeliveryEnabled &&
    (entitlements.destinationsLimit == null ||
      destinations.length < entitlements.destinationsLimit);

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Delivery destinations</h1>
          {entitlements && (
            <p className="text-sm text-muted-foreground mt-1">
              {destinations.length}
              {entitlements.destinationsLimit != null
                ? ` of ${entitlements.destinationsLimit}`
                : ""}{" "}
              destinations
            </p>
          )}
        </div>
        {canAdd && (
          <Button size="sm" onClick={() => setShowForm((p) => !p)}>
            <Plus className="mr-2 h-3.5 w-3.5" />
            {showForm ? "Cancel" : "Add destination"}
          </Button>
        )}
      </div>

      {entitlements && !entitlements.liveDeliveryEnabled && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="py-3 px-4 text-sm">
            Live delivery is not included in your current plan. Upgrade to Radar Live or higher.
          </CardContent>
        </Card>
      )}

      {showForm && entitlements && clientId && (
        <CreateDestForm
          clientId={clientId}
          entitlements={entitlements}
          onCreated={(d) => {
            setDestinations((p) => [d, ...p]);
            setShowForm(false);
          }}
        />
      )}

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : destinations.length === 0 ? (
        <Card className="border-border/60">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No delivery destinations configured yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {destinations.map((d) => (
            <DestCard
              key={d.id}
              dest={d}
              onDelete={(id) => setDestinations((p) => p.filter((x) => x.id !== id))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
