"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

// Polls the server for subscription activation. The parent server component
// re-runs on router.refresh() and redirects to /dashboard once the Stripe
// webhook has flipped the account to an active plan.
export function ActivationPoller() {
  const router = useRouter();
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    let attempts = 0;
    const interval = setInterval(() => {
      attempts += 1;
      if (attempts >= 8) setSlow(true);
      router.refresh();
    }, 2500);
    return () => clearInterval(interval);
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Activating your subscription</h1>
        <p className="text-sm text-muted-foreground">
          Payment received. We&apos;re finalizing your account and will redirect you to the dashboard.
        </p>
      </div>
      {slow && (
        <p className="max-w-md text-sm text-muted-foreground">
          This is taking longer than usual. If you&apos;re not redirected shortly,{" "}
          <Link href="/dashboard" className="underline underline-offset-4">
            open your dashboard
          </Link>{" "}
          or contact support.
        </p>
      )}
    </div>
  );
}
