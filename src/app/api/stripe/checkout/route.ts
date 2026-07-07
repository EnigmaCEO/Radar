import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { auth0 } from "@/lib/auth0";
import { getAccount } from "@/lib/account";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" });

const PRICE_MAP: Record<string, string | undefined> = {
  radar_live: process.env.STRIPE_PRICE_RADAR_LIVE,
  radar_pro: process.env.STRIPE_PRICE_RADAR_PRO,
  // managed is custom-priced — no self-serve checkout
};

export async function POST(request: NextRequest) {
  const session = await auth0.getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await getAccount();
  if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  const { plan } = (await request.json()) as { plan: string };
  if (!plan || !PRICE_MAP[plan]) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const priceId = PRICE_MAP[plan]!;
  const appUrl = new URL(request.url).origin;
  const { sub, email, name } = session.user as { sub: string; email?: string; name?: string };

  try {
    if (account.stripeCustomerId) {
      await stripe.customers.update(account.stripeCustomerId, {
        metadata: { auth0_sub: sub, auth0_email: email ?? "", auth0_name: name ?? "" },
      });
    }

    // Existing subscriber → upgrade/downgrade in place (prorated)
    if (account.stripeSubId) {
      const existing = await stripe.subscriptions.retrieve(account.stripeSubId);
      await stripe.subscriptions.update(account.stripeSubId, {
        proration_behavior: "create_prorations",
        items: [{ id: existing.items.data[0].id, price: priceId }],
        metadata: { plan, accountId: account.id },
      });
      return NextResponse.json({ url: "/dashboard/settings?checkout=success" });
    }

    // New subscriber → Stripe Checkout
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      customer: account.stripeCustomerId ?? undefined,
      customer_email: account.stripeCustomerId ? undefined : email,
      customer_update: account.stripeCustomerId ? { address: "auto" } : undefined,
      subscription_data: {
        metadata: { plan, accountId: account.id, auth0_sub: sub },
      },
      metadata: { plan, accountId: account.id, auth0_sub: sub },
      success_url: `${appUrl}/dashboard/settings?checkout=success`,
      cancel_url: `${appUrl}/#pricing`,
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Stripe checkout error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
