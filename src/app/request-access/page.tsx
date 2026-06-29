"use client";

import { useState } from "react";
import Link from "next/link";
import { Activity, CheckCircle, Loader2 } from "lucide-react";
import { requestAccess } from "@/lib/api";
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
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/20 p-4">
      <Link href="/" className="mb-8 flex items-center gap-2 font-semibold text-xl">
        <Activity className="h-6 w-6 text-primary" />
        Radar
      </Link>

      {submitted ? (
        <Card className="w-full max-w-sm">
          <CardContent className="pt-6 text-center space-y-4">
            <CheckCircle className="mx-auto h-12 w-12 text-primary" />
            <h2 className="text-lg font-semibold">Request received</h2>
            <p className="text-sm text-muted-foreground">
              We&apos;ll review your request and provision your account within one business day.
              You&apos;ll receive an email when you&apos;re approved.
            </p>
            <Button variant="outline" size="sm" asChild>
              <Link href="/">Back to home</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Request access</CardTitle>
            <CardDescription>
              Tell us about your team and what you&apos;d like to monitor. We&apos;ll provision your
              account within one business day.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="Alice"
                    required
                    value={form.name}
                    onChange={handleChange}
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="alice@protocol.xyz"
                    required
                    value={form.email}
                    onChange={handleChange}
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="organization">Organization *</Label>
                <Input
                  id="organization"
                  name="organization"
                  placeholder="Protocol / fund / team name"
                  required
                  value={form.organization}
                  onChange={handleChange}
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="roleTitle">Role</Label>
                <Input
                  id="roleTitle"
                  name="roleTitle"
                  placeholder="e.g. Smart contract engineer"
                  value={form.roleTitle}
                  onChange={handleChange}
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="useCase">What do you want to monitor?</Label>
                <textarea
                  id="useCase"
                  name="useCase"
                  placeholder="e.g. Chainlink ETH/USD staleness on Arbitrum; CCTP USDC settlement between Base and Ethereum"
                  rows={3}
                  value={form.useCase}
                  onChange={handleChange}
                  disabled={loading}
                  className="flex min-h-[72px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit request
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                Already have an account?{" "}
                <Link href="/login" className="underline underline-offset-4">
                  Sign in
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
