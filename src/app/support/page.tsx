import type { Metadata } from "next";
import Link from "next/link";
import { Mail, Shield, CreditCard, LifeBuoy } from "lucide-react";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";

export const metadata: Metadata = {
  title: "Support",
  description: "Radar support and contact information.",
};

const supportCards = [
  {
    title: "General support",
    icon: LifeBuoy,
    body: "For product questions, onboarding, delivery setup, or operational issues, email radar@sagitta.systems.",
  },
  {
    title: "Billing",
    icon: CreditCard,
    body: "For billing or subscription issues, include your account email and a short description of the problem so we can match the correct account quickly.",
  },
  {
    title: "Security and privacy",
    icon: Shield,
    body: "For security disclosures, privacy questions, or sensitive operational concerns, contact us directly by email and include enough detail for reproduction and triage.",
  },
];

export default function SupportPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Nav />
      <main className="flex-1 py-20">
        <div className="container mx-auto max-w-5xl px-4">
          <div className="mb-12 max-w-3xl">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Support
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-foreground">
              Support and Contact
            </h1>
            <p className="mt-4 text-sm leading-7 text-muted-foreground">
              Radar support is handled directly by Sagitta Systems. The fastest way
              to reach us is by email.
            </p>
          </div>

          <section className="grid gap-5 md:grid-cols-3">
            {supportCards.map((card) => (
              <div key={card.title} className="border border-border bg-card px-5 py-5">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-violet-600/10 text-violet-500">
                  <card.icon className="h-5 w-5" />
                </div>
                <h2 className="text-base font-semibold text-foreground">{card.title}</h2>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">{card.body}</p>
              </div>
            ))}
          </section>

          <section className="mt-10 border-t border-border pt-8">
            <h2 className="text-lg font-semibold text-foreground">Contact channels</h2>
            <div className="mt-4 space-y-4 text-sm text-muted-foreground">
              <p>
                Email:{" "}
                <a
                  href="mailto:radar@sagitta.systems"
                  className="text-foreground underline underline-offset-4"
                >
                  radar@sagitta.systems
                </a>
              </p>
              <p>
                Website:{" "}
                <a
                  href="https://sagitta.systems"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground underline underline-offset-4"
                >
                  sagitta.systems
                </a>
              </p>
            </div>
          </section>

          <section className="mt-10 border-t border-border pt-8">
            <h2 className="text-lg font-semibold text-foreground">Useful pages</h2>
            <div className="mt-4 flex flex-wrap gap-4 text-sm">
              <Link href="/privacy" className="text-foreground underline underline-offset-4">
                Privacy Policy
              </Link>
              <Link href="/terms" className="text-foreground underline underline-offset-4">
                Terms of Service
              </Link>
              <Link href="/request-access" className="text-foreground underline underline-offset-4">
                Managed plan enquiries
              </Link>
            </div>
          </section>

          <section className="mt-10 border-t border-border pt-8">
            <a
              href="mailto:radar@sagitta.systems?subject=Radar%20Support"
              className="inline-flex items-center gap-2 rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
            >
              <Mail className="h-4 w-4" />
              Email support
            </a>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
