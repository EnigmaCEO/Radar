"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowRight, CheckCircle, CreditCard, Loader2, Shield, ShieldCheck } from "lucide-react";
import { useAccount } from "@/lib/account-context";
import { getPlanLabel, resolvePlan } from "@/lib/plan-limits";
import { isPlanPausedStatus, type EffectiveEntitlementStatus } from "@/lib/plan-compliance-ui";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const PLAN_ORDER = ["public_record", "watch", "radar_intel", "radar_signal", "desk"] as const;
type CustomerPlan = (typeof PLAN_ORDER)[number];
type Plan = CustomerPlan | "internal";

const NEXT_PLAN: Partial<Record<CustomerPlan, CustomerPlan | "desk">> = {
  public_record: "watch",
  watch: "radar_signal",
  radar_signal: "desk",
  radar_intel: "desk",
};

const STATUS_CLASS: Record<string, string> = {
  trial: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
  active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  past_due: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  suspended: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  canceled: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
};

interface ComplianceDestination {
  effectiveStatus: EffectiveEntitlementStatus;
}

interface ComplianceWatchlist {
  effectiveStatus: EffectiveEntitlementStatus;
}

export default function SettingsPage() {
  const { account, userEmail } = useAccount();
  const searchParams = useSearchParams();
  const router = useRouter();

  const plan = resolvePlan(account.plan, account.isAdmin, account.adminViewPlan) as Plan;
  const nextPlan = plan === "internal" ? undefined : NEXT_PLAN[plan];

  const checkoutStatus = searchParams.get("checkout");
  const requestedUpgrade = searchParams.get("upgrade");

  const [mfaEnabled, setMfaEnabled] = useState<boolean | null>(null);
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaMessage, setMfaMessage] = useState<string | null>(null);
  const [upgrading, setUpgrading] = useState(false);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);
  const autoUpgradeAttemptedRef = useRef<string | null>(null);
  const [compliance, setCompliance] = useState<{
    destinations: ComplianceDestination[];
    watchlists: ComplianceWatchlist[];
  } | null>(null);

  useEffect(() => {
    if (checkoutStatus === "success") {
      router.refresh();
      const t = setTimeout(() => router.replace("/dashboard/settings"), 4000);
      return () => clearTimeout(t);
    }
  }, [checkoutStatus, router]);

  useEffect(() => {
    fetch("/api/user/mfa")
      .then((r) => r.json())
      .then((d) => setMfaEnabled(d.enabled))
      .catch(() => setMfaEnabled(false));
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/destinations").then(async (response) => {
        const data = await response.json();
        return response.ok ? (data as ComplianceDestination[]) : [];
      }),
      fetch("/api/watchlists").then(async (response) => {
        const data = await response.json();
        return response.ok ? (data as ComplianceWatchlist[]) : [];
      }),
    ])
      .then(([destinations, watchlists]) => setCompliance({ destinations, watchlists }))
      .catch(() => setCompliance(null));
  }, []);

  useEffect(() => {
    if (!requestedUpgrade || checkoutStatus === "success") return;
    if (requestedUpgrade !== "watch" && requestedUpgrade !== "radar_signal" && requestedUpgrade !== "radar_intel") {
      return;
    }
    if (requestedUpgrade === plan) return;
    if (autoUpgradeAttemptedRef.current === requestedUpgrade) return;

    autoUpgradeAttemptedRef.current = requestedUpgrade;
    void startUpgrade(requestedUpgrade as CustomerPlan);
  }, [checkoutStatus, plan, requestedUpgrade]);

  async function toggleMfa() {
    if (mfaEnabled === null) return;
    setMfaLoading(true);
    setMfaMessage(null);
    try {
      const res = await fetch("/api/user/mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !mfaEnabled }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMfaEnabled(data.enabled);
      setMfaMessage(
        data.enabled
          ? "MFA enabled. You'll be prompted to enroll on next login."
          : "MFA disabled.",
      );
    } catch (error) {
      setMfaMessage(
        error instanceof Error ? error.message : "Failed to update MFA. Please try again.",
      );
    } finally {
      setMfaLoading(false);
    }
  }

  async function startUpgrade(targetPlan: CustomerPlan) {
    setUpgrading(true);
    setUpgradeError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: targetPlan }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Upgrade failed");
      }
      window.location.href = data.url;
    } catch (error) {
      setUpgradeError(
        error instanceof Error
          ? error.message
          : "Unable to process upgrade. Please try again or contact support.",
      );
      setUpgrading(false);
    }
  }

  const activeDestinations = compliance?.destinations.filter((destination) => destination.effectiveStatus === "active").length ?? 0;
  const pausedDestinations =
    compliance?.destinations.filter((destination) => isPlanPausedStatus(destination.effectiveStatus)).length ?? 0;
  const activeWatchlists = compliance?.watchlists.filter((watchlist) => watchlist.effectiveStatus === "active").length ?? 0;
  const pausedWatchlists =
    compliance?.watchlists.filter((watchlist) => isPlanPausedStatus(watchlist.effectiveStatus)).length ?? 0;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your account and subscription.</p>
      </div>

      {checkoutStatus === "success" && (
        <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-600 dark:text-green-400">
          <CheckCircle className="h-4 w-4 shrink-0" />
          Plan updated successfully. Your new plan is now active.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>Your account details.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Name</span>
            <span className="font-medium">{account.name || "-"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Email</span>
            <span className="font-medium">{userEmail || "-"}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            {mfaEnabled ? (
              <ShieldCheck className="h-4 w-4 text-green-500" />
            ) : (
              <Shield className="h-4 w-4" />
            )}
            Security
          </CardTitle>
          <CardDescription>Protect your account with multi-factor authentication.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Two-factor authentication</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {mfaEnabled
                  ? "MFA is active. You'll be prompted on each login."
                  : "Add an extra layer of security to your account."}
              </p>
            </div>
            <Button
              size="sm"
              variant={mfaEnabled ? "outline" : "default"}
              className={mfaEnabled ? "" : "bg-violet-600 text-white hover:bg-violet-700"}
              onClick={toggleMfa}
              disabled={mfaLoading || mfaEnabled === null}
            >
              {mfaLoading ? "Updating..." : mfaEnabled ? "Disable" : "Enable"}
            </Button>
          </div>
          {mfaMessage && <p className="text-xs text-muted-foreground">{mfaMessage}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-4 w-4" />
            Billing
          </CardTitle>
          <CardDescription>Your subscription plan and billing details.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Current plan</span>
            <span className="font-semibold">{getPlanLabel(account.plan, account.isAdmin, account.adminViewPlan)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Status</span>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[account.status] ?? ""}`}
            >
              {account.status}
            </span>
          </div>

          <div className="flex flex-col gap-2 pt-2 sm:flex-row">
            {nextPlan &&
              (nextPlan === "desk" ? (
                <Button size="sm" className="bg-violet-600 text-white hover:bg-violet-700" asChild>
                  <a href="mailto:radar@sagitta.systems?subject=Radar Desk Plan">
                    Talk to us <ArrowRight className="ml-1 h-3 w-3" />
                  </a>
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="bg-violet-600 text-white hover:bg-violet-700"
                  disabled={upgrading}
                  onClick={() => startUpgrade(nextPlan)}
                >
                  {upgrading ? (
                    <>
                      <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> Upgrading...
                    </>
                  ) : (
                    <>
                      Upgrade to {getPlanLabel(nextPlan, false, null)} <ArrowRight className="ml-1 h-3 w-3" />
                    </>
                  )}
                </Button>
              ))}

            {plan !== "radar_intel" && plan !== "desk" && plan !== "internal" && (
              <Button size="sm" variant="outline" disabled={upgrading} onClick={() => startUpgrade("radar_intel")}>
                Add Intel
              </Button>
            )}

            {account.stripeCustomerId && (
              <Button size="sm" variant="outline" asChild>
                <Link href="/api/stripe/portal">Manage billing</Link>
              </Button>
            )}
          </div>

          {upgradeError && <p className="text-xs text-red-500">{upgradeError}</p>}

          <p className="text-xs text-muted-foreground">
            Powered by Stripe. Your payment information is never stored on our servers.
          </p>
        </CardContent>
      </Card>

      {compliance && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Plan compliance</CardTitle>
            <CardDescription>Saved configuration stays intact. Delivery and matching only run on items your current plan can keep active.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Destinations</span>
              <span>{activeDestinations} active · {pausedDestinations} paused</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Watchlists</span>
              <span>{activeWatchlists} active · {pausedWatchlists} paused</span>
            </div>
            {(pausedDestinations > 0 || pausedWatchlists > 0) && (
              <Button size="sm" className="bg-violet-600 text-white hover:bg-violet-700" asChild>
                <Link href={nextPlan && nextPlan !== "desk" ? `/dashboard/settings?upgrade=${nextPlan}` : "/dashboard/settings"}>
                  Review upgrade options <ArrowRight className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
