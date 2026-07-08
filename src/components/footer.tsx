import Link from "next/link";
import { Logo } from "@/components/logo";

export function Footer() {
  return (
    <footer className="border-t border-border bg-background py-12">
      <div className="container mx-auto max-w-screen-xl px-4">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="mb-3 flex items-center gap-2 font-semibold text-foreground">
              <Logo size={20} />
              <span>Radar</span>
              <span className="text-xs font-normal text-muted-foreground">by Sagitta Labs</span>
            </Link>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Real-time DeFi infrastructure intelligence. Monitor oracles, bridges, and liquidity
              pools across every major chain.
            </p>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold text-foreground">Product</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/#features" className="hover:text-foreground transition-colors">
                  Features
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="hover:text-foreground transition-colors">
                  Pricing
                </Link>
              </li>
              <li>
                <a href="/auth/login?screen_hint=signup" className="hover:text-foreground transition-colors">
                  Get started
                </a>
              </li>
              <li>
                <Link href="/request-access" className="hover:text-foreground transition-colors">
                  Managed plan
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold text-foreground">Legal</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/privacy" className="hover:text-foreground transition-colors">
                  Privacy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-foreground transition-colors">
                  Terms
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold text-foreground">Sagitta</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <a
                  href="https://sagitta.systems"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground transition-colors"
                >
                  sagitta.systems
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-border pt-8 text-xs text-muted-foreground">
          © {new Date().getFullYear()} Sagitta Systems. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
