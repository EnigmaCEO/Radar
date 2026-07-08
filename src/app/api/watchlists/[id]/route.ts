import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import {
  forwardRadarApiRequest,
  toProxyResponse,
} from "@/lib/radar-api-backend";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth0.getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  // Temporary adapter while the dashboard still talks to same-origin /api routes.
  const body = await request.text();
  const response = await forwardRadarApiRequest(`/v1/watchlists/${id}`, {
    method: "PATCH",
    session,
    body,
    contentType: request.headers.get("content-type"),
  });
  return toProxyResponse(response);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth0.getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  // Temporary adapter while the dashboard still talks to same-origin /api routes.
  const response = await forwardRadarApiRequest(`/v1/watchlists/${id}`, {
    method: "DELETE",
    session,
  });
  return toProxyResponse(response);
}
