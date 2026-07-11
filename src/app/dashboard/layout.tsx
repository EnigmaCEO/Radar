import { redirect } from "next/navigation";
import { getAccount } from "@/lib/account";
import { auth0 } from "@/lib/auth0";
import { hasActivePlan } from "@/lib/plan-limits";
import { DashboardShell } from "@/components/dashboard-shell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth0.getSession();
  if (!session) {
    console.warn("[radar-auth] dashboard redirect: missing session");
    redirect("/login");
  }

  let account;
  try {
    account = await getAccount();
  } catch (error) {
    console.error("[radar-auth] dashboard account bootstrap threw", {
      auth0Sub: (session.user as { sub?: string }).sub ?? null,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  if (!account) {
    console.warn("[radar-auth] dashboard redirect: bootstrap returned no account", {
      auth0Sub: (session.user as { sub?: string }).sub ?? null,
    });
    redirect("/login");
  }

  // Dashboard access requires a paid, active plan. Authenticated users without
  // one are held at the pricing gate until they subscribe.
  if (!hasActivePlan(account)) {
    console.warn("[radar-auth] dashboard redirect: plan gate denied", {
      auth0Sub: (session.user as { sub?: string }).sub ?? null,
      plan: account.plan,
      status: account.status,
      hasStripeCustomerId: Boolean(account.stripeCustomerId),
      hasStripeSubId: Boolean(account.stripeSubId),
    });
    redirect("/pricing");
  }

  const userEmail = (session.user as { email?: string }).email ?? "";

  return (
    <DashboardShell account={account} userEmail={userEmail}>
      {children}
    </DashboardShell>
  );
}
