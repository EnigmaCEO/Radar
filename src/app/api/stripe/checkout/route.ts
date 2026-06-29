import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

const PRICE_MAP: Record<string, string | undefined> = {
  radar_live: process.env.STRIPE_PRICE_RADAR_LIVE,
  radar_pro: process.env.STRIPE_PRICE_RADAR_PRO,
  managed: process.env.STRIPE_PRICE_MANAGED,
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const plan = searchParams.get("plan");
  const customerEmail = searchParams.get("email") ?? undefined;

  if (!plan || !PRICE_MAP[plan]) {
    return NextResponse.json({ error: "Invalid or unconfigured plan" }, { status: 400 });
  }

  const priceId = PRICE_MAP[plan];
  if (!priceId) {
    return NextResponse.json(
      { error: `Stripe price not configured for plan: ${plan}` },
      { status: 500 },
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://radar.sagitta.systems";

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: customerEmail,
      success_url: `${appUrl}/dashboard/settings?checkout=success`,
      cancel_url: `${appUrl}/pricing`,
      metadata: { plan },
      subscription_data: {
        metadata: { plan },
      },
    });

    return NextResponse.redirect(session.url!);
  } catch (err) {
    console.error("Stripe checkout error:", err);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
