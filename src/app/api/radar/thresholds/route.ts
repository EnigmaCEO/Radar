import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { stripTrailingSlash } from "@/lib/utils";

// The thresholds endpoint lives on the SCE API and is admin-protected
// (require_admin_api_key → X-SCE-Admin-Key). The admin key is attached here,
// server-side, so authenticated dashboard users can read it without ever
// seeing the key. Mirrors the pattern in src/lib/sce-alerts.ts.
function getSceBaseUrl(): string {
  return stripTrailingSlash(
    process.env.SCE_API_BASE_URL
      ?? process.env.NEXT_PUBLIC_API_URL
      ?? "https://continuityengineserver.fly.dev",
  );
}

export async function GET(request: NextRequest) {
  const session = await auth0.getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const adminKey = process.env.SCE_ADMIN_API_KEY;
  if (!adminKey) {
    console.error("Thresholds proxy: SCE_ADMIN_API_KEY is not configured.");
    return NextResponse.json({ error: "Thresholds are unavailable." }, { status: 503 });
  }

  let response: Response;
  try {
    response = await fetch(`${getSceBaseUrl()}/v1/sce/radar/thresholds`, {
      headers: { "X-SCE-Admin-Key": adminKey },
      cache: "no-store",
    });
  } catch (error) {
    console.error("Thresholds proxy error:", error);
    return NextResponse.json({ error: "Thresholds backend unreachable." }, { status: 502 });
  }

  if (!response.ok) {
    return NextResponse.json(
      { error: `SCE request failed (${response.status}).` },
      { status: response.status === 401 || response.status === 403 ? 502 : response.status },
    );
  }

  const data = await response.json().catch(() => null);
  if (data === null) {
    return NextResponse.json({ error: "Invalid response from SCE." }, { status: 502 });
  }

  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
