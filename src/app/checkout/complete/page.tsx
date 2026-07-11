import { redirect } from "next/navigation";
import { getAccount } from "@/lib/account";
import { auth0 } from "@/lib/auth0";
import { hasActivePlan } from "@/lib/plan-limits";
import { ActivationPoller } from "@/components/activation-poller";

export const dynamic = "force-dynamic";

// Stripe checkout success lands here. We wait for the subscription webhook to
// activate the account (polled via ActivationPoller re-rendering this page),
// then forward to the dashboard. This avoids bouncing a just-paid user back to
// the pricing gate during the brief webhook-processing window.
export default async function CheckoutCompletePage() {
  const session = await auth0.getSession();
  if (!session) redirect("/login");

  const account = await getAccount().catch(() => null);
  if (account && hasActivePlan(account)) {
    redirect("/dashboard/settings?checkout=success");
  }

  return <ActivationPoller />;
}
