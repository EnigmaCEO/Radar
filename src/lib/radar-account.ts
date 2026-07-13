export interface RadarAccount {
  id: string;
  ownerSub: string;
  name: string;
  isAdmin: boolean;
  plan: string;
  status: string;
  stripeCustomerId: string | null;
  stripeSubId: string | null;
  createdAt: string;
  updatedAt: string;
}
