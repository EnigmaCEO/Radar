import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "https://continuityengineserver.fly.dev";
  const adminKey = process.env.SCE_ADMIN_API_KEY ?? "";

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const plan = sub.metadata?.plan ?? "radar_live";
        const customerId = sub.customer as string;
        const status: string =
          sub.status === "active"
            ? "active"
            : sub.status === "trialing"
            ? "trial"
            : sub.status === "past_due"
            ? "past_due"
            : sub.status === "canceled"
            ? "canceled"
            : "suspended";

        // Find the client by externalBillingCustomerId and update plan + status
        const listRes = await fetch(
          `${apiBase}/v1/sce/radar/clients?limit=500`,
          { headers: { "X-SCE-Admin-Key": adminKey } },
        );
        if (listRes.ok) {
          const clients: Array<{ id: string; externalBillingCustomerId?: string }> =
            await listRes.json();
          const client = clients.find((c) => c.externalBillingCustomerId === customerId);
          if (client) {
            await fetch(`${apiBase}/v1/sce/radar/clients/${client.id}`, {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                "X-SCE-Admin-Key": adminKey,
              },
              body: JSON.stringify({ plan, status }),
            });
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;

        const listRes = await fetch(
          `${apiBase}/v1/sce/radar/clients?limit=500`,
          { headers: { "X-SCE-Admin-Key": adminKey } },
        );
        if (listRes.ok) {
          const clients: Array<{ id: string; externalBillingCustomerId?: string }> =
            await listRes.json();
          const client = clients.find((c) => c.externalBillingCustomerId === customerId);
          if (client) {
            await fetch(`${apiBase}/v1/sce/radar/clients/${client.id}`, {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                "X-SCE-Admin-Key": adminKey,
              },
              body: JSON.stringify({ plan: "free", status: "canceled" }),
            });
          }
        }
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error(`Error handling Stripe event ${event.type}:`, err);
  }

  return NextResponse.json({ received: true });
}
