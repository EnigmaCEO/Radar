import type { AdminViewPlan } from "@/lib/admin-plan-override";

export interface RadarAccount {
  id: string;
  ownerSub: string;
  name: string;
  isAdmin: boolean;
  plan: string;
  adminViewPlan: AdminViewPlan | null;
  status: string;
  stripeCustomerId: string | null;
  stripeSubId: string | null;
  createdAt: string;
  updatedAt: string;
}
