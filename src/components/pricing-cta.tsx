"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";

export type CheckoutPlan = "watch" | "radar_signal" | "radar_intel";

interface PricingCtaProps {
  plan: CheckoutPlan;
  label: string;
  highlight: boolean;
  isAuthenticated: boolean;
}

// CTA for a self-serve paid plan. Logged-in users go straight to Stripe
// checkout; logged-out users are sent to sign up and returned to /pricing with
// the plan preserved so checkout can auto-start once they authenticate.
export function PricingCta({ plan, label, highlight, isAuthenticated }: PricingCtaProps) {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ctaClassName = highlight
    ? "group inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md bg-violet-600 px-3 text-xs font-medium text-white hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    : "group inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

  const startCheckout = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (!res.ok || typeof data.url !== "string") {
        throw new Error(typeof data.error === "string" ? data.error : "Checkout failed");
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start checkout. Please try again.");
      setLoading(false);
    }
  }, [plan]);

  // Auto-start checkout when an authenticated user returns to /pricing?plan=<this plan>.
  useEffect(() => {
    if (isAuthenticated && searchParams.get("plan") === plan) {
      void startCheckout();
    }
  }, [isAuthenticated, searchParams, plan, startCheckout]);

  if (!isAuthenticated) {
    const returnTo = `/pricing?plan=${plan}`;
    const href = `/auth/login?screen_hint=signup&returnTo=${encodeURIComponent(returnTo)}`;
    return (
      <Link href={href} className={ctaClassName}>
        {label}
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </Link>
    );
  }

  return (
    <div className="mt-2 flex flex-col gap-1">
      <button
        type="button"
        className={ctaClassName}
        disabled={loading}
        onClick={startCheckout}
      >
        {loading ? (
          <>
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Redirecting...
          </>
        ) : (
          <>
            {label}
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </>
        )}
      </button>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
