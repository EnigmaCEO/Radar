import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { forwardRadarApiRequest } from "@/lib/radar-api-backend";

export async function GET(request: NextRequest) {
  const session = await auth0.getSession(request);
  if (!session) return NextResponse.redirect(new URL("/auth/login", request.url));

  // Temporary adapter while the dashboard still talks to same-origin /api routes.
  const response = await forwardRadarApiRequest("/v1/stripe/portal", {
    method: "GET",
    session,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const error =
      payload && typeof payload === "object" && payload.error === "No billing customer"
        ? "no_billing_customer"
        : "portal_failed";
    return NextResponse.redirect(new URL(`/dashboard/settings?error=${error}`, request.url));
  }

  const payload = await response.json().catch(() => null);
  if (!payload || typeof payload !== "object" || typeof payload.url !== "string") {
    return NextResponse.redirect(new URL("/dashboard/settings?error=portal_failed", request.url));
  }

  return NextResponse.redirect(payload.url);
}
