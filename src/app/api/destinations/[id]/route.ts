import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { getAccount } from "@/lib/account";
import { db } from "@/lib/db";
import {
  DEFAULT_DELIVERY_MODE,
  isDeliveryMode,
  normalizeDeliveryMode,
} from "@/lib/delivery-modes";

const deliveryDestinations = db.radarDeliveryDestination as unknown as {
  delete: (args: unknown) => Promise<unknown>;
  findFirst: (args: unknown) => Promise<unknown>;
  update: (args: unknown) => Promise<unknown>;
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth0.getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await getAccount();
  if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });
  const { id } = await params;

  const existing = await deliveryDestinations.findFirst({
    where: { id, accountId: account.id },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await deliveryDestinations.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth0.getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await getAccount();
  if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });
  const { id } = await params;

  const existing = await deliveryDestinations.findFirst({
    where: { id, accountId: account.id },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json() as {
    enabled?: boolean;
    minimumSeverity?: string;
    pollingFrequency?: string;
    name?: string;
    destinationUrl?: string;
    deliveryMode?: string;
  };

  if (body.deliveryMode !== undefined && !isDeliveryMode(body.deliveryMode)) {
    return NextResponse.json({ error: `Unsupported deliveryMode "${body.deliveryMode}".` }, { status: 400 });
  }

  try {
    const updated = (await deliveryDestinations.update({
      where: { id },
      data: {
        ...(body.enabled !== undefined && { enabled: body.enabled }),
        ...(body.minimumSeverity !== undefined && { minimumSeverity: body.minimumSeverity }),
        ...(body.pollingFrequency !== undefined && { pollingFrequency: body.pollingFrequency }),
        ...(body.name !== undefined && { name: body.name }),
        ...(body.destinationUrl !== undefined && { destinationUrl: body.destinationUrl }),
        ...(body.deliveryMode !== undefined && { deliveryMode: body.deliveryMode }),
      },
      select: DESTINATION_SELECT,
    })) as Record<string, unknown>;

    return NextResponse.json(normalizeDestinationRecord(updated));
  } catch (error) {
    if (!isDeliveryModeCompatibilityError(error)) throw error;

    const updated = (await deliveryDestinations.update({
      where: { id },
      data: {
        ...(body.enabled !== undefined && { enabled: body.enabled }),
        ...(body.minimumSeverity !== undefined && { minimumSeverity: body.minimumSeverity }),
        ...(body.pollingFrequency !== undefined && { pollingFrequency: body.pollingFrequency }),
        ...(body.name !== undefined && { name: body.name }),
        ...(body.destinationUrl !== undefined && { destinationUrl: body.destinationUrl }),
      },
      select: LEGACY_DESTINATION_SELECT,
    })) as Record<string, unknown>;

    return NextResponse.json({
      ...updated,
      deliveryMode: DEFAULT_DELIVERY_MODE,
    });
  }
}
