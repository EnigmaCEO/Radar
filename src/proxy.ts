import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth0 } from "@/lib/auth0";

export async function proxy(request: NextRequest) {
  const authRes = await auth0.middleware(request);

  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/dashboard")) {
    const session = await auth0.getSession(request);
    if (!session) {
      console.warn("[radar-auth] proxy redirect: missing dashboard session", {
        pathname,
      });
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("returnTo", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return authRes ?? NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/auth/:path*"],
};
