export interface RadarAccount {
  id: string;
  ownerSub: string;
  name: string;
  plan: string;
  status: string;
  stripeCustomerId: string | null;
  stripeSubId: string | null;
  createdAt: string;
  updatedAt: string;
}
