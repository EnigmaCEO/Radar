import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { mgmtFetch } from "@/lib/auth0-mgmt";

// GET — return current MFA status for the logged-in user
export async function GET(request: NextRequest) {
  const session = await auth0.getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sub = (session.user as { sub: string }).sub;

  const res = await mgmtFetch(`/users/${encodeURIComponent(sub)}`);
  if (!res.ok) return NextResponse.json({ error: "Failed to fetch user" }, { status: 502 });

  const user = await res.json();
  const enabled =
    user.user_metadata?.use_mfa === true || user.app_metadata?.use_mfa === true;

  return NextResponse.json({ enabled });
}

// POST — toggle MFA on or off
export async function POST(request: NextRequest) {
  const session = await auth0.getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sub = (session.user as { sub: string }).sub;
  const { enabled } = (await request.json()) as { enabled: boolean };

  // Update both user_metadata and app_metadata to match AAA convention
  const res = await mgmtFetch(`/users/${encodeURIComponent(sub)}`, {
    method: "PATCH",
    body: JSON.stringify({
      user_metadata: { use_mfa: enabled },
      app_metadata: { use_mfa: enabled },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error("MFA update failed:", err);
    return NextResponse.json({ error: "Failed to update MFA" }, { status: 502 });
  }

  // If disabling, also remove enrolled factors so user isn't stuck
  if (!enabled) {
    for (const provider of ["guardian", "google-authenticator", "sms", "email", "otp", "duo"]) {
      await mgmtFetch(`/users/${encodeURIComponent(sub)}/multifactor/${provider}`, {
        method: "DELETE",
      }).catch(() => null); // ignore — factor may not be enrolled
    }
  }

  return NextResponse.json({ enabled });
}
