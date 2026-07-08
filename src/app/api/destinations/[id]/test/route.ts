import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import {
  forwardRadarApiRequest,
  toProxyResponse,
} from "@/lib/radar-api-backend";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth0.getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  // Temporary adapter while the dashboard still talks to same-origin /api routes.
  const response = await forwardRadarApiRequest(`/v1/destinations/${id}/test`, {
    method: "POST",
    session,
  });
  return toProxyResponse(response);
}
