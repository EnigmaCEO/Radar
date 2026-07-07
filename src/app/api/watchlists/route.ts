import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { getAccount } from "@/lib/account";
import { db } from "@/lib/db";
import { getWatchlistLimit } from "@/lib/plan-limits";
import { WatchlistValidationError, validateWatchlistFilters } from "@/lib/watchlist-filters";

export async function GET(request: NextRequest) {
  const session = await auth0.getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await getAccount();
  if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  const watchlists = await db.radarWatchlist.findMany({
    where: { accountId: account.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(watchlists);
}

export async function POST(request: NextRequest) {
  const session = await auth0.getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await getAccount();
  if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  const limit = getWatchlistLimit(account.plan);
  const count = await db.radarWatchlist.count({ where: { accountId: account.id } });
  if (count >= limit) {
    return NextResponse.json({ error: "Watchlist limit reached for your plan." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.name !== "string" || body.name.trim() === "") {
    return NextResponse.json({ error: "name is required." }, { status: 400 });
  }

  try {
    const filters = validateWatchlistFilters(body);

    const watchlist = await db.radarWatchlist.create({
      data: {
        accountId: account.id,
        name: body.name,
        description: typeof body.description === "string" ? body.description : null,
        enabled: body.enabled === undefined ? true : body.enabled === true,
        matchMode: filters.matchMode ?? "any",
        minSeverity: filters.minSeverity ?? "watch",
        signalClasses: filters.signalClasses ?? [],
        monitorTypes: filters.monitorTypes ?? [],
        providers: filters.providers ?? [],
        chains: filters.chains ?? [],
        assets: filters.assets ?? [],
        objectIds: filters.objectIds ?? [],
        tags: filters.tags ?? [],
        purposes: filters.purposes ?? [],
        statuses: filters.statuses ?? [],
      },
    });

    return NextResponse.json(watchlist, { status: 201 });
  } catch (err) {
    if (err instanceof WatchlistValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error("Watchlists POST error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
