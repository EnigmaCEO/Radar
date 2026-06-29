import Link from "next/link";
import { Activity, AlertTriangle, ArrowRight, Bell, Globe, Shield, Zap } from "lucide-react";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const features = [
  {
    icon: Activity,
    title: "Oracle monitoring",
    description:
      "Track price freshness and deviation across Chainlink, Pyth, Chronicle, Redstone, and more. Alerts trigger the moment a feed goes stale or deviates beyond threshold.",
  },
  {
    icon: Globe,
    title: "Bridge route monitoring",
    description:
      "End-to-end visibility into CCTP, Across, Wormhole, and LayerZero. Detect settlement delays and paused routes before they impact your protocol.",
  },
  {
    icon: AlertTriangle,
    title: "LP pool intelligence",
    description:
      "Monitor Uniswap v3, Aerodrome, and Curve pools for liquidity drops, price deviation, and imbalance. Get alerted before slippage becomes a risk.",
  },
  {
    icon: Bell,
    title: "Multi-channel delivery",
    description:
      "Receive alerts on Discord, Telegram, or webhook. Filter by severity, monitor type, asset, and chain so only actionable signals reach you.",
  },
  {
    icon: Shield,
    title: "Watchlist-based filtering",
    description:
      "Create custom watchlists that match your protocol's dependencies. Stop reading general feeds — get intelligence scoped to your exact footprint.",
  },
  {
    icon: Zap,
    title: "Daily signal briefings",
    description:
      "A structured daily brief distills signal quality into broadcast-ready summaries. Know what matters, skip the noise.",
  },
];

const plans = [
  {
    name: "Free",
    slug: "free",
    price: null,
    priceLabel: "Free",
    description: "Daily brief access. No watchlists.",
    features: [
      "Daily signal briefings",
      "Public alert feed (read-only)",
      "1-day alert history",
    ],
    cta: "Request access",
    ctaHref: "/request-access",
    highlight: false,
  },
  {
    name: "Radar Live",
    slug: "radar_live",
    price: null,
    priceLabel: "Contact us",
    description: "Real-time delivery to your channels.",
    features: [
      "Everything in Free",
      "Up to 3 watchlists",
      "Discord & Telegram delivery",
      "2 delivery destinations",
      "7-day alert history",
    ],
    cta: "Request access",
    ctaHref: "/request-access",
    highlight: true,
  },
  {
    name: "Radar Pro",
    slug: "radar_pro",
    price: null,
    priceLabel: "Contact us",
    description: "For teams with multiple protocols.",
    features: [
      "Everything in Radar Live",
      "Up to 10 watchlists",
      "Webhook delivery",
      "10 delivery destinations",
      "30-day alert history",
    ],
    cta: "Request access",
    ctaHref: "/request-access",
    highlight: false,
  },
  {
    name: "Managed",
    slug: "managed",
    price: null,
    priceLabel: "Contact us",
    description: "Full service for DeFi protocols and funds.",
    features: [
      "Everything in Pro",
      "Unlimited watchlists",
      "Unlimited destinations",
      "365-day alert history",
      "Dedicated support",
    ],
    cta: "Request access",
    ctaHref: "/request-access",
    highlight: false,
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Nav />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/40 py-24 md:py-32">
        <div className="container mx-auto max-w-screen-xl px-4 text-center">
          <Badge variant="secondary" className="mb-6 text-xs">
            DeFi infrastructure intelligence
          </Badge>
          <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight md:text-6xl">
            Real-time monitoring for{" "}
            <span className="text-primary">every oracle, bridge, and pool</span> your protocol
            depends on.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
            Radar watches Chainlink, Pyth, CCTP, Across, Wormhole, Uniswap, Curve, and more —
            then delivers actionable alerts to Discord, Telegram, or webhook before your users
            notice something is wrong.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button size="lg" asChild>
              <Link href="/request-access">
                Request access <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/pricing">See pricing</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Live badge strip */}
      <section className="border-b border-border/40 bg-muted/30 py-4">
        <div className="container mx-auto max-w-screen-xl px-4">
          <div className="flex flex-wrap justify-center gap-3 text-xs text-muted-foreground">
            {[
              "Chainlink",
              "Pyth",
              "Chronicle",
              "Redstone",
              "CCTP",
              "Across",
              "Wormhole",
              "LayerZero",
              "Uniswap v3",
              "Aerodrome",
              "Curve",
            ].map((name) => (
              <span
                key={name}
                className="rounded-full border border-border/60 px-3 py-1 font-mono"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24">
        <div className="container mx-auto max-w-screen-xl px-4">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              Every signal that matters, nothing that doesn&apos;t
            </h2>
            <p className="mt-4 text-muted-foreground">
              Radar monitors the infrastructure your DeFi protocol depends on — and filters to the
              signals your team actually needs to act on.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <Card key={f.title} className="border-border/60">
                <CardHeader>
                  <f.icon className="mb-2 h-5 w-5 text-primary" />
                  <CardTitle className="text-base">{f.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm leading-relaxed">
                    {f.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing preview */}
      <section id="pricing" className="border-t border-border/40 py-24 bg-muted/20">
        <div className="container mx-auto max-w-screen-xl px-4">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              Plans for every team
            </h2>
            <p className="mt-4 text-muted-foreground">
              Start with a daily brief. Scale to real-time delivery when you need it.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map((plan) => (
              <Card
                key={plan.slug}
                className={plan.highlight ? "border-primary shadow-md" : "border-border/60"}
              >
                <CardHeader>
                  {plan.highlight && (
                    <Badge variant="default" className="mb-2 w-fit text-xs">
                      Most popular
                    </Badge>
                  )}
                  <CardTitle className="text-base">{plan.name}</CardTitle>
                  <div className="text-2xl font-bold">{plan.priceLabel}</div>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <span className="text-primary mt-0.5">✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button
                    variant={plan.highlight ? "default" : "outline"}
                    size="sm"
                    className="w-full mt-auto"
                    asChild
                  >
                    <Link href={plan.ctaHref}>{plan.cta}</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Subscription management powered by Stripe. Cancel anytime.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border/40 py-24">
        <div className="container mx-auto max-w-screen-xl px-4 text-center">
          <h2 className="text-3xl font-bold tracking-tight">Ready to watch your infrastructure?</h2>
          <p className="mt-4 text-muted-foreground">
            Request access and we&apos;ll provision your account within one business day.
          </p>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button size="lg" asChild>
              <Link href="/request-access">
                Request access <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
