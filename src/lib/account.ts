import { cache } from "react";
import { auth0 } from "@/lib/auth0";
import { getAdminViewPlanFromCookies } from "@/lib/admin-plan-override-server";
import type { RadarAccount } from "@/lib/radar-account";
import { bootstrapRadarAccount } from "@/lib/radar-api-backend";

// Cached per request — safe to call from multiple server components in one render.
export const getAccount = cache(async (): Promise<RadarAccount | null> => {
  const session = await auth0.getSession();
  if (!session?.user?.sub) return null;

  const [account, adminViewPlan] = await Promise.all([
    bootstrapRadarAccount(session) as Promise<RadarAccount>,
    getAdminViewPlanFromCookies(),
  ]);

  return {
    ...account,
    adminViewPlan: account.isAdmin ? adminViewPlan : null,
  };
});
