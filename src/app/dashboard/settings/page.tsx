"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowRight, CheckCircle, CreditCard, Loader2, Shield, ShieldCheck } from "lucide-react";
import { useAccount } from "@/lib/account-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const PLAN_ORDER = ["free", "radar_live", "radar_pro", "managed"] as const;
type Plan = (typeof PLAN_ORDER)[number];

const PLAN_LABEL: Record<Plan, string> = {
  free: "Free",
  radar_live: "Radar Live",
  radar_pro: "Radar Pro",
  managed: "Managed",
};

const NEXT_PLAN: Partial<Record<Plan, Plan>> = {
  free: "radar_live",
  radar_live: "radar_pro",
  radar_pro: "managed",
};

const STATUS_CLASS: Record<string, string> = {
  trial: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
  active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  past_due: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  suspended: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  canceled: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
};

export default function SettingsPage() {
  const { account, userEmail } = useAccount();
  const searchParams = useSearchParams();
  const router = useRouter();

  const plan = account.plan as Plan;
  const nextPlan = NEXT_PLAN[plan];

  const checkoutStatus = searchParams.get("checkout");
  const requestedUpgrade = searchParams.get("upgrade");

  const [mfaEnabled, setMfaEnabled] = useState<boolean | null>(null);
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaMessage, setMfaMessage] = useState<string | null>(null);
  const [upgrading, setUpgrading] = useState(false);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);
  const [autoUpgradeAttempted, setAutoUpgradeAttempted] = useState<string | null>(null);

  useEffect(() => {
    if (checkoutStatus === "success") {
      router.refresh(); // re-runs server components, re-fetches account from DB
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
    if (!requestedUpgrade || checkoutStatus === "success") return;
    if (requestedUpgrade !== "radar_live" && requestedUpgrade !== "radar_pro") return;
    if (requestedUpgrade === plan) return;
    if (autoUpgradeAttempted === requestedUpgrade) return;

    setAutoUpgradeAttempted(requestedUpgrade);
    void startUpgrade(requestedUpgrade);
  }, [autoUpgradeAttempted, checkoutStatus, plan, requestedUpgrade]);

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

  async function startUpgrade(targetPlan: Plan) {
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
        console.error("Upgrade error:", data.error);
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

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your account and subscription.</p>
      </div>

      {checkoutStatus === "success" && (
        <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-600 dark:text-green-400">
          <CheckCircle className="h-4 w-4 shrink-0" />
          Plan updated successfully. Your new plan is now active.
        </div>
      )}

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>Your account details.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Name</span>
            <span className="font-medium">{account.name || "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Email</span>
            <span className="font-medium">{userEmail || "—"}</span>
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
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
              <p className="text-xs text-muted-foreground mt-0.5">
                {mfaEnabled
                  ? "MFA is active. You'll be prompted on each login."
                  : "Add an extra layer of security to your account."}
              </p>
            </div>
            <Button
              size="sm"
              variant={mfaEnabled ? "outline" : "default"}
              className={mfaEnabled ? "" : "bg-violet-600 hover:bg-violet-700 text-white"}
              onClick={toggleMfa}
              disabled={mfaLoading || mfaEnabled === null}
            >
              {mfaLoading ? "Updating…" : mfaEnabled ? "Disable" : "Enable"}
            </Button>
          </div>
          {mfaMessage && (
            <p className="text-xs text-muted-foreground">{mfaMessage}</p>
          )}
        </CardContent>
      </Card>

      {/* Billing */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Billing
          </CardTitle>
          <CardDescription>Your subscription plan and billing details.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Current plan</span>
            <span className="font-semibold">{PLAN_LABEL[plan] ?? plan}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Status</span>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[account.status] ?? ""}`}
            >
              {account.status}
            </span>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row pt-2">
            {nextPlan && (
              nextPlan === "managed" ? (
                <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-white" asChild>
                  <a href="mailto:radar@sagitta.systems?subject=Radar Managed Plan">
                    Talk to us <ArrowRight className="ml-1 h-3 w-3" />
                  </a>
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="bg-violet-600 hover:bg-violet-700 text-white"
                  disabled={upgrading}
                  onClick={() => startUpgrade(nextPlan)}
                >
                  {upgrading ? (
                    <><Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> Upgrading…</>
                  ) : (
                    <>Upgrade to {PLAN_LABEL[nextPlan]} <ArrowRight className="ml-1 h-3 w-3" /></>
                  )}
                </Button>
              )
            )}
            {account.stripeCustomerId && (
              <Button size="sm" variant="outline" asChild>
                <Link href="/api/stripe/portal">Manage billing</Link>
              </Button>
            )}
          </div>

          {upgradeError && (
            <p className="text-xs text-red-500">{upgradeError}</p>
          )}

          <p className="text-xs text-muted-foreground">
            Powered by Stripe. Your payment information is never stored on our servers.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
