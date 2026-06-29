import Link from "next/link";
import { Activity } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border/40 py-12">
      <div className="container mx-auto max-w-screen-xl px-4">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 font-semibold mb-3">
              <Activity className="h-4 w-4 text-primary" />
              Radar
            </Link>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Real-time DeFi infrastructure intelligence. Monitor oracles, bridges, and liquidity
              pools across every major chain.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-medium mb-3">Product</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/#features" className="hover:text-foreground transition-colors">Features</Link></li>
              <li><Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link></li>
              <li><Link href="/request-access" className="hover:text-foreground transition-colors">Request access</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-medium mb-3">Legal</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link></li>
              <li><Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-medium mb-3">Sagitta</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <a href="https://sagitta.systems" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
                  sagitta.systems
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-border/40 pt-8 text-xs text-muted-foreground">
          © {new Date().getFullYear()} Sagitta Systems. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
