import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import {
  forwardRadarApiRequest,
  toProxyResponse,
} from "@/lib/radar-api-backend";

export async function GET(request: NextRequest) {
  const session = await auth0.getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Admin-protected upstream endpoint; the shared secret is attached server-side
  // by forwardRadarApiRequest, so any authenticated dashboard user can read it.
  const response = await forwardRadarApiRequest("/v1/radar/thresholds", {
    method: "GET",
    session,
  });
  return toProxyResponse(response);
}
