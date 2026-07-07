import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { getAccount } from "@/lib/account";
import { db } from "@/lib/db";

async function testDiscord(webhookUrl: string): Promise<void> {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      embeds: [{
        title: "Radar connection test",
        description: "This destination is successfully connected to Radar by Sagitta Labs. You will receive alert reports here.",
        color: 0x7c3aed,
        footer: { text: "radar.sagitta.systems" },
        timestamp: new Date().toISOString(),
      }],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Discord returned ${res.status}${body ? `: ${body}` : ""}`);
  }
}

async function testTelegram(chatId: string): Promise<void> {
  const botToken = process.env.RADAR_TELEGRAM_BOT_TOKEN;
  if (!botToken) throw new Error("RADAR_TELEGRAM_BOT_TOKEN is not configured.");

  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: "✅ *Radar connection test*\n\nThis destination is successfully connected to Radar by Sagitta Labs\\. You will receive alert reports here\\.",
      parse_mode: "MarkdownV2",
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    throw new Error(data.description ?? `Telegram returned ${res.status}`);
  }
}

async function testWebhook(url: string): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "test",
      source: "radar.sagitta.systems",
      message: "Radar connection test — this destination is configured correctly.",
      timestamp: new Date().toISOString(),
    }),
  });
  if (!res.ok) {
    throw new Error(`Endpoint returned ${res.status}`);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth0.getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await getAccount();
  if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });
  const { id } = await params;

  const dest = await db.radarDeliveryDestination.findFirst({
    where: { id, accountId: account.id },
  });
  if (!dest) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    switch (dest.channel) {
      case "discord_webhook":
        await testDiscord(dest.destinationUrl);
        break;
      case "telegram_bot":
        await testTelegram(dest.destinationUrl);
        break;
      case "webhook":
        await testWebhook(dest.destinationUrl);
        break;
      case "x_account":
        // X credential verification deferred — requires full OAuth flow
        return NextResponse.json({ error: "X connection testing is not yet available." }, { status: 501 });
      default:
        return NextResponse.json({ error: "Unknown channel type." }, { status: 400 });
    }

    // Stamp last tested time in configPreview
    const existing = (dest.configPreview as Record<string, unknown>) ?? {};
    await db.radarDeliveryDestination.update({
      where: { id: dest.id },
      data: {
        configPreview: { ...existing, lastTestedAt: new Date().toISOString(), testStatus: "ok" },
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // Stamp failure in configPreview
    const existing = (dest.configPreview as Record<string, unknown>) ?? {};
    await db.radarDeliveryDestination.update({
      where: { id: dest.id },
      data: {
        configPreview: { ...existing, lastTestedAt: new Date().toISOString(), testStatus: "failed" },
      },
    });

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
