import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { fetchSceCatalog, SceCatalogError } from "@/lib/sce-catalog";

export async function GET(request: NextRequest) {
  const session = await auth0.getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const catalog = await fetchSceCatalog();
    return NextResponse.json(catalog);
  } catch (err) {
    const message = err instanceof SceCatalogError ? err.message : "SCE catalog is unavailable.";
    console.error("Radar catalog GET error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
