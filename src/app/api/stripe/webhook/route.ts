import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "@/lib/db";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" });
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

const STATUS_MAP: Record<string, string> = {
  active: "active",
  trialing: "trial",
  past_due: "past_due",
  canceled: "canceled",
};

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      // Link the Stripe customer to the account on first checkout
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") break;

        const accountId = session.metadata?.accountId;
        const auth0Sub = session.metadata?.auth0_sub;
        const customerId = session.customer as string;
        if (!accountId || !customerId) break;

        // Link customer to account
        await db.radarAccount.update({
          where: { id: accountId },
          data: { stripeCustomerId: customerId },
        });

        // Stamp Auth0 identity onto the Stripe customer for support lookups
        if (auth0Sub) {
          await stripe.customers.update(customerId, {
            metadata: { auth0_sub: auth0Sub },
          });
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;
        const plan = (sub.metadata?.plan as string) ?? "radar_live";
        const status = STATUS_MAP[sub.status] ?? "suspended";

        await db.radarAccount.updateMany({
          where: { stripeCustomerId: customerId },
          data: { plan, status, stripeSubId: sub.id },
        });
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;

        await db.radarAccount.updateMany({
          where: { stripeCustomerId: customerId },
          data: { plan: "free", status: "canceled", stripeSubId: null },
        });
        break;
      }
    }
  } catch (err) {
    console.error(`Stripe webhook error [${event.type}]:`, err);
  }

  return NextResponse.json({ received: true });
}
