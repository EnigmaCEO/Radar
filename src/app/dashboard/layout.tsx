import { redirect } from "next/navigation";
import { getAccount } from "@/lib/account";
import { auth0 } from "@/lib/auth0";
import { hasActivePlan } from "@/lib/plan-limits";
import { DashboardShell } from "@/components/dashboard-shell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth0.getSession();
  if (!session) redirect("/login");

  const account = await getAccount();
  if (!account) redirect("/login");

  // Dashboard access requires a paid, active plan. Authenticated users without
  // one are held at the pricing gate until they subscribe.
  if (!hasActivePlan(account)) redirect("/pricing");

  const userEmail = (session.user as { email?: string }).email ?? "";

  return (
    <DashboardShell account={account} userEmail={userEmail}>
      {children}
    </DashboardShell>
  );
}
