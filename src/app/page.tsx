import Link from "next/link";
import Image from "next/image";
import { AlertTriangle, ArrowRight, Bell, Check, Globe, Shield, Zap, Activity } from "lucide-react";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { getMonitoredValueUsd, formatUsd } from "@/lib/radar-stats";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

// New users are returned to /pricing, which auto-starts Stripe checkout for the
// selected plan once they authenticate.
function buildSignupHref(plan?: "watch" | "radar_intel" | "radar_signal") {
  const returnTo = plan ? `/pricing?plan=${plan}` : "/pricing";
  const params = new URLSearchParams({
    screen_hint: "signup",
    returnTo,
  });
  return `/login?${params.toString()}`;
}

const DISCORD_INVITE_URL = "https://discord.gg/FPFabKwyW";
const TELEGRAM_INVITE_URL = "https://t.me/+g4OJXj2i4bM1YmIx";

// ── Sample signal feed ───────────────────────────────────────────────────────

const SEV_COLOR: Record<string, string> = {
  watch: "bg-blue-400",
  warning: "bg-orange-400",
  critical: "bg-red-500",
  info: "bg-purple-400",
};

const SEV_TEXT: Record<string, string> = {
  watch: "text-blue-400",
  warning: "text-orange-400",
  critical: "text-red-400",
  info: "text-purple-400",
};

const signals = [
  { sev: "watch", msg: "Chainlink ETH/USD deviation watch", src: "oracle", age: "2m ago" },
  { sev: "warning", msg: "Wormhole route latency elevated", src: "bridge", age: "7m ago" },
  { sev: "watch", msg: "Curve pool imbalance detected", src: "lp", age: "12m ago" },
  { sev: "warning", msg: "Across route pressure increased", src: "bridge", age: "18m ago" },
  { sev: "info", msg: "Daily briefing generated · 08:00 UTC", src: "system", age: "1h ago" },
  { sev: "critical", msg: "Chronicle WBTC/USD deviation threshold hit", src: "oracle", age: "45m ago" },
  { sev: "watch", msg: "LayerZero route congestion detected", src: "bridge", age: "31m ago" },
  { sev: "info", msg: "Pyth SOL/USD heartbeat nominal", src: "oracle", age: "4m ago" },
  { sev: "warning", msg: "Uniswap v3 ETH/USDC depth dropped 22%", src: "lp", age: "53m ago" },
  { sev: "watch", msg: "RedStone BTC/USD freshness within threshold", src: "oracle", age: "9m ago" },
];

// ── Features ─────────────────────────────────────────────────────────────────

const features = [
  {
    icon: Activity,
    title: "Oracle monitoring",
    description:
      "Track price freshness and deviation across major oracle networks. Get alerted the moment a feed goes stale or drifts beyond threshold.",
  },
  {
    icon: AlertTriangle,
    title: "Liquidity pool intelligence",
    description:
      "Monitor pools for liquidity drops, price deviation, and imbalance. Get alerted before slippage becomes a risk.",
  },
  {
    icon: Globe,
    title: "Bridge route monitoring",
    description:
      "End-to-end visibility into major bridge routes. Detect settlement delays and paused routes before they impact your protocol.",
  },
  {
    icon: Bell,
    title: "Alerts on Discord, Telegram & webhook",
    description:
      "Every alert reaches your team on the channel they already use. Filter by severity, type, asset, and chain — only what you care about.",
  },
  {
    icon: Shield,
    title: "Custom watchlists",
    description:
      "Scope watchlists to your protocol's exact dependencies. Get intelligence matched to your footprint, not the general feed.",
  },
  {
    icon: Zap,
    title: "Daily signal briefings",
    description:
      "A structured daily brief distills signal quality into a broadcast-ready summary. Know what matters, skip the noise.",
  },
];

// ── Pricing ───────────────────────────────────────────────────────────────────

const plans = [
  {
    name: "Watch",
    slug: "watch",
    price: "$29",
    priceSub: "/mo",
    description: "Personal monitoring for selected infrastructure objects.",
    tag: null,
    features: [
      "Up to 5 watchlist objects",
      "Telegram & Discord alerts",
      "7-day event history",
    ],
    cta: "Get started",
    ctaHref: buildSignupHref("watch"),
    highlight: false,
  },
  {
    name: "Intel",
    slug: "radar_intel",
    price: "$99",
    priceSub: "/mo",
    description: "Aggregate Radar intelligence without private monitoring.",
    tag: null,
    features: [
      "Provider reliability scores",
      "Infrastructure health trends",
      "Weekly & monthly reports",
      "Deep aggregate history",
      "Aggregate CSV exports",
    ],
    cta: "Get started",
    ctaHref: buildSignupHref("radar_intel"),
    highlight: false,
  },
  {
    name: "Signal",
    slug: "radar_signal",
    price: "$149",
    priceSub: "/mo",
    description: "Private exposure monitoring with correlation and delivery.",
    tag: "Core product",
    features: [
      "Up to 25 watchlist objects",
      {
        label: "Correlation & exposure groups",
        detail: "Know when related parts of your position break together.",
      },
      "Telegram, Discord & webhook alerts",
      "90-day event history",
    ],
    cta: "Get started",
    ctaHref: buildSignupHref("radar_signal"),
    highlight: true,
  },
  {
    name: "Desk",
    slug: "desk",
    price: "From $2,500",
    priceSub: "/mo",
    description: "Institutional state data, review, and integration.",
    tag: null,
    features: [
      "Full raw event history",
      "API access",
      "Custom monitoring",
      "Support SLA",
      "Alert exporting",
      "Custom reporting",
    ],
    cta: "Talk to us",
    ctaHref: "/request-access",
    highlight: false,
  },
];

// ── Coverage ──────────────────────────────────────────────────────────────────

const coverage = [
  { label: "Chainlink", type: "oracle" },
  { label: "Pyth", type: "oracle" },
  { label: "Chronicle", type: "oracle" },
  { label: "RedStone", type: "oracle" },
  { label: "CCIP", type: "bridge" },
  { label: "Across", type: "bridge" },
  { label: "Wormhole", type: "bridge" },
  { label: "LayerZero", type: "bridge" },
  { label: "Uniswap v3", type: "lp" },
  { label: "Curve", type: "lp" },
  { label: "Aerodrome", type: "lp" },
  { label: "Aave", type: "lp" },
];

const TYPE_CHIP: Record<string, string> = {
  oracle: "border-yellow-500/25 bg-yellow-500/5 text-yellow-300/80",
  bridge: "border-purple-500/25 bg-purple-500/5 text-purple-300/80",
  lp: "border-green-500/25  bg-green-500/5  text-green-300/80",
};

// ─────────────────────────────────────────────────────────────────────────────

export default async function LandingPage() {
  const monitoredUsd = formatUsd(await getMonitoredValueUsd());
  return (
    <div className="flex min-h-screen flex-col">
      <Nav />

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#07060f] py-28 md:py-40">
        {/* Radar visual */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {/* Concentric rings */}
          <div className="absolute inset-0 flex items-center justify-center">
            {[180, 300, 420, 540, 660].map((size, i) => (
              <div
                key={size}
                className="absolute rounded-full border"
                style={{
                  width: size,
                  height: size,
                  borderColor: `hsl(268 60% 60% / ${0.06 + i * 0.02})`,
                }}
              />
            ))}
          </div>

          {/* Conic sweep wake */}
          <div
            className="radar-sweep absolute rounded-full"
            style={{
              width: 700,
              height: 700,
              left: "calc(50% - 350px)",
              top: "calc(50% - 350px)",
              transformOrigin: "center",
              background: `conic-gradient(
                from 0deg,
                transparent 0deg,
                transparent 310deg,
                hsl(268 85% 65% / 0.02) 330deg,
                hsl(268 85% 65% / 0.08) 348deg,
                hsl(268 85% 65% / 0.28) 360deg
              )`,
            }}
          />

          {/* Sweep arm */}
          <div className="radar-sweep absolute" style={{ left: "50%", top: "50%", transformOrigin: "0 0" }}>
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: -10,
                width: 20,
                height: 330,
                background: "linear-gradient(to bottom, hsl(268 85% 72%), transparent)",
                filter: "blur(10px)",
                opacity: 0.55,
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: -4,
                width: 8,
                height: 350,
                background: "linear-gradient(to bottom, hsl(268 85% 80%), hsl(268 70% 60% / 0.4), transparent)",
                filter: "blur(3px)",
                opacity: 0.8,
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: -1,
                width: 2,
                height: 350,
                background: "linear-gradient(to bottom, #fff 0%, hsl(268 85% 82%) 40%, hsl(268 70% 60% / 0.3) 80%, transparent 100%)",
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: 342,
                left: -6,
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: "white",
                boxShadow:
                  "0 0 6px 2px hsl(268 85% 80%), 0 0 18px 6px hsl(268 85% 65% / 0.7), 0 0 40px 12px hsl(268 85% 55% / 0.3)",
              }}
            />
          </div>

          {/* Blips — sweep delay calculated from atan2(dx, -dy)/2π×4s */}
          {([
            { x: "calc(50% + 162px)", y: "calc(50% - 88px)", color: "#f5c842", r: 5, sweepDelay: "0.68s", drift: "a", driftDur: 28, driftOff: "0s", flash: false },
            { x: "calc(50% + 72px)", y: "calc(50% + 222px)", color: "#f5c842", r: 4, sweepDelay: "1.80s", drift: "c", driftDur: 38, driftOff: "-15s", flash: false },
            { x: "calc(50% - 185px)", y: "calc(50% + 150px)", color: "#f5c842", r: 3, sweepDelay: "2.57s", drift: "a", driftDur: 35, driftOff: "-12s", flash: false },
            { x: "calc(50% + 305px)", y: "calc(50% + 90px)", color: "#f5c842", r: 4, sweepDelay: "1.18s", drift: "c", driftDur: 33, driftOff: "-5s", flash: false },
            { x: "calc(50% + 248px)", y: "calc(50% - 22px)", color: "#f5c842", r: 3.5, sweepDelay: "0.94s", drift: "b", driftDur: 32, driftOff: "-8s", flash: true },
            { x: "calc(50% + 110px)", y: "calc(50% + 145px)", color: "#f5c842", r: 3, sweepDelay: "1.59s", drift: "d", driftDur: 42, driftOff: "-22s", flash: true },
            { x: "calc(50% - 102px)", y: "calc(50% - 198px)", color: "hsl(268 85% 75%)", r: 4, sweepDelay: "3.70s", drift: "b", driftDur: 45, driftOff: "-18s", flash: false },
            { x: "calc(50% - 280px)", y: "calc(50% - 110px)", color: "hsl(268 85% 72%)", r: 3, sweepDelay: "3.24s", drift: "d", driftDur: 37, driftOff: "-20s", flash: false },
            { x: "calc(50% - 145px)", y: "calc(50% - 270px)", color: "hsl(268 85% 73%)", r: 3, sweepDelay: "3.69s", drift: "b", driftDur: 40, driftOff: "-25s", flash: false },
            { x: "calc(50% - 228px)", y: "calc(50% + 48px)", color: "hsl(268 85% 70%)", r: 3.5, sweepDelay: "2.87s", drift: "c", driftDur: 30, driftOff: "-9s", flash: true },
            { x: "calc(50% - 60px)", y: "calc(50% + 305px)", color: "hsl(268 85% 70%)", r: 3.5, sweepDelay: "2.12s", drift: "a", driftDur: 28, driftOff: "-3s", flash: true },
            { x: "calc(50% + 170px)", y: "calc(50% + 255px)", color: "hsl(268 85% 75%)", r: 3, sweepDelay: "1.63s", drift: "d", driftDur: 36, driftOff: "-11s", flash: true },
          ] as const).map((b, i) => (
            <div key={i} className="absolute" style={{ left: b.x, top: b.y }}>
              <div style={{ animation: `radar-drift-${b.drift} ${b.driftDur}s ease-in-out ${b.driftOff} infinite` }}>
                <div style={{ transform: "translate(-50%, -50%)" }}>
                  <div
                    className="absolute rounded-full animate-ping"
                    style={{ width: b.r * 2, height: b.r * 2, background: b.color, animationDuration: "4s", animationDelay: b.sweepDelay, opacity: 0.4 }}
                  />
                  <div
                    className="rounded-full"
                    style={{
                      width: b.r * 2,
                      height: b.r * 2,
                      background: b.color,
                      boxShadow: `0 0 8px 3px ${b.color}99`,
                      animation: `${b.flash ? "radar-blip-flash" : "radar-blip-glow"} 4s ease-in-out ${b.sweepDelay} infinite`,
                      animationFillMode: "backwards",
                    }}
                  />
                </div>
              </div>
            </div>
          ))}

          {/* Center dot */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="h-2.5 w-2.5 rounded-full gold-pulse"
              style={{ background: "#f5c842", boxShadow: "0 0 8px 3px #f5c84288, 0 0 20px 6px #f5c84244" }}
            />
          </div>
        </div>

        {/* Subtle grid */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#ffffff06_1px,transparent_1px),linear-gradient(to_bottom,#ffffff06_1px,transparent_1px)] bg-[size:48px_48px]"
        />

        <div className="container relative mx-auto max-w-screen-xl px-4">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-8 flex justify-center">
              <Image src="/logo.png" alt="Radar" width={96} height={96} className="drop-shadow-[0_0_32px_hsl(268_85%_68%/0.5)]" priority />
            </div>

            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-1.5 text-xs font-medium text-purple-300">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-purple-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-purple-400" />
              </span>
              DeFi infrastructure intelligence — live
            </div>

            <h1 className="text-4xl font-bold tracking-tight text-white md:text-6xl">
              Real-time monitoring for every oracle, bridge, and pool your protocol depends on.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400">
              Radar watches the infrastructure your protocol depends on and delivers actionable alerts to Discord, Telegram, or webhook before issues become user-facing.
            </p>

            <div className="mt-10 flex flex-col items-center gap-1">
              <span className="text-6xl font-bold tracking-tight text-amber-400 md:text-7xl">{monitoredUsd}</span>
              <span className="text-sm font-medium uppercase tracking-widest text-slate-500">DeFi infrastructure monitored</span>
            </div>

            <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Button size="lg" className="bg-violet-600 hover:bg-violet-700 text-white" asChild>
                <a href="/auth/login">
                  Get started <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
              <Button size="lg" variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white hover:border-white/25" asChild>
                <Link href="#pricing">See pricing</Link>
              </Button>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-sm text-slate-400">
              <span className="text-slate-500">Join the feed:</span>
              <a
                href={DISCORD_INVITE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200 transition-colors hover:border-violet-400/40 hover:text-white"
              >
                Discord
              </a>
              <a
                href={TELEGRAM_INVITE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200 transition-colors hover:border-violet-400/40 hover:text-white"
              >
                Telegram
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Signal strip ──────────────────────────────────────────────────── */}
      <section className="bg-[#07060f]">
        <div className="relative overflow-hidden border-y border-white/[0.06]">
          {/* Left label */}
          <div className="absolute left-0 top-0 bottom-0 z-10 flex items-center">
            <div className="flex h-full items-center gap-2 border-r border-white/[0.06] bg-[#07060f] pl-4 pr-4">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
              </span>
              <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-widest text-slate-500">Example signal feed</span>
            </div>
            <div className="h-full w-12 bg-gradient-to-r from-[#07060f] to-transparent" />
          </div>

          {/* Right fade */}
          <div className="absolute right-0 top-0 bottom-0 z-10 w-12 bg-gradient-to-l from-[#07060f] to-transparent" />

          {/* Scrolling track */}
          <div className="marquee-track py-2.5 pl-52">
            {[...signals, ...signals].map((s, i) => (
              <span key={i} className="inline-flex whitespace-nowrap px-7">
                <span className="flex items-center gap-2">
                  <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${SEV_COLOR[s.sev]}`} />
                  <span className={`text-xs font-medium ${SEV_TEXT[s.sev]}`}>{s.msg}</span>
                  <span className="text-slate-700">·</span>
                  <span className="font-mono text-[10px] uppercase tracking-wide text-slate-600">{s.src}</span>
                  <span className="text-slate-700">·</span>
                  <span className="text-[10px] text-slate-600">{s.age}</span>
                </span>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Credibility strip ─────────────────────────────────────────────── */}
      <section className="bg-[#0d0b1a] py-10">
        <div className="container mx-auto max-w-screen-xl px-4">
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            {[
              { stat: "12+", label: "Infrastructure sources tracked" },
              { stat: "3 alert types", label: "Watch · Warning · Critical" },
              { stat: "3 channels", label: "Discord, Telegram & webhook" },
              { stat: "Daily + live", label: "Briefings and real-time alerts" },
            ].map((item) => (
              <div key={item.stat} className="text-center">
                <div className="text-lg font-bold text-amber-400">{item.stat}</div>
                <div className="mt-1 text-xs text-slate-500">{item.label}</div>
              </div>
            ))}
          </div>
          <div className="mt-8 border-t border-white/[0.05] pt-8">
            <p className="mb-4 text-center text-[10px] font-semibold uppercase tracking-widest text-slate-600">Built for</p>
            <div className="flex flex-wrap justify-center gap-2">
              {["DeFi protocols", "Risk teams", "Ops teams", "Treasuries", "Funds"].map((b) => (
                <span key={b} className="rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-1.5 text-xs text-slate-400">
                  {b}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Coverage ──────────────────────────────────────────────────────── */}
      <section className="border-b border-white/5 bg-[#0b0a17] py-7">
        <div className="container mx-auto max-w-screen-xl px-4">
          <p className="mb-4 text-center text-xs font-semibold uppercase tracking-widest text-slate-600">Coverage includes</p>
          <div className="flex flex-wrap justify-center gap-2">
            {coverage.map((c) => (
              <span key={c.label} className={`rounded-md border px-3 py-1.5 text-xs font-medium ${TYPE_CHIP[c.type]}`}>
                {c.label}
              </span>
            ))}
          </div>
          <p className="mt-4 text-center text-[11px] text-slate-600">Oracles · Bridges · Liquidity pools · More coverage added regularly</p>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────────────────── */}
      <section id="features" className="bg-background py-24">
        <div className="container mx-auto max-w-screen-xl px-4">
          <div className="mb-14 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">Every signal that matters, nothing that doesn&apos;t</h2>
            <p className="mt-4 text-muted-foreground">
              Radar monitors the infrastructure your DeFi protocol depends on — and filters to only what your team needs to act on.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <Card key={f.title} className="border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
                <CardHeader>
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-violet-600/10 ring-1 ring-violet-600/20">
                    <f.icon className="h-5 w-5 text-violet-500" />
                  </div>
                  <CardTitle className="text-base text-foreground">{f.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm leading-relaxed">{f.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ───────────────────────────────────────────────────────── */}
      <section id="pricing" className="border-t border-border bg-muted/40 py-24">
        <div className="container mx-auto max-w-screen-xl px-4">
          <div className="mb-14 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">Plans for every team</h2>
            <p className="mt-4 text-muted-foreground">
              Choose how Radar serves you: monitor objects, study infrastructure trends, correlate private exposure, or integrate verified state data into your systems.
            </p>
          </div>
          <div className="grid items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map((plan) => (
              <Card
                key={plan.slug}
                className={plan.highlight ? "flex flex-col border-2 border-violet-600 bg-card" : "flex flex-col border border-border bg-card shadow-sm"}
              >
                <CardHeader className="pb-4">
                  <div className="flex h-6 items-center">
                    {plan.tag && <span className="inline-flex items-center rounded-full bg-violet-600 px-2.5 py-0.5 text-xs font-semibold text-white">{plan.tag}</span>}
                  </div>
                  <CardTitle className="text-base text-foreground">{plan.name}</CardTitle>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-foreground">{plan.price}</span>
                    <span className="text-sm text-muted-foreground">{plan.priceSub}</span>
                  </div>
                  <CardDescription className="min-h-[2.75rem] text-sm leading-snug">{plan.description}</CardDescription>
                </CardHeader>

                <CardContent className="flex-1 pb-4">
                  <ul className="space-y-2">
                    {plan.features.map((f) => {
                      const label = typeof f === "string" ? f : f.label;
                      const detail = typeof f === "string" ? null : f.detail;
                      return (
                        <li key={label} className="flex items-start gap-2 text-sm text-foreground">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                          <span>
                            {label}
                            {detail && (
                              <span className="mt-0.5 block text-xs text-muted-foreground">{detail}</span>
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>

                <CardFooter className="pt-0">
                  <a
                    href={plan.ctaHref}
                    className={
                      plan.highlight
                        ? "group inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md bg-violet-600 px-3 text-xs font-medium text-white hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        : "group inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    }
                  >
                    {plan.cta}
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </a>
                </CardFooter>
              </Card>
            ))}
          </div>
          <p className="mt-6 text-center text-xs text-muted-foreground">Billing managed via Stripe. Cancel or change plan anytime.</p>
        </div>
      </section>

      {/* ── Final CTA ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#07060f] py-24">
        <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-30">
          {[200, 320, 440].map((size) => (
            <div key={size} className="absolute rounded-full border border-purple-500/20" style={{ width: size, height: size }} />
          ))}
        </div>
        <div className="container relative mx-auto max-w-screen-xl px-4 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl">Ready to watch your infrastructure?</h2>
          <p className="mt-4 text-slate-400">Set up in minutes. Pick the plan that matches your delivery needs.</p>
          <div className="mt-8 flex flex-col items-center gap-3">
            <Button size="lg" className="bg-violet-600 hover:bg-violet-700 text-white" asChild>
              <a href="/auth/login?screen_hint=signup">
                Get started <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
            <p className="text-sm text-slate-500">
              Already have an account?{" "}
              <a href="/auth/login" className="text-purple-400 underline underline-offset-4 hover:text-purple-300">
                Sign in
              </a>
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
