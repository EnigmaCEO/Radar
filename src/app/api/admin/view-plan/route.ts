import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import {
  ADMIN_VIEW_PLAN_COOKIE,
  normalizeAdminViewPlan,
} from "@/lib/admin-plan-override";
import { bootstrapRadarAccount } from "@/lib/radar-api-backend";

export async function POST(request: NextRequest) {
  const session = await auth0.getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await bootstrapRadarAccount(session);
  if (!account.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { plan?: string | null } | null;
  const plan = normalizeAdminViewPlan(body?.plan);

  const response = NextResponse.json({ plan });
  if (plan) {
    response.cookies.set({
      name: ADMIN_VIEW_PLAN_COOKIE,
      value: plan,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
  } else {
    response.cookies.delete(ADMIN_VIEW_PLAN_COOKIE);
  }

  return response;
}
