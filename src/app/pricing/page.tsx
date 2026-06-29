import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Simple, transparent pricing for DeFi infrastructure monitoring.",
};

const plans = [
  {
    name: "Free",
    slug: "free",
    priceLabel: "Free",
    description: "Get a feel for Radar with the public daily brief and alert feed.",
    features: [
      { text: "Daily signal briefings", included: true },
      { text: "Public alert feed (read-only)", included: true },
      { text: "1-day alert history", included: true },
      { text: "Watchlists", included: false },
      { text: "Live alert delivery", included: false },
      { text: "Discord / Telegram / Webhook", included: false },
    ],
    highlight: false,
    cta: "Request access",
    ctaHref: "/request-access",
  },
  {
    name: "Radar Live",
    slug: "radar_live",
    priceLabel: "Contact us",
    description: "Real-time delivery for teams that need to act fast on infrastructure changes.",
    features: [
      { text: "Everything in Free", included: true },
      { text: "Up to 3 custom watchlists", included: true },
      { text: "Discord & Telegram delivery", included: true },
      { text: "2 delivery destinations", included: true },
      { text: "7-day alert history", included: true },
      { text: "Webhook delivery", included: false },
    ],
    highlight: true,
    cta: "Request access",
    ctaHref: "/request-access",
  },
  {
    name: "Radar Pro",
    slug: "radar_pro",
    priceLabel: "Contact us",
    description: "For protocols and teams managing multiple dependencies across chains.",
    features: [
      { text: "Everything in Radar Live", included: true },
      { text: "Up to 10 custom watchlists", included: true },
      { text: "Discord, Telegram & Webhook", included: true },
      { text: "10 delivery destinations", included: true },
      { text: "30-day alert history", included: true },
      { text: "Priority support", included: false },
    ],
    highlight: false,
    cta: "Request access",
    ctaHref: "/request-access",
  },
  {
    name: "Managed",
    slug: "managed",
    priceLabel: "Contact us",
    description: "Full-service for DeFi protocols, funds, and security teams.",
    features: [
      { text: "Everything in Pro", included: true },
      { text: "Unlimited watchlists", included: true },
      { text: "Unlimited delivery destinations", included: true },
      { text: "365-day alert history", included: true },
      { text: "Dedicated support & onboarding", included: true },
      { text: "Custom coverage configuration", included: true },
    ],
    highlight: false,
    cta: "Request access",
    ctaHref: "/request-access",
  },
];

const comparison = [
  {
    feature: "Daily signal briefings",
    free: true,
    radar_live: true,
    radar_pro: true,
    managed: true,
  },
  {
    feature: "Watchlists",
    free: "None",
    radar_live: "3",
    radar_pro: "10",
    managed: "Unlimited",
  },
  {
    feature: "Discord delivery",
    free: false,
    radar_live: true,
    radar_pro: true,
    managed: true,
  },
  {
    feature: "Telegram delivery",
    free: false,
    radar_live: true,
    radar_pro: true,
    managed: true,
  },
  {
    feature: "Webhook delivery",
    free: false,
    radar_live: false,
    radar_pro: true,
    managed: true,
  },
  {
    feature: "Delivery destinations",
    free: "None",
    radar_live: "2",
    radar_pro: "10",
    managed: "Unlimited",
  },
  {
    feature: "Alert history",
    free: "1 day",
    radar_live: "7 days",
    radar_pro: "30 days",
    managed: "365 days",
  },
];

function Cell({ value }: { value: boolean | string }) {
  if (typeof value === "boolean") {
    return value ? (
      <Check className="mx-auto h-4 w-4 text-primary" />
    ) : (
      <span className="text-muted-foreground">—</span>
    );
  }
  return <span className="text-sm">{value}</span>;
}

export default function PricingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Nav />

      <main className="flex-1 py-24">
        <div className="container mx-auto max-w-screen-xl px-4">
          <div className="mb-16 text-center">
            <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
              Simple, transparent pricing
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Start free. Upgrade when you need real-time delivery and custom watchlists.
            </p>
          </div>

          {/* Plan cards */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-20">
            {plans.map((plan) => (
              <Card
                key={plan.slug}
                className={plan.highlight ? "border-primary shadow-lg" : "border-border/60"}
              >
                <CardHeader>
                  {plan.highlight && (
                    <Badge variant="default" className="mb-2 w-fit text-xs">
                      Most popular
                    </Badge>
                  )}
                  <CardTitle className="text-base">{plan.name}</CardTitle>
                  <div className="text-2xl font-bold">{plan.priceLabel}</div>
                  <CardDescription className="text-xs">{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <ul className="space-y-2">
                    {plan.features.map((f) => (
                      <li key={f.text} className="flex items-start gap-2 text-sm">
                        {f.included ? (
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        ) : (
                          <span className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground text-center">
                            —
                          </span>
                        )}
                        <span className={f.included ? "" : "text-muted-foreground"}>
                          {f.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    variant={plan.highlight ? "default" : "outline"}
                    size="sm"
                    className="w-full mt-2"
                    asChild
                  >
                    <Link href={plan.ctaHref}>{plan.cta}</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Comparison table */}
          <div className="overflow-x-auto rounded-xl border border-border/60">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30">
                  <th className="px-4 py-3 text-left font-medium">Feature</th>
                  {["Free", "Radar Live", "Radar Pro", "Managed"].map((p) => (
                    <th key={p} className="px-4 py-3 text-center font-medium">
                      {p}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparison.map((row, i) => (
                  <tr
                    key={row.feature}
                    className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}
                  >
                    <td className="px-4 py-3 text-muted-foreground">{row.feature}</td>
                    <td className="px-4 py-3 text-center">
                      <Cell value={row.free} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Cell value={row.radar_live} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Cell value={row.radar_pro} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Cell value={row.managed} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            All paid plans are provisioned via Stripe. Need a custom contract or invoice?{" "}
            <Link href="/request-access" className="underline underline-offset-4">
              Contact us.
            </Link>
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
