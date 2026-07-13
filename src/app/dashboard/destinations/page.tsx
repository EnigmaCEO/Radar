"use client";

import { startTransition, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  Pencil,
  Play,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  XCircle,
} from "lucide-react";
import { useAccount } from "@/lib/account-context";
import {
  canConfigurePrivateDestinations,
  canRunManualDelivery,
  getAllowedDeliveryModes,
  getAllowedDestinationChannels,
  getDestinationLimit,
  getPlanLabel,
  resolvePlan,
} from "@/lib/plan-limits";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  DELIVERY_MODE_HELPER_TEXT,
  DELIVERY_MODE_LABEL,
  type DeliveryMode,
} from "@/lib/delivery-modes";
import {
  formatManualDeliveryReason,
  getManualDeliveryIssueLabel,
  getManualDeliveryIssueTone,
} from "@/lib/manual-delivery-copy";
import {
  deriveExcludedEventsForDisplay,
  deriveMatchedAlertsForDisplay,
  type ManualDeliveryAlertResultDebug,
  type ManualDeliveryExcludedEvent,
  type ManualDeliveryMatchedAlert,
} from "@/lib/manual-delivery-results";

interface Destination {
  id: string;
  name: string;
  channel: string;
  destinationUrl: string;
  deliveryMode: DeliveryMode;
  enabled: boolean;
  minimumSeverity: string;
  pollingFrequency: string;
  lastPolledAt: string | null;
  configPreview: Record<string, string | null> | null;
  createdAt: string;
}

const PLAN_LIMITS: Record<string, number> = {
  free: 1,
  radar_live: 2,
  radar_pro: 10,
  managed: Infinity,
};

const PLAN_CHANNELS: Record<string, string[]> = {
  free: ["webhook"],
  radar_live: ["webhook", "discord_webhook", "telegram_bot"],
  radar_pro: ["webhook", "discord_webhook", "telegram_bot", "x_account"],
  managed: ["webhook", "discord_webhook", "telegram_bot", "x_account"],
};

const CHANNEL_LABEL: Record<string, string> = {
  discord_webhook: "Discord",
  telegram_bot: "Telegram",
  webhook: "Webhook",
  x_account: "X (Twitter)",
};

const CHANNEL_COLORS: Record<string, string> = {
  discord_webhook: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  telegram_bot: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
  webhook: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  x_account: "bg-zinc-100 text-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-300",
};

const DELIVERY_MODE_COLORS: Record<DeliveryMode, string> = {
  alert_fanout: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
  public_thread: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
  digest: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  announcement_feed: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
};

const FREQUENCY_LABEL: Record<string, string> = {
  "15min": "Every 15 min",
  "30min": "Every 30 min",
  "1hr": "Hourly",
  "24hr": "Daily digest",
};

const DAILY_DIGEST_FREQUENCY = "24hr";

// Cadence is chosen at delivery-creation time (not enforced in the DB). Watch is
// limited to the daily-digest cadence; Signal and above can pick per-cycle options.
function getAllowedFrequencies(plan: string, isAdmin = false): string[] {
  return resolvePlan(plan, isAdmin) === "watch"
    ? [DAILY_DIGEST_FREQUENCY]
    : Object.keys(FREQUENCY_LABEL);
}

const TELEGRAM_SETUP_STEPS = [
  "Add @RadarSagittaBot to the target group, supergroup, or channel.",
  "Send at least one message in the chat after adding the bot so Telegram generates updates for that conversation.",
  "If this is a channel or locked-down group, promote the bot to an admin so it can post alerts.",
  "Paste the full numeric chat ID here. Supergroups and channels usually start with -100.",
];

function DestCard({
  dest,
  allowedFrequencies,
  allowedDeliveryModes,
  onReload,
}: {
  dest: Destination;
  allowedFrequencies: string[];
  allowedDeliveryModes: DeliveryMode[];
  onReload: () => Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"ok" | "failed" | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(dest.name);
  const [editUrl, setEditUrl] = useState(dest.destinationUrl);
  const [editDeliveryMode, setEditDeliveryMode] = useState<DeliveryMode>(dest.deliveryMode);
  const [editSeverity, setEditSeverity] = useState(dest.minimumSeverity);
  const [editFrequency, setEditFrequency] = useState(dest.pollingFrequency);
  const [saving, setSaving] = useState(false);

  async function handleDelete() {
    if (!confirm("Remove this delivery destination?")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/destinations/${dest.id}`, {
        method: "DELETE",
        cache: "no-store",
      });
      if (res.ok) {
        await onReload();
      }
    } finally {
      setDeleting(false);
    }
  }

  async function handleToggle() {
    setToggling(true);
    try {
      const res = await fetch(`/api/destinations/${dest.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !dest.enabled }),
        cache: "no-store",
      });
      if (res.ok) {
        await onReload();
      }
    } finally {
      setToggling(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    setTestError(null);
    try {
      const res = await fetch(`/api/destinations/${dest.id}/test`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setTestResult("ok");
      } else {
        setTestResult("failed");
        setTestError(data.error ?? "Test failed");
      }
    } catch {
      setTestResult("failed");
      setTestError("Could not reach the test endpoint");
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/destinations/${dest.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          destinationUrl: editUrl,
          deliveryMode: editDeliveryMode,
          minimumSeverity: editSeverity,
          pollingFrequency: editFrequency,
        }),
        cache: "no-store",
      });
      const data = await res.json();
      if (res.ok) {
        await onReload();
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  }

  const identifier =
    dest.channel === "x_account"
      ? dest.destinationUrl
      : dest.channel === "telegram_bot"
        ? `Chat ID: ${dest.destinationUrl}`
        : dest.configPreview?.maskedUrl ?? dest.destinationUrl;

  return (
    <Card className="border-border/60">
      {editing ? (
        <CardContent className="py-4 px-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} disabled={saving} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">
                {dest.channel === "telegram_bot"
                  ? "Chat ID"
                  : dest.channel === "x_account"
                    ? "X Handle"
                    : "URL"}
              </Label>
              <Input value={editUrl} onChange={(e) => setEditUrl(e.target.value)} disabled={saving} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Report cadence</Label>
              <Select
                value={editFrequency}
                onChange={(e) => setEditFrequency(e.target.value)}
                disabled={saving || allowedFrequencies.length <= 1}
              >
                {Object.entries(FREQUENCY_LABEL)
                  .filter(([value]) => allowedFrequencies.includes(value) || value === dest.pollingFrequency)
                  .map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Delivery mode</Label>
              <Select
                value={editDeliveryMode}
                onChange={(e) => setEditDeliveryMode(e.target.value as DeliveryMode)}
                disabled={saving || allowedDeliveryModes.length <= 1}
              >
                {Object.entries(DELIVERY_MODE_LABEL)
                  .filter(([value]) => allowedDeliveryModes.includes(value as DeliveryMode) || value === dest.deliveryMode)
                  .map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
              </Select>
              <p className="text-xs text-muted-foreground">
                {DELIVERY_MODE_HELPER_TEXT[editDeliveryMode]}
              </p>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Minimum severity</Label>
              <Select
                value={editSeverity}
                onChange={(e) => setEditSeverity(e.target.value)}
                disabled={saving}
              >
                <option value="watch">Watch</option>
                <option value="warning">Warning</option>
                <option value="critical">Critical</option>
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </Button>
          </div>
        </CardContent>
      ) : (
        <CardContent className="py-4 px-4 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">{dest.name}</span>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${CHANNEL_COLORS[dest.channel] ?? ""}`}
              >
                {CHANNEL_LABEL[dest.channel] ?? dest.channel}
              </span>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${DELIVERY_MODE_COLORS[dest.deliveryMode]}`}
              >
                {DELIVERY_MODE_LABEL[dest.deliveryMode]}
              </span>
              <Badge variant={dest.enabled ? "default" : "secondary"} className="text-xs">
                {dest.enabled ? "active" : "paused"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground font-mono truncate">{identifier}</p>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{FREQUENCY_LABEL[dest.pollingFrequency] ?? dest.pollingFrequency}</span>
              <span>|</span>
              <span>{DELIVERY_MODE_LABEL[dest.deliveryMode]}</span>
              <span>|</span>
              <span>Min severity: {dest.minimumSeverity}</span>
            </div>
            {testResult === "ok" && (
              <p className="text-xs text-green-500">Test message sent successfully.</p>
            )}
            {testResult === "failed" && testError && (
              <p className="text-xs text-red-500">{testError}</p>
            )}
            {dest.channel === "x_account" && dest.configPreview?.credentialStatus && (
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  dest.configPreview.credentialStatus === "configured"
                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                    : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                }`}
              >
                {dest.configPreview.credentialStatus}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={handleTest}
              disabled={testing || dest.channel === "x_account"}
              title="Send a test message"
            >
              {testing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : testResult === "ok" ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              ) : testResult === "failed" ? (
                <XCircle className="h-3.5 w-3.5 text-red-500" />
              ) : null}
              <span className="ml-1">{testing ? "Testing..." : "Test"}</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={handleToggle}
              disabled={toggling}
              title={dest.enabled ? "Pause" : "Enable"}
            >
              {dest.enabled ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => setEditing(true)}
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
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function CreateDestForm({
  allowedChannels,
  allowedFrequencies,
  allowedDeliveryModes,
  onCreated,
  onCancel,
}: {
  allowedChannels: string[];
  allowedFrequencies: string[];
  allowedDeliveryModes: DeliveryMode[];
  onCreated: () => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [channel, setChannel] = useState(allowedChannels[0] ?? "discord_webhook");
  const [destinationUrl, setDestinationUrl] = useState("");
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>(
    allowedDeliveryModes.includes("alert_fanout")
      ? "alert_fanout"
      : allowedDeliveryModes[0] ?? "digest",
  );
  const [minimumSeverity, setMinimumSeverity] = useState("watch");
  const [pollingFrequency, setPollingFrequency] = useState(
    allowedFrequencies.includes("1hr") ? "1hr" : allowedFrequencies[0] ?? DAILY_DIGEST_FREQUENCY,
  );
  const [xCreds, setXCreds] = useState({
    apiKey: "",
    apiSecret: "",
    accessToken: "",
    accessTokenSecret: "",
    bearerToken: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleXCred(field: keyof typeof xCreds, value: string) {
    setXCreds((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        name,
        channel,
        destinationUrl,
        deliveryMode,
        minimumSeverity,
        pollingFrequency,
      };
      if (channel === "x_account") body.xCredentials = xCreds;

      const res = await fetch("/api/destinations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create destination");
      await onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create destination");
    } finally {
      setLoading(false);
    }
  }

  const CHANNEL_CONFIG: Record<
    string,
    { label: string; placeholder: string; type: string; hint?: string }
  > = {
    discord_webhook: {
      label: "Webhook URL",
      placeholder: "https://discord.com/api/webhooks/...",
      type: "url",
      hint: "In Discord, open Server Settings -> Integrations -> Webhooks -> New Webhook.",
    },
    telegram_bot: {
      label: "Chat ID",
      placeholder: "e.g. -1001234567890",
      type: "text",
      hint: "Telegram setup is more involved than Discord or webhooks. Use the checklist below before saving the destination.",
    },
    webhook: {
      label: "Endpoint URL",
      placeholder: "https://your-endpoint.example.com/webhook",
      type: "url",
      hint: "Radar will POST a JSON payload to this URL for each delivery run.",
    },
  };

  const cfg = CHANNEL_CONFIG[channel];

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
                onChange={(e) => {
                  setChannel(e.target.value);
                  setDestinationUrl("");
                }}
                disabled={loading}
              >
                {allowedChannels.map((value) => (
                  <option key={value} value={value}>
                    {CHANNEL_LABEL[value] ?? value}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dest-mode">Delivery mode</Label>
            <Select
              id="dest-mode"
              value={deliveryMode}
              onChange={(e) => setDeliveryMode(e.target.value as DeliveryMode)}
              disabled={loading || allowedDeliveryModes.length <= 1}
            >
              {Object.entries(DELIVERY_MODE_LABEL)
                .filter(([value]) => allowedDeliveryModes.includes(value as DeliveryMode))
                .map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
            </Select>
            <p className="text-xs text-muted-foreground">{DELIVERY_MODE_HELPER_TEXT[deliveryMode]}</p>
          </div>

          {channel === "x_account" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="dest-handle">X handle *</Label>
                <Input
                  id="dest-handle"
                  required
                  placeholder="@yourprotocol"
                  value={destinationUrl}
                  onChange={(e) => setDestinationUrl(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="rounded-md border border-border/60 p-4 space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  X API credentials
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(
                    [
                      "apiKey",
                      "apiSecret",
                      "accessToken",
                      "accessTokenSecret",
                      "bearerToken",
                    ] as const
                  ).map((field) => (
                    <div
                      key={field}
                      className={field === "bearerToken" ? "sm:col-span-2 space-y-2" : "space-y-2"}
                    >
                      <Label htmlFor={`x-${field}`} className="text-xs">
                        {field === "apiKey"
                          ? "API Key"
                          : field === "apiSecret"
                            ? "API Secret"
                            : field === "accessToken"
                              ? "Access Token"
                              : field === "accessTokenSecret"
                                ? "Access Token Secret"
                                : "Bearer Token"}{" "}
                        *
                      </Label>
                      <Input
                        id={`x-${field}`}
                        required
                        type="password"
                        value={xCreds[field]}
                        onChange={(e) => handleXCred(field, e.target.value)}
                        disabled={loading}
                        className="font-mono text-xs"
                      />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Credentials are encrypted before storage and never returned to the client.
                </p>
              </div>
            </>
          ) : cfg ? (
            <div className="space-y-2">
              <Label htmlFor="dest-url">{cfg.label} *</Label>
              <Input
                id="dest-url"
                required
                type={cfg.type}
                placeholder={cfg.placeholder}
                value={destinationUrl}
                onChange={(e) => setDestinationUrl(e.target.value)}
                disabled={loading}
              />
              {cfg.hint && <p className="text-xs text-muted-foreground">{cfg.hint}</p>}
              {channel === "telegram_bot" && (
                <div className="rounded-md border border-border/60 bg-muted/20 p-3 space-y-2 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">Telegram setup checklist</p>
                  <ul className="list-disc space-y-1 pl-4">
                    {TELEGRAM_SETUP_STEPS.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ul>
                  <p>
                    If you are not sure which chat ID to use, verify it before saving. The wrong ID
                    will pass form validation but the bot will not be able to deliver alerts.
                  </p>
                </div>
              )}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="dest-frequency">Report cadence</Label>
              <Select
                id="dest-frequency"
                value={pollingFrequency}
                onChange={(e) => setPollingFrequency(e.target.value)}
                disabled={loading || allowedFrequencies.length <= 1}
              >
                {Object.entries(FREQUENCY_LABEL)
                  .filter(([value]) => allowedFrequencies.includes(value))
                  .map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
              </Select>
              {allowedFrequencies.length <= 1 && (
                <p className="text-xs text-muted-foreground">
                  Watch delivers a daily digest. Upgrade to Signal for per-cycle delivery.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="dest-severity">Minimum severity</Label>
              <Select
                id="dest-severity"
                value={minimumSeverity}
                onChange={(e) => setMinimumSeverity(e.target.value)}
                disabled={loading}
              >
                <option value="watch">Watch</option>
                <option value="warning">Warning</option>
                <option value="critical">Critical</option>
              </Select>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={loading}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              {loading ? "Adding..." : "Add destination"}
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

interface ChannelResult {
  destinationId: string;
  channel: string;
  deliveryMode: DeliveryMode;
  name: string;
  status: "sent" | "failed" | "blocked" | "dry_run" | "skipped";
  messageCount: number;
  briefingCount: number;
  groupsGenerated: number;
  previewMessages?: DeliveryPreviewMessage[];
  reason?: string;
}

interface DeliveryPreviewMessage {
  messageIndex: number;
  format:
    | "telegram_text"
    | "discord_embed"
    | "discord_text"
    | "webhook_json"
    | "public_thread_text"
    | "digest_text";
  title?: string;
  text?: string;
  embed?: Record<string, unknown>;
  json?: Record<string, unknown>;
  characterCount: number;
  truncated: boolean;
  warning?: string;
}

interface AlertResult {
  alertId: string;
  eventId?: string | null;
  eventType?: string | null;
  status?: string;
  monitorType: string;
  severity: string;
  title: string;
  summary: string;
  matchedWatchlistIds: string[];
  matchedWatchlistNames: string[];
  skippedReasons: string[];
  skippedReason?: string;
}

interface UnmatchedAlertReason {
  alertId: string;
  reasons: string[];
}

interface WatchlistMatchDetail {
  watchlistId: string;
  name: string;
  enabled: boolean;
  minSeverity: string;
  hasFilters: boolean;
  matchedAlertCount: number;
}

interface DeliveryRunResult {
  status: "success" | "partial" | "no_matches" | "failed" | "dry_run";
  window: string;
  ledgerEventsFetched?: number;
  eventsInsideWindow?: number;
  uniqueAlertsMatched?: number;
  alertsFetched: number;
  alertsInsideWindow: number;
  activeWatchlistsLoaded: number;
  broadWatchlistsLoaded: number;
  alertsMatched: number;
  watchlistsMatched: number;
  destinationsMatched: number;
  briefingsGenerated?: number;
  groupsGenerated?: number;
  messagesGenerated?: number;
  deliveriesAttempted: number;
  deliveriesSucceeded: number;
  deliveriesFailed: number;
  deliveriesSkipped: number;
  channelResults: ChannelResult[];
  matchedAlerts?: ManualDeliveryMatchedAlert[];
  excludedEvents?: ManualDeliveryExcludedEvent[];
  alertResults: ManualDeliveryAlertResultDebug[];
  unmatchedAlertReasons: UnmatchedAlertReason[];
  watchlistMatchDetails: WatchlistMatchDetail[];
  deliveryLogIds: string[];
  latestError: string | null;
}

function formatDebugPayload(rawText: string): string {
  if (rawText.trim().length === 0) return "(empty response body)";
  try {
    return JSON.stringify(JSON.parse(rawText), null, 2);
  } catch {
    return rawText;
  }
}

function parseDebugPayload(rawText: string): Record<string, unknown> {
  if (rawText.trim().length === 0) return {};
  try {
    return JSON.parse(rawText) as Record<string, unknown>;
  } catch {
    return { rawText };
  }
}

function formatPreviewMessageBody(preview: DeliveryPreviewMessage): string {
  if (typeof preview.text === "string") return preview.text;
  if (preview.embed) return JSON.stringify(preview.embed, null, 2);
  if (preview.json) return JSON.stringify(preview.json, null, 2);
  return "(empty preview)";
}

const RUN_STATUS_VARIANT: Record<
  DeliveryRunResult["status"],
  "default" | "secondary" | "destructive"
> = {
  success: "default",
  dry_run: "secondary",
  no_matches: "secondary",
  partial: "secondary",
  failed: "destructive",
};

const CHANNEL_RESULT_COLOR: Record<ChannelResult["status"], string> = {
  sent: "text-green-500",
  dry_run: "text-muted-foreground",
  skipped: "text-muted-foreground",
  blocked: "text-amber-500",
  failed: "text-red-500",
};

function ManualDeliveryPanel({
  onRunComplete,
}: {
  onRunComplete?: () => Promise<void>;
}) {
  const router = useRouter();
  const [window_, setWindow] = useState("15min");
  const [running, setRunning] = useState<"live" | "dry" | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [result, setResult] = useState<DeliveryRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [debugStatus, setDebugStatus] = useState<number | null>(null);
  const [debugPayload, setDebugPayload] = useState<string | null>(null);

  async function run(dryRun: boolean) {
    setRunning(dryRun ? "dry" : "live");
    setError(null);
    setResult(null);
    setDebugStatus(null);
    setDebugPayload(null);
    try {
      const res = await fetch("/api/radar/delivery/run-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun, window: window_ }),
        cache: "no-store",
      });
      const rawText = await res.text();
      setDebugStatus(res.status);
      setDebugPayload(formatDebugPayload(rawText));
      const data = parseDebugPayload(rawText);
      const errorMessage =
        typeof data.error === "string" ? data.error : "Manual delivery cycle failed";
      if (!res.ok) throw new Error(errorMessage);
      setResult(data as unknown as DeliveryRunResult);
      setRefreshing(true);
      await onRunComplete?.();
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Manual delivery cycle failed");
      setResult(null);
    } finally {
      setRefreshing(false);
      setRunning(null);
    }
  }

  function getResultSummary(runResult: DeliveryRunResult): string | null {
    const fetched = runResult.ledgerEventsFetched ?? runResult.alertsFetched;
    const insideWindow = runResult.eventsInsideWindow ?? runResult.alertsInsideWindow;

    if (fetched > 0 && insideWindow === 0) {
      return `Dry run completed. ${fetched} ledger events were fetched, but none were inside the selected ${runResult.window} window.`;
    }
    if (runResult.status === "dry_run" && runResult.destinationsMatched > 0) {
      return `Dry run completed. ${runResult.uniqueAlertsMatched ?? runResult.alertsMatched} unique alerts matched and ${runResult.destinationsMatched} destinations were eligible, but no messages were sent because this was a dry run.`;
    }
    if (runResult.status === "no_matches" && insideWindow > 0) {
      return "Alerts were inside the selected window, but none matched an active watchlist at the required severity.";
    }
    if (runResult.status === "success") {
      return "Manual delivery cycle completed and messages were sent.";
    }
    return null;
  }

  const resultSummary = result ? getResultSummary(result) : null;
  const matchedAlerts = result ? deriveMatchedAlertsForDisplay(result) : [];
  const excludedEvents = result ? deriveExcludedEventsForDisplay(result) : [];
  const latestIssueStatus = result?.latestError
    ? [...result.channelResults].reverse().find((entry) => entry.reason === result.latestError)?.status
    : null;
  const latestIssueMessage = formatManualDeliveryReason(result?.latestError);
  const latestIssueLabel = getManualDeliveryIssueLabel(latestIssueStatus);
  const latestIssueTone = getManualDeliveryIssueTone(latestIssueStatus);
  const latestIssueClass =
    latestIssueTone === "error"
      ? "text-destructive"
      : latestIssueTone === "warning"
        ? "text-amber-500"
        : "text-muted-foreground";

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Manual delivery cycle</CardTitle>
        <p className="text-xs text-muted-foreground">
          Fetch the latest SCE alerts, match them against your active watchlists, and deliver to each active destination using its configured mode.
          No cron - this only runs when you click a button below.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={window_}
            onChange={(e) => setWindow(e.target.value)}
            className="w-32"
            disabled={running !== null || refreshing}
            aria-label="Alert window"
          >
            <option value="15min">Last 15 min</option>
            <option value="1h">Last 1 hour</option>
            <option value="24h">Last 24 hours</option>
          </Select>
          <Button size="sm" onClick={() => run(false)} disabled={running !== null || refreshing}>
            {running === "live" ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="mr-1.5 h-3.5 w-3.5" />
            )}
            Run manual delivery cycle
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => run(true)}
            disabled={running !== null || refreshing}
          >
            {running === "dry" && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Dry run
          </Button>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {refreshing && <p className="text-xs text-muted-foreground">Refreshing delivery state...</p>}

        {result && (
          <div className="space-y-3 rounded-md border border-border/60 p-3">
            <div className="flex items-center gap-2">
              <Badge variant={RUN_STATUS_VARIANT[result.status]}>
                {result.status.replace("_", " ")}
              </Badge>
              <span className="text-xs text-muted-foreground">window: {result.window}</span>
            </div>

            {(() => {
              const fetched = result.ledgerEventsFetched ?? result.alertsFetched;
              const insideWindow = result.eventsInsideWindow ?? result.alertsInsideWindow;
              const uniqueAlertsMatched = result.uniqueAlertsMatched ?? result.alertsMatched;

              return (
            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              <div>
                <p className="text-muted-foreground">Ledger events fetched</p>
                <p className="font-medium">{fetched}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Events in window</p>
                <p className="font-medium">{insideWindow}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Unique alerts matched</p>
                <p className="font-medium">{uniqueAlertsMatched}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Watchlists matched</p>
                <p className="font-medium">{result.watchlistsMatched}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Destinations matched</p>
                <p className="font-medium">{result.destinationsMatched}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Active watchlists</p>
                <p className="font-medium">{result.activeWatchlistsLoaded}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Broad watchlists</p>
                <p className="font-medium">{result.broadWatchlistsLoaded}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Briefings</p>
                <p className="font-medium">{result.briefingsGenerated ?? 0}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Groups generated</p>
                <p className="font-medium">{result.groupsGenerated ?? 0}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Messages</p>
                <p className="font-medium">{result.messagesGenerated ?? 0}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Sent</p>
                <p className="font-medium text-green-500">{result.deliveriesSucceeded}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Failed</p>
                <p className="font-medium text-red-500">{result.deliveriesFailed}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Skipped</p>
                <p className="font-medium">{result.deliveriesSkipped}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Delivery logs</p>
                <p className="font-medium">{result.deliveryLogIds.length}</p>
              </div>
            </div>
              );
            })()}

            {latestIssueMessage && (
              <p className={`text-xs ${latestIssueClass}`}>
                {latestIssueLabel}: {latestIssueMessage}
              </p>
            )}

            {resultSummary && <p className="text-xs text-muted-foreground">{resultSummary}</p>}

            {result.channelResults.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Per-destination results
                </p>
                {result.channelResults.map((entry) => (
                  <div key={entry.destinationId} className="rounded-md border border-border/60 p-2">
                    <div className="flex items-center justify-between text-xs">
                      <span>
                        {entry.name}{" "}
                        <span className="text-muted-foreground">
                          ({entry.channel}, {DELIVERY_MODE_LABEL[entry.deliveryMode]})
                        </span>
                      </span>
                      <span className={CHANNEL_RESULT_COLOR[entry.status]}>
                        {entry.status} - {entry.messageCount} message
                        {entry.messageCount === 1 ? "" : "s"}
                        {entry.briefingCount > 0
                          ? ` - ${entry.briefingCount} briefing${entry.briefingCount === 1 ? "" : "s"}`
                          : ""}
                        {entry.groupsGenerated > 0
                          ? ` - ${entry.groupsGenerated} group${entry.groupsGenerated === 1 ? "" : "s"}`
                          : ""}
                        {entry.reason ? ` - ${formatManualDeliveryReason(entry.reason)}` : ""}
                      </span>
                    </div>
                    {entry.previewMessages && entry.previewMessages.length > 0 && (
                      <details className="mt-2 rounded-md border border-border/60 bg-muted/20 p-2">
                        <summary className="cursor-pointer text-xs text-muted-foreground">
                          Preview messages ({entry.previewMessages.length})
                        </summary>
                        <div className="mt-2 space-y-2">
                          {entry.previewMessages.map((preview) => (
                            <div key={`${entry.destinationId}-${preview.messageIndex}`} className="space-y-1 text-xs">
                              <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
                                <span className="font-medium text-foreground">
                                  #{preview.messageIndex + 1}
                                </span>
                                <span>{preview.format}</span>
                                <span>{preview.characterCount} chars</span>
                                {preview.truncated && <span>truncated</span>}
                              </div>
                              {preview.title && (
                                <p className="font-medium text-foreground">{preview.title}</p>
                              )}
                              {preview.warning && (
                                <p className="text-amber-500">{preview.warning}</p>
                              )}
                              <pre className="max-h-64 overflow-auto rounded-md bg-muted/40 p-3 text-[11px] leading-5 text-muted-foreground whitespace-pre-wrap break-words">
                                {formatPreviewMessageBody(preview)}
                              </pre>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            )}

            {matchedAlerts.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Matched alerts
                </p>
                <div className="max-h-48 space-y-1 overflow-y-auto">
                  {matchedAlerts.map((alert) => (
                    <div key={alert.alertId} className="text-xs">
                      <span className="text-muted-foreground">
                        [{alert.severity}] {alert.monitorType}
                      </span>{" "}
                      {alert.title}{" "}
                      <span className="text-muted-foreground">
                        {"->"} {alert.matchedWatchlistNames.join(", ")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {excludedEvents.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Excluded from delivery
                </p>
                <div className="max-h-48 space-y-1 overflow-y-auto">
                  {excludedEvents.map((event) => (
                    <div key={`${event.alertId}-${event.eventId ?? event.eventType ?? "excluded"}`} className="text-xs">
                      <span className="text-muted-foreground">
                        [{event.severity}] {event.monitorType}
                        {event.eventType ? ` ${event.eventType}` : ""}
                        {event.status ? ` ${event.status}` : ""}
                      </span>{" "}
                      {event.title}{" "}
                      <span className="text-muted-foreground">- {event.skippedReasons.join(", ")}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.watchlistMatchDetails.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Per-watchlist match summary
                </p>
                {result.watchlistMatchDetails.map((watchlist) => (
                  <div key={watchlist.watchlistId} className="flex items-center justify-between text-xs">
                    <span>
                      {watchlist.name}
                      <span className="text-muted-foreground">
                        {" "}
                        ({watchlist.hasFilters ? "filtered" : "broad"}, min severity: {watchlist.minSeverity})
                      </span>
                    </span>
                    <span className="text-muted-foreground">{watchlist.matchedAlertCount} matched</span>
                  </div>
                ))}
              </div>
            )}

            {result.alertResults.length > 0 && (
              <details className="rounded-md border border-border/60 p-2">
                <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                  Full debug alert results ({result.alertResults.length})
                </summary>
                <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                  {result.alertResults.map((alert) => (
                    <div key={`${alert.alertId}-${alert.eventId ?? alert.eventType ?? "debug"}`} className="text-xs">
                      <span className="text-muted-foreground">
                        [{alert.severity}] {alert.monitorType}
                        {alert.eventType ? ` ${alert.eventType}` : ""}
                        {alert.status ? ` ${alert.status}` : ""}
                      </span>{" "}
                      {alert.title}{" "}
                      {alert.matchedWatchlistNames.length > 0 ? (
                        <span className="text-muted-foreground">
                          {"->"} {alert.matchedWatchlistNames.join(", ")}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">- {alert.skippedReason}</span>
                      )}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}

        {debugPayload && (
          <details className="rounded-md border border-border/60 p-3">
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
              Troubleshooting JSON{debugStatus !== null ? ` (HTTP ${debugStatus})` : ""}
            </summary>
            <pre className="mt-3 max-h-80 overflow-auto rounded-md bg-muted/40 p-3 text-[11px] leading-5 text-muted-foreground">
              {debugPayload}
            </pre>
          </details>
        )}
      </CardContent>
    </Card>
  );
}

export default function DestinationsPage() {
  const { account } = useAccount();
  const plan = account.plan;
  const allowedChannels = getAllowedDestinationChannels(plan, account.isAdmin);
  const allowedFrequencies = getAllowedFrequencies(plan, account.isAdmin);
  const allowedDeliveryModes = getAllowedDeliveryModes(plan, account.isAdmin);
  const destinationLimit = getDestinationLimit(plan, account.isAdmin);
  const destinationsEnabled = canConfigurePrivateDestinations(plan, account.isAdmin);
  const manualDeliveryEnabled = canRunManualDelivery(plan, account.isAdmin);

  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  async function loadDestinations() {
    setLoading(true);
    try {
      const response = await fetch(`/api/destinations?ts=${Date.now()}`, {
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "Failed to load destinations");
      }
      setDestinations(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch(`/api/destinations?ts=${Date.now()}`, {
          cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(typeof data?.error === "string" ? data.error : "Failed to load destinations");
        }
        if (!cancelled) {
          setDestinations(data);
        }
      } catch (error) {
        console.error(error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const atDestinationLimit = destinations.length >= destinationLimit;
  const canAdd = destinationsEnabled && !atDestinationLimit;

  return (
    <div className="max-w-7xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Delivery destinations</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {destinationsEnabled
              ? `${destinations.length}${Number.isFinite(destinationLimit) ? ` of ${destinationLimit}` : ""} destinations · ${getPlanLabel(plan)}`
              : "Not available on your current plan"}
          </p>
        </div>
        {canAdd && !showForm && (
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add destination
          </Button>
        )}
      </div>

      {manualDeliveryEnabled && (
        <ManualDeliveryPanel
          onRunComplete={async () => {
            await loadDestinations();
          }}
        />
      )}

      {!destinationsEnabled && (
        <Card className="border-violet-600/30 bg-violet-600/5">
          <CardContent className="py-4 px-4 flex items-center justify-between gap-4">
            <p className="text-sm">
              Private alert delivery is available on Watch, Signal, and Desk. Intel does not include private alert destinations.
            </p>
            <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-white shrink-0" asChild>
              <Link href="/dashboard/settings">
                Upgrade <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {destinationsEnabled && atDestinationLimit && !showForm && (
        <Card className="border-violet-600/30 bg-violet-600/5">
          <CardContent className="py-4 px-4 flex items-center justify-between gap-4">
            <p className="text-sm">
              You&apos;ve reached your plan&apos;s limit of {destinationLimit} delivery destination
              {destinationLimit === 1 ? "" : "s"}. Upgrade to Signal to add more.
            </p>
            <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-white shrink-0" asChild>
              <Link href="/dashboard/settings">
                Upgrade <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {showForm && destinationsEnabled && (
        <CreateDestForm
          allowedChannels={allowedChannels}
          allowedFrequencies={allowedFrequencies}
          allowedDeliveryModes={allowedDeliveryModes}
          onCreated={async () => {
            await loadDestinations();
            setShowForm(false);
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : destinations.length === 0 && !showForm ? (
        <Card className="border-border/60">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {destinationsEnabled
              ? "No delivery destinations yet. Add one to start receiving alerts."
              : "Upgrade your plan to configure delivery destinations."}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {destinations.map((destination) => (
            <DestCard
              key={destination.id}
              dest={destination}
              allowedFrequencies={allowedFrequencies}
              allowedDeliveryModes={allowedDeliveryModes}
              onReload={loadDestinations}
            />
          ))}
        </div>
      )}
    </div>
  );
}
