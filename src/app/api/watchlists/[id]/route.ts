import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { getAccount } from "@/lib/account";
import { db } from "@/lib/db";
import { WatchlistValidationError, validateWatchlistFilters } from "@/lib/watchlist-filters";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await auth0.getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await getAccount();
  if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  const existing = await db.radarWatchlist.findFirst({
    where: { id: params.id, accountId: account.id },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

  if (body.name !== undefined && (typeof body.name !== "string" || body.name.trim() === "")) {
    return NextResponse.json({ error: "name must be a non-empty string." }, { status: 400 });
  }

  try {
    const filters = validateWatchlistFilters(body);

    const updated = await db.radarWatchlist.update({
      where: { id: params.id },
      data: {
        ...(body.name !== undefined && { name: body.name as string }),
        ...(body.description !== undefined && {
          description: typeof body.description === "string" ? body.description : null,
        }),
        ...(body.enabled !== undefined && { enabled: body.enabled === true }),
        ...filters,
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof WatchlistValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error("Watchlists PATCH error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await auth0.getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await getAccount();
  if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  const existing = await db.radarWatchlist.findFirst({
    where: { id: params.id, accountId: account.id },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.radarWatchlist.delete({ where: { id: params.id } });
  return new NextResponse(null, { status: 204 });
}
