import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";

export const metadata: Metadata = {
  title: "Terms",
  description: "Radar terms of service.",
};

const sections = [
  {
    title: "Service scope",
    body: [
      "Radar provides DeFi infrastructure monitoring, alerting, and related account features. The service is offered on a commercially reasonable basis and may change over time.",
      "We may add, remove, or modify features, limits, and integrations as the product evolves.",
    ],
  },
  {
    title: "Accounts and access",
    body: [
      "You are responsible for the activity that occurs under your account, for maintaining the confidentiality of credentials, and for ensuring that your connected delivery destinations and third-party services are configured appropriately.",
      "You must provide accurate account and billing information and keep it current.",
    ],
  },
  {
    title: "Acceptable use",
    body: [
      "You may not use Radar to break the law, interfere with the service, attempt unauthorized access, abuse integrations, or transmit harmful content or instructions through the platform.",
      "We may suspend or terminate access where necessary to protect the service, customers, or third parties.",
    ],
  },
  {
    title: "Fees and billing",
    body: [
      "Paid plans are billed through Stripe unless otherwise agreed in writing. Subscription changes, renewals, cancellations, and payment collection are governed by the applicable plan and Stripe checkout or billing portal flow.",
      "Failure to pay may result in downgrade, suspension, or termination of paid features.",
    ],
  },
  {
    title: "No warranty",
    body: [
      "Radar is provided on an \"as is\" and \"as available\" basis. We do not guarantee uninterrupted service, complete coverage, or error-free operation.",
      "Monitoring outputs and alerts should support, not replace, your own operational judgment and controls.",
    ],
  },
  {
    title: "Liability limits",
    body: [
      "To the maximum extent permitted by law, Sagitta Systems is not liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for loss of profits, revenues, goodwill, data, or business opportunities.",
      "Our total liability for claims relating to Radar will not exceed the amounts paid by you for the service during the twelve months preceding the event giving rise to the claim.",
    ],
  },
  {
    title: "Contact",
    body: [
      "Questions about these terms can be sent to hello@sagitta.systems.",
    ],
  },
];

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Nav />
      <main className="flex-1 py-20">
        <div className="container mx-auto max-w-4xl px-4">
          <div className="mb-12 max-w-3xl">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Terms
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-foreground">
              Terms of Service
            </h1>
            <p className="mt-4 text-sm text-muted-foreground">
              Last updated July 8, 2026. These terms govern access to and use of
              Radar by Sagitta Systems.
            </p>
          </div>

          <div className="space-y-10">
            {sections.map((section) => (
              <section key={section.title} className="border-t border-border pt-6">
                <h2 className="text-lg font-semibold text-foreground">{section.title}</h2>
                <div className="mt-3 space-y-3 text-sm leading-7 text-muted-foreground">
                  {section.body.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div className="mt-12 border-t border-border pt-6 text-sm text-muted-foreground">
            For operational questions, billing help, or account support, visit the{" "}
            <Link href="/support" className="text-foreground underline underline-offset-4">
              support page
            </Link>
            .
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
