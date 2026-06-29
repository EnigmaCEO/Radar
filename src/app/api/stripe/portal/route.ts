import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { cookies } from "next/headers";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://radar.sagitta.systems";
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "https://continuityengineserver.fly.dev";

  // Forward the session cookie to the SCE API to get user/account info
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("sce_session");

  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  let customerId: string | undefined;

  try {
    const meRes = await fetch(`${apiBase}/saas/me`, {
      headers: { Cookie: `sce_session=${sessionCookie.value}` },
    });
    if (meRes.ok) {
      const me = await meRes.json();
      const accountId = me?.activeAccount?.id ?? me?.memberships?.[0]?.account?.id;
      if (accountId) {
        const clientRes = await fetch(`${apiBase}/v1/sce/radar/clients/${accountId}`, {
          headers: { Cookie: `sce_session=${sessionCookie.value}` },
        });
        if (clientRes.ok) {
          const client = await clientRes.json();
          customerId = client?.externalBillingCustomerId ?? undefined;
        }
      }
    }
  } catch (err) {
    console.error("Failed to fetch client for Stripe portal:", err);
  }

  if (!customerId) {
    return NextResponse.redirect(
      new URL("/dashboard/settings?error=no_billing_customer", request.url),
    );
  }

  try {
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
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
