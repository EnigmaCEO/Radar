import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";

export const metadata: Metadata = {
  title: "Privacy",
  description: "Radar privacy policy.",
};

const sections = [
  {
    title: "What we collect",
    body: [
      "We collect the information required to operate Radar, including account details, authentication data, billing records, submitted support requests, and product usage information related to alert delivery, watchlists, and account administration.",
      "If you contact us directly, we also receive whatever information you include in that message.",
    ],
  },
  {
    title: "How we use it",
    body: [
      "We use personal and account information to authenticate users, provide access to Radar features, process billing, respond to support requests, maintain service security, and improve the product.",
      "We do not sell your personal information.",
    ],
  },
  {
    title: "Infrastructure and processors",
    body: [
      "Radar relies on third-party infrastructure and service providers to operate, including hosting, authentication, billing, and communications vendors. Those providers process data only as needed to deliver the service.",
      "Examples in the current stack include Vercel, Fly.io, Auth0, and Stripe.",
    ],
  },
  {
    title: "Retention",
    body: [
      "We retain account, billing, and operational records for as long as needed to provide the service, meet legal obligations, resolve disputes, and enforce agreements.",
      "Support and request-access communications may be retained for ongoing customer and business operations.",
    ],
  },
  {
    title: "Security",
    body: [
      "We use reasonable technical and organizational measures to protect account and service data. No system can guarantee absolute security, so you should use strong credentials and protect access to your connected destinations and third-party accounts.",
    ],
  },
  {
    title: "Your choices",
    body: [
      "You can contact us to request updates or deletion of account-related information, subject to legal, security, and contractual requirements.",
      "For privacy questions, contact radar@sagitta.systems.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Nav />
      <main className="flex-1 py-20">
        <div className="container mx-auto max-w-4xl px-4">
          <div className="mb-12 max-w-3xl">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Privacy
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-foreground">
              Privacy Policy
            </h1>
            <p className="mt-4 text-sm text-muted-foreground">
              Last updated July 8, 2026. This page describes how Radar by Sagitta
              Systems collects, uses, and handles information in connection with the
              service.
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
            Questions about this policy can be sent to{" "}
            <a
              href="mailto:radar@sagitta.systems"
              className="text-foreground underline underline-offset-4"
            >
              radar@sagitta.systems
            </a>
            . Support options are also available on the{" "}
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
