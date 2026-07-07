"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle, Loader2 } from "lucide-react";
import { requestAccess } from "@/lib/api";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function RequestAccessPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    organization: "",
    roleTitle: "",
    useCase: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await requestAccess(form);
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again or email us directly at hello@sagitta.systems.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#07060f] p-4">
      <Link href="/" className="mb-8 flex items-center gap-2.5">
        <Logo size={36} />
        <span className="text-xl font-bold text-white">Radar</span>
        <span className="text-sm text-purple-400/70">by Sagitta Labs</span>
      </Link>

      {submitted ? (
        <Card className="w-full max-w-sm border-white/10 bg-white/5 text-white backdrop-blur">
          <CardContent className="pt-6 text-center space-y-4">
            <CheckCircle className="mx-auto h-12 w-12 text-green-400" />
            <h2 className="text-lg font-semibold text-white">We&apos;ll be in touch</h2>
            <p className="text-sm text-slate-400">
              Thanks for reaching out. We&apos;ll review your details and get back to you shortly to discuss the Managed plan.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white hover:border-white/25"
              asChild
            >
              <Link href="/">Back to home</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="w-full max-w-md border-white/10 bg-white/5 text-white backdrop-blur">
          <CardHeader>
            <CardTitle className="text-white">Talk to us about Managed</CardTitle>
            <CardDescription className="text-slate-400">
              The Managed plan is custom-priced for funds, multi-protocol teams, and ops teams with complex requirements. Tell us about your setup and we&apos;ll get back to you.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-slate-300">Name *</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="Alice"
                    required
                    value={form.name}
                    onChange={handleChange}
                    disabled={loading}
                    className="border-white/15 bg-white/5 text-white placeholder:text-slate-500 focus-visible:ring-primary"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-300">Email *</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="alice@protocol.xyz"
                    required
                    value={form.email}
                    onChange={handleChange}
                    disabled={loading}
                    className="border-white/15 bg-white/5 text-white placeholder:text-slate-500 focus-visible:ring-primary"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="organization" className="text-slate-300">Organization *</Label>
                <Input
                  id="organization"
                  name="organization"
                  placeholder="Protocol / fund / team name"
                  required
                  value={form.organization}
                  onChange={handleChange}
                  disabled={loading}
                  className="border-white/15 bg-white/5 text-white placeholder:text-slate-500 focus-visible:ring-primary"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="roleTitle" className="text-slate-300">Role</Label>
                <Input
                  id="roleTitle"
                  name="roleTitle"
                  placeholder="e.g. Head of Risk"
                  value={form.roleTitle}
                  onChange={handleChange}
                  disabled={loading}
                  className="border-white/15 bg-white/5 text-white placeholder:text-slate-500 focus-visible:ring-primary"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="useCase" className="text-slate-300">What do you need to monitor?</Label>
                <textarea
                  id="useCase"
                  name="useCase"
                  placeholder="e.g. 20+ oracle feeds across Arbitrum and Base, bridge settlement monitoring for CCTP and Across, plus webhook delivery to our ops PagerDuty"
                  rows={3}
                  value={form.useCase}
                  onChange={handleChange}
                  disabled={loading}
                  className="flex min-h-[72px] w-full rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm text-white shadow-sm placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                />
              </div>

              {error && <p className="text-sm text-red-400">{error}</p>}

              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90 text-white shadow-[0_0_12px_hsl(var(--primary)/0.3)]"
                disabled={loading}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send enquiry
              </Button>

              <p className="text-center text-xs text-slate-500">
                Looking for Free, Live, or Pro?{" "}
                <Link href="/auth/login" className="text-purple-400 underline underline-offset-4 hover:text-purple-300">
                  Sign up directly
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
