"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/#features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
];

export function Nav() {
  const pathname = usePathname();
  const isMarketing = !pathname.startsWith("/dashboard");

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b",
        isMarketing
          ? "border-white/10 bg-[#07060f]/90 backdrop-blur"
          : "border-border bg-background/95 backdrop-blur",
      )}
    >
      <div className="container mx-auto flex h-14 max-w-screen-xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo size={28} />
          <span
            className={cn(
              "font-bold tracking-wide",
              isMarketing ? "text-white" : "text-foreground",
            )}
          >
            Radar
          </span>
          <span
            className={cn(
              "text-xs font-normal",
              isMarketing ? "text-purple-400/70" : "text-muted-foreground",
            )}
          >
            by Sagitta Labs
          </span>
        </Link>

        {isMarketing && (
          <nav className="hidden md:flex items-center gap-6 text-sm">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-slate-300 transition-colors hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        )}

        <div className="flex items-center gap-2">
          <ThemeToggle className={isMarketing ? "text-slate-300 hover:text-white hover:bg-white/10" : ""} />
          {isMarketing && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-300 hover:text-white hover:bg-white/10"
                asChild
              >
                <Link href="/login">Sign in</Link>
              </Button>
              <Button
                size="sm"
                className="bg-violet-600 hover:bg-violet-700 text-white"
                asChild
              >
                <Link href="/auth/login?screen_hint=signup">Get started free</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

const dashboardLinks = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/alerts", label: "Alerts" },
  { href: "/dashboard/watchlists", label: "Watchlists" },
  { href: "/dashboard/destinations", label: "Delivery" },
  { href: "/dashboard/settings", label: "Settings" },
];

export function DashboardNav() {
  const pathname = usePathname();
  return (
    <aside className="w-56 shrink-0 hidden md:block border-r border-border">
      <nav className="flex flex-col gap-1 p-3 pt-4">
        {dashboardLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "rounded-md px-3 py-2 text-sm transition-colors",
              pathname === link.href
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
