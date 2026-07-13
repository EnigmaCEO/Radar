export interface PricingFeature {
  text: string;
  detail?: string;
}

export interface PricingPlanContent {
  name: string;
  slug: "watch" | "radar_intel" | "radar_signal" | "desk";
  priceLabel: string;
  description: string;
  badge?: string;
  features: PricingFeature[];
}

export const PRICING_PLAN_CONTENT: PricingPlanContent[] = [
  {
    name: "Watch",
    slug: "watch",
    priceLabel: "$29/mo",
    description: "Personal monitoring for focused infrastructure exposure.",
    features: [
      { text: "One asset lens or up to 5 exact objects" },
      { text: "Email, Telegram & Discord alerts" },
      { text: "30-day event history" },
      { text: "Public receipt links" },
    ],
  },
  {
    name: "Intel",
    slug: "radar_intel",
    priceLabel: "$99/mo",
    description: "Aggregate Radar intelligence without private monitoring.",
    features: [
      { text: "Provider reliability scores" },
      { text: "Infrastructure health trends" },
      { text: "Weekly & monthly reports" },
      { text: "Deep aggregate history" },
      { text: "Aggregate CSV exports" },
    ],
  },
  {
    name: "Signal",
    slug: "radar_signal",
    priceLabel: "$149/mo",
    description: "Private monitoring across the standard Radar catalog.",
    badge: "Core product",
    features: [
      { text: "Full standard catalog coverage" },
      {
        text: "Correlation & exposure groups",
        detail: "Know when related parts of your position break together.",
      },
      { text: "Push and webhook delivery" },
      { text: "90-day private history" },
      { text: "Operational alert briefings" },
    ],
  },
  {
    name: "Desk",
    slug: "desk",
    priceLabel: "From $2,500/mo",
    description: "Institutional state data, review, and integration.",
    features: [
      { text: "Custom monitors" },
      { text: "Raw event history & query API" },
      { text: "Backfill & signed receipts" },
      { text: "Human review" },
      { text: "Trigger feeds by contract" },
    ],
  },
];

export function splitPlanPrice(priceLabel: string) {
  if (priceLabel.endsWith("/mo")) {
    return {
      amount: priceLabel.slice(0, -3),
      suffix: "/mo",
    };
  }

  return {
    amount: priceLabel,
    suffix: null,
  };
}
