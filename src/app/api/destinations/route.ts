import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { getAccount } from "@/lib/account";
import { db } from "@/lib/db";
import {
  DEFAULT_DELIVERY_MODE,
  isDeliveryMode,
  normalizeDeliveryMode,
} from "@/lib/delivery-modes";
import { encrypt, maskUrl } from "@/lib/encryption";

const deliveryDestinations = db.radarDeliveryDestination as unknown as {
  count: (args: unknown) => Promise<number>;
  create: (args: unknown) => Promise<unknown>;
  findMany: (args: unknown) => Promise<unknown[]>;
};

const PLAN_LIMITS: Record<string, number> = {
  free: 1,
  radar_live: 2,
  radar_pro: 10,
  managed: Infinity,
};

const PLAN_CHANNELS: Record<string, string[]> = {
  free: ["webhook"],
  radar_live: ["webhook", "discord_webhook", "telegram_bot"],
  radar_pro: ["webhook", "discord_webhook", "telegram_bot", "x_account"],
  managed: ["webhook", "discord_webhook", "telegram_bot", "x_account"],
};

const DESTINATION_SELECT = {
  id: true,
  accountId: true,
  name: true,
  channel: true,
  destinationUrl: true,
  deliveryMode: true,
  enabled: true,
  minimumSeverity: true,
  pollingFrequency: true,
  lastPolledAt: true,
  configPreview: true,
  createdAt: true,
  updatedAt: true,
} as const;

const LEGACY_DESTINATION_SELECT = {
  id: true,
  accountId: true,
  name: true,
  channel: true,
  destinationUrl: true,
  enabled: true,
  minimumSeverity: true,
  pollingFrequency: true,
  lastPolledAt: true,
  configPreview: true,
  createdAt: true,
  updatedAt: true,
} as const;

function isDeliveryModeCompatibilityError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return /deliverymode/i.test(error.message) && /(unknown|column|field|argument)/i.test(error.message);
}

function normalizeDestinationRecord(record: Record<string, unknown>) {
  return {
    ...record,
    deliveryMode: normalizeDeliveryMode(record.deliveryMode),
  };
}

export async function GET(request: NextRequest) {
  const session = await auth0.getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await getAccount();
  if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  try {
    const destinations = (await deliveryDestinations.findMany({
      where: { accountId: account.id },
      orderBy: { createdAt: "desc" },
      select: DESTINATION_SELECT,
    })) as Record<string, unknown>[];

    return NextResponse.json(destinations.map(normalizeDestinationRecord), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (!isDeliveryModeCompatibilityError(error)) throw error;

    const destinations = (await deliveryDestinations.findMany({
      where: { accountId: account.id },
      orderBy: { createdAt: "desc" },
      select: LEGACY_DESTINATION_SELECT,
    })) as Record<string, unknown>[];

    return NextResponse.json(
      destinations.map((destination) => ({
        ...destination,
        deliveryMode: DEFAULT_DELIVERY_MODE,
      })),
      {
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await auth0.getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await getAccount();
  if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  const limit = PLAN_LIMITS[account.plan] ?? 0;
  const allowedChannels = PLAN_CHANNELS[account.plan] ?? [];

  if (limit === 0) {
    return NextResponse.json({ error: "Your plan does not include delivery destinations." }, { status: 403 });
  }

  const count = await deliveryDestinations.count({ where: { accountId: account.id } });
  if (count >= limit) {
    return NextResponse.json({ error: "Destination limit reached for your plan." }, { status: 403 });
  }

  const body = await request.json() as {
    name: string;
    channel: string;
    destinationUrl: string;
    deliveryMode?: string;
    minimumSeverity?: string;
    pollingFrequency?: string;
    enabled?: boolean;
    xCredentials?: {
      apiKey: string;
      apiSecret: string;
      accessToken: string;
      accessTokenSecret: string;
      bearerToken: string;
    };
  };

  if (!allowedChannels.includes(body.channel)) {
    return NextResponse.json({ error: `Channel "${body.channel}" is not available on your plan.` }, { status: 403 });
  }
  if (body.deliveryMode !== undefined && !isDeliveryMode(body.deliveryMode)) {
    return NextResponse.json({ error: `Unsupported deliveryMode "${body.deliveryMode}".` }, { status: 400 });
  }

  try {
  let configEncrypted: string | undefined;
  let configPreview: object | undefined;

  if (body.channel === "x_account") {
    if (!body.xCredentials) {
      return NextResponse.json({ error: "X credentials are required." }, { status: 400 });
    }
    configEncrypted = encrypt(JSON.stringify(body.xCredentials));
    configPreview = {
      handle: body.destinationUrl,
      credentialStatus: "configured",
      lastVerifiedAt: null,
    };
  } else if (body.channel === "discord_webhook" || body.channel === "webhook") {
    configPreview = { maskedUrl: maskUrl(body.destinationUrl) };
  } else if (body.channel === "telegram_bot") {
    configPreview = { chatId: body.destinationUrl };
  }

  try {
    const destination = (await deliveryDestinations.create({
      data: {
        accountId: account.id,
        name: body.name,
        channel: body.channel,
        destinationUrl: body.destinationUrl,
        deliveryMode: normalizeDeliveryMode(body.deliveryMode),
        minimumSeverity: body.minimumSeverity ?? "watch",
        pollingFrequency: body.pollingFrequency ?? "1hr",
        enabled: body.enabled ?? true,
        configEncrypted: configEncrypted ?? null,
        configPreview: configPreview ?? undefined,
      },
      select: DESTINATION_SELECT,
    })) as Record<string, unknown>;

    return NextResponse.json(normalizeDestinationRecord(destination), { status: 201 });
  } catch (error) {
    if (!isDeliveryModeCompatibilityError(error)) throw error;

    const destination = (await deliveryDestinations.create({
      data: {
        accountId: account.id,
        name: body.name,
        channel: body.channel,
        destinationUrl: body.destinationUrl,
        minimumSeverity: body.minimumSeverity ?? "watch",
        pollingFrequency: body.pollingFrequency ?? "1hr",
        enabled: body.enabled ?? true,
        configEncrypted: configEncrypted ?? null,
        configPreview: configPreview ?? undefined,
      },
      select: LEGACY_DESTINATION_SELECT,
    })) as Record<string, unknown>;

    return NextResponse.json(
      { ...destination, deliveryMode: DEFAULT_DELIVERY_MODE },
      { status: 201 },
    );
  }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Destinations POST error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
