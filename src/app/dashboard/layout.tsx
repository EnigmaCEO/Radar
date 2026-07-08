import { redirect } from "next/navigation";
import { getAccount } from "@/lib/account";
import { auth0 } from "@/lib/auth0";
import { DashboardShell } from "@/components/dashboard-shell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth0.getSession();
  if (!session) redirect("/login");

  const account = await getAccount();
  if (!account) redirect("/login");

  const userEmail = (session.user as { email?: string }).email ?? "";

  return (
    <DashboardShell account={account} userEmail={userEmail}>
      {children}
    </DashboardShell>
  );
}
