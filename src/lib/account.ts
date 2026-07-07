import { cache } from "react";
import { auth0 } from "@/lib/auth0";
import { db } from "@/lib/db";
import type { RadarAccount } from "@prisma/client";

// Cached per request — safe to call from multiple server components in one render.
export const getAccount = cache(async (): Promise<RadarAccount | null> => {
  const session = await auth0.getSession();
  if (!session?.user?.sub) return null;

  const { sub, name, email } = session.user as { sub: string; name?: string; email?: string };

  return db.radarAccount.upsert({
    where: { ownerSub: sub },
    create: { ownerSub: sub, name: name ?? email ?? "My Account" },
    update: {},
  });
});
