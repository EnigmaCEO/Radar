import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PricingCta, type CheckoutPlan } from "@/components/pricing-cta";
import { auth0 } from "@/lib/auth0";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Pricing for Radar infrastructure-state monitoring.",
};

const plans = [
  {
    name: "Watch",
    slug: "watch",
    priceLabel: "$29/mo",
    description: "Personal monitoring for selected infrastructure objects.",
    features: [
      { text: "Up to 5 watchlist objects", included: true },
      { text: "Telegram & Discord alerts", included: true },
      { text: "7-day event history", included: true },
    ],
    highlight: false,
    cta: "Start Watch",
  },
  {
    name: "Intel",
    slug: "radar_intel",
    priceLabel: "$99/mo",
    description: "Aggregate Radar intelligence without private monitoring.",
    features: [
      { text: "Provider reliability scores", included: true },
      { text: "Infrastructure health trends", included: true },
      { text: "Weekly & monthly reports", included: true },
      { text: "Deep aggregate history", included: true },
      { text: "Aggregate CSV exports", included: true },
    ],
    highlight: false,
    cta: "Start Intel",
  },
  {
    name: "Signal",
    slug: "radar_signal",
    priceLabel: "$149/mo",
    description: "Private exposure monitoring with correlation and delivery.",
    features: [
      { text: "Up to 25 watchlist objects", included: true },
      {
        text: "Correlation & exposure groups",
        included: true,
        detail: "Know when related parts of your position break together.",
      },
      { text: "Telegram, Discord & webhook alerts", included: true },
      { text: "90-day event history", included: true },
    ],
    highlight: true,
    cta: "Start Signal",
    badge: "Core product",
  },
  {
    name: "Desk",
    slug: "desk",
    priceLabel: "From $2,500/mo",
    description: "Institutional state data, review, and integration.",
    features: [
      { text: "Full raw event history", included: true },
      { text: "API access", included: true },
      { text: "Custom monitoring", included: true },
      { text: "Support SLA", included: true },
      { text: "Alert exporting", included: true },
      { text: "Custom reporting", included: true },
    ],
    highlight: false,
    cta: "Talk to Sagitta Labs",
    ctaHref: "/request-access",
  },
];

const comparison = [
  {
    feature: "Watchlist objects",
    watch: "5",
    radar_intel: "None",
    radar: "25",
    desk: "Contracted",
  },
  {
    feature: "Correlation",
    watch: "No",
    radar_intel: "Aggregate only",
    radar: "Yes",
    desk: "Yes",
  },
  {
    feature: "Event history",
    watch: "7 days",
    radar_intel: "No",
    radar: "90 days",
    desk: "Contracted raw history",
  },
  {
    feature: "Delivery cadence",
    watch: "Daily digest",
    radar_intel: "None",
    radar: "Per-cycle",
    desk: "Per-cycle",
  },
  {
    feature: "Aggregate history",
    watch: "Basic",
    radar_intel: "Deep",
    radar: "Basic",
    desk: "Deep + raw",
  },
  {
    feature: "Reports",
    watch: "No",
    radar_intel: "Weekly & monthly",
    radar: "Operational briefings",
    desk: "Custom",
  },
  {
    feature: "Webhook / API",
    watch: "No",
    radar_intel: "Aggregate export only",
    radar: "Webhook",
    desk: "Webhook + API",
  },
  {
    feature: "Signed receipts",
    watch: "No",
    radar_intel: "No",
    radar: "No",
    desk: "Yes",
  },
  {
    feature: "Custom monitors",
    watch: "No",
    radar_intel: "No",
    radar: "No",
    desk: "Yes",
  },
];

// Positioning framing surfaced below the plan cards.
const distinctions = [
  {
    name: "Intel",
    analogy: "Climate report",
    description: "Aggregated, interpreted, published statistics.",
  },
  {
    name: "Signal",
    analogy: "Your weather alerts",
    description: "Private monitored exposure and correlated conditions.",
  },
  {
    name: "Desk",
    analogy: "Raw station data + analyst review",
    description: "Query the underlying state, export receipts, integrate with systems.",
  },
];

function Cell({ value }: { value: boolean | string }) {
  if (typeof value === "boolean") {
    return value ? (
      <Check className="mx-auto h-4 w-4 text-primary" />
    ) : (
      <span className="text-muted-foreground">-</span>
    );
  }
  return <span className="text-sm">{value}</span>;
}

export default async function PricingPage() {
  const session = await auth0.getSession();
  const isAuthenticated = Boolean(session);

  return (
    <div className="flex min-h-screen flex-col">
      <Nav />

      <main className="flex-1 py-24">
        <div className="container mx-auto max-w-screen-xl px-4">
          <div className="mb-16 text-center">
            <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
              Private monitoring, aggregate intelligence, institutional workflows
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Choose how Radar serves you: monitor objects, study infrastructure trends, correlate private exposure, or integrate verified state data into your systems.
            </p>
          </div>

          <div className="mb-20 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {plans.map((plan) => (
              <Card
                key={plan.slug}
                className={plan.highlight ? "border-primary shadow-lg" : "border-border/60"}
              >
                <CardHeader>
                  {plan.badge && (
                    <span className="inline-flex items-center rounded-full bg-violet-600 px-2.5 py-0.5 text-xs font-semibold text-white">
                      {plan.badge}
                    </span>
                  )}
                  <CardTitle className="text-base">{plan.name}</CardTitle>
                  <div className="text-2xl font-bold">{plan.priceLabel}</div>
                  <CardDescription className="text-xs leading-5">{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <ul className="space-y-2">
                    {plan.features.map((feature) => (
                      <li key={feature.text} className="flex items-start gap-2 text-sm">
                        {feature.included ? (
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        ) : (
                          <span className="mt-0.5 h-4 w-4 shrink-0 text-center text-muted-foreground">-</span>
                        )}
                        <span className={feature.included ? "" : "text-muted-foreground"}>
                          {feature.text}
                          {"detail" in feature && feature.detail ? (
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {feature.detail}
                            </span>
                          ) : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {plan.slug === "desk" ? (
                    <Button
                      variant={plan.highlight ? "default" : "outline"}
                      size="sm"
                      className="mt-2 w-full"
                      asChild
                    >
                      <Link href="/request-access">{plan.cta}</Link>
                    </Button>
                  ) : (
                    <PricingCta
                      plan={plan.slug as CheckoutPlan}
                      label={plan.cta}
                      highlight={plan.highlight}
                      isAuthenticated={isAuthenticated}
                    />
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mb-20">
            <div className="mb-6 text-center">
              <h2 className="text-2xl font-bold tracking-tight">How the products differ</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Intel, Signal, and Desk answer different questions about the same infrastructure.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {distinctions.map((item) => (
                <Card key={item.name} className="border-border/60">
                  <CardHeader>
                    <Badge variant="secondary" className="mb-2 w-fit text-xs">
                      {item.name}
                    </Badge>
                    <CardTitle className="text-lg">{item.analogy}</CardTitle>
                    <CardDescription className="text-sm leading-6">{item.description}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border/60">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30">
                  <th className="px-4 py-3 text-left font-medium">Capability</th>
                  {["Watch", "Intel", "Signal", "Desk"].map((label) => (
                    <th key={label} className="px-4 py-3 text-center font-medium">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparison.map((row, index) => (
                  <tr key={row.feature} className={index % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                    <td className="px-4 py-3 text-muted-foreground">{row.feature}</td>
                    <td className="px-4 py-3 text-center"><Cell value={row.watch} /></td>
                    <td className="px-4 py-3 text-center"><Cell value={row.radar_intel} /></td>
                    <td className="px-4 py-3 text-center"><Cell value={row.radar} /></td>
                    <td className="px-4 py-3 text-center"><Cell value={row.desk} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Self-serve billing is Stripe-backed where configured. Desk is handled by contract. Need a custom contract or invoice?{" "}
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
