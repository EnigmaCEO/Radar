"use client";

import Link from "next/link";
import { LogOut } from "lucide-react";
import type { RadarAccount } from "@/lib/radar-account";
import { AccountProvider } from "@/lib/account-context";
import { DashboardNav } from "@/components/nav";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

export function DashboardShell({
  account,
  userEmail,
  children,
}: {
  account: RadarAccount;
  userEmail: string;
  children: React.ReactNode;
}) {
  return (
    <AccountProvider account={account} userEmail={userEmail}>
      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-40 border-b border-border/40 bg-background/95 backdrop-blur">
          <div className="flex h-14 items-center justify-between px-4 md:px-6">
            <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
              <Logo size={24} />
              <span className="text-foreground">Radar</span>
            </Link>

            <div className="flex items-center gap-2">
              <span className="hidden text-xs text-muted-foreground md:block">{userEmail}</span>
              <ThemeToggle />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => window.location.assign("/auth/logout")}
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>

        <div className="flex flex-1">
          <DashboardNav />
          <div className="flex min-w-0 flex-1 flex-col">
            <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
            <footer className="border-t border-border/60 px-4 py-4 md:px-6">
              <div className="flex flex-col gap-2 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
                <span>&copy; {new Date().getFullYear()} Sagitta Systems. All rights reserved.</span>
                <div className="flex flex-wrap items-center gap-4">
                  <Link href="/privacy" className="hover:text-foreground transition-colors">
                    Privacy
                  </Link>
                  <Link href="/terms" className="hover:text-foreground transition-colors">
                    Terms
                  </Link>
                  <Link href="/support" className="hover:text-foreground transition-colors">
                    Support
                  </Link>
                </div>
              </div>
            </footer>
          </div>
        </div>
      </div>
    </AccountProvider>
  );
}
