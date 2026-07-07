import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { auth0 } from "@/lib/auth0";
import { getAccount } from "@/lib/account";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" });

export async function GET(request: NextRequest) {
  const session = await auth0.getSession(request);
  if (!session) return NextResponse.redirect(new URL("/auth/login", request.url));

  const account = await getAccount();
  if (!account?.stripeCustomerId) {
    return NextResponse.redirect(
      new URL("/dashboard/settings?error=no_billing_customer", request.url),
    );
  }

  const appUrl = new URL(request.url).origin;

  try {
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: account.stripeCustomerId,
      return_url: `${appUrl}/dashboard/settings`,
    });
    return NextResponse.redirect(portalSession.url);
  } catch (err) {
    console.error("Stripe portal error:", err);
    return NextResponse.redirect(
      new URL("/dashboard/settings?error=portal_failed", request.url),
    );
  }
}
