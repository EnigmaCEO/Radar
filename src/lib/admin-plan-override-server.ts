import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import {
  ADMIN_VIEW_PLAN_COOKIE,
  ADMIN_VIEW_PLAN_HEADER,
  normalizeAdminViewPlan,
} from "@/lib/admin-plan-override";

export async function getAdminViewPlanFromCookies() {
  const cookieStore = await cookies();
  return normalizeAdminViewPlan(cookieStore.get(ADMIN_VIEW_PLAN_COOKIE)?.value);
}

export function getAdminViewPlanFromRequest(request: NextRequest) {
  return normalizeAdminViewPlan(request.cookies.get(ADMIN_VIEW_PLAN_COOKIE)?.value);
}

export function buildAdminViewPlanHeaders(request: NextRequest): HeadersInit | undefined {
  const plan = getAdminViewPlanFromRequest(request);
  if (!plan) return undefined;
  return { [ADMIN_VIEW_PLAN_HEADER]: plan };
}
