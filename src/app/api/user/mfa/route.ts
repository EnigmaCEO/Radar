import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import {
  forwardRadarApiRequest,
  toProxyResponse,
} from "@/lib/radar-api-backend";

export async function GET(request: NextRequest) {
  const session = await auth0.getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Temporary adapter while the dashboard still talks to same-origin /api routes.
  const response = await forwardRadarApiRequest("/v1/user/mfa", {
    method: "GET",
    session,
  });
  return toProxyResponse(response);
}

export async function POST(request: NextRequest) {
  const session = await auth0.getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Temporary adapter while the dashboard still talks to same-origin /api routes.
  const body = await request.text();
  const response = await forwardRadarApiRequest("/v1/user/mfa", {
    method: "POST",
    session,
    body,
    contentType: request.headers.get("content-type"),
  });
  return toProxyResponse(response);
}
