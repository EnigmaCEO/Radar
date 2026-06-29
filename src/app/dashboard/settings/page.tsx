"use client";

import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowRight, CreditCard } from "lucide-react";

const planLabels: Record<string, string> = {
  free: "Free",
  radar_live: "Radar Live",
  radar_pro: "Radar Pro",
  managed: "Managed",
};

const statusColors: Record<string, string> = {
  trial: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  past_due: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  suspended: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  canceled: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
};

export default function SettingsPage() {
  const { me } = useAuth();
  if (!me) return null;

  const account = me.activeAccount ?? me.memberships[0]?.account;
  const membership = me.memberships[0]?.membership;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your account and subscription.</p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>Your user details.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Name</span>
            <span className="font-medium">{me.user.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Email</span>
            <span className="font-medium">{me.user.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Role</span>
            <span className="font-medium capitalize">
              {(membership?.role ?? me.currentRole ?? "—").replace(/_/g, " ")}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Session mode</span>
            <Badge variant="secondary" className="text-xs">{me.sessionMode}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Account */}
      {account && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Account</CardTitle>
            <CardDescription>Your organization details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium">{account.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Slug</span>
              <span className="font-mono text-xs">{account.slug}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[account.status] ?? ""}`}
              >
                {account.status}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Billing */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Billing
          </CardTitle>
          <CardDescription>Manage your subscription plan.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-muted-foreground">
            Subscription management is handled through Stripe. Use the buttons below to upgrade
            your plan or manage your billing details.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button size="sm" asChild>
              <Link href="/api/stripe/checkout?plan=radar_live">
                Upgrade to Radar Live <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href="/api/stripe/portal">Manage subscription</Link>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Powered by Stripe. Your payment information is never stored on our servers.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
