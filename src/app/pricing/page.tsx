import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { PricingCta, type CheckoutPlan } from "@/components/pricing-cta";
import { auth0 } from "@/lib/auth0";
import { PRICING_PLAN_CONTENT, splitPlanPrice } from "@/lib/pricing-content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Pricing for Radar infrastructure-state monitoring.",
};

const plans = PRICING_PLAN_CONTENT.map((plan) => ({
  ...plan,
  highlight: plan.slug === "radar_signal",
  cta:
    plan.slug === "watch"
      ? "Start Watch"
      : plan.slug === "radar_intel"
        ? "Start Intel"
        : plan.slug === "radar_signal"
          ? "Start Signal"
          : "Talk to Sagitta Labs",
  ctaHref: plan.slug === "desk" ? "/request-access" : undefined,
}));

const comparison = [
  {
    feature: "Monitoring scope",
    watch: "1 asset or 5 exact objects",
    radar_intel: "None",
    radar: "Full standard catalog",
    desk: "Full catalog + custom",
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
    watch: "30 days",
    radar_intel: "No",
    radar: "90 days",
    desk: "Contracted raw history",
  },
  {
    feature: "Delivery cadence",
    watch: "Push + digest",
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

          <div className="mb-20 grid items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map((plan) => {
              const price = splitPlanPrice(plan.priceLabel);

              return (
                <Card
                  key={plan.slug}
                  className={
                    plan.highlight
                      ? "flex flex-col border-2 border-violet-600 bg-card"
                      : "flex flex-col border border-border bg-card shadow-sm"
                  }
                >
                  <CardHeader className="pb-4">
                    <div className="flex h-6 items-center">
                      {plan.badge && (
                        <span className="inline-flex items-center rounded-full bg-violet-600 px-2.5 py-0.5 text-xs font-semibold text-white">
                          {plan.badge}
                        </span>
                      )}
                    </div>
                    <CardTitle className="text-base text-foreground">{plan.name}</CardTitle>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold text-foreground">{price.amount}</span>
                      {price.suffix && <span className="text-sm text-muted-foreground">{price.suffix}</span>}
                    </div>
                    <CardDescription className="min-h-[2.75rem] text-sm leading-snug">
                      {plan.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 pb-4">
                    <ul className="space-y-2">
                      {plan.features.map((feature) => (
                        <li key={feature.text} className="flex items-start gap-2 text-sm text-foreground">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                          <span>
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
                  </CardContent>
                  <CardFooter className="pt-0">
                    {plan.slug === "desk" ? (
                      <Link
                        href="/request-access"
                        className="group inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        {plan.cta}
                        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                      </Link>
                    ) : (
                      <PricingCta
                        plan={plan.slug as CheckoutPlan}
                        label={plan.cta}
                        highlight={plan.highlight}
                        isAuthenticated={isAuthenticated}
                      />
                    )}
                  </CardFooter>
                </Card>
              );
            })}
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
                    <span className="mb-2 inline-flex w-fit items-center rounded-full bg-violet-600/10 px-2.5 py-0.5 text-xs font-semibold text-violet-700 dark:text-violet-300">
                      {item.name}
                    </span>
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
