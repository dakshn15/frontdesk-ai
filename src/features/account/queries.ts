import "server-only";
import { eq } from "drizzle-orm";
import { cache } from "react";
import { type AuthClaims, withRls } from "@/db";
import { profiles } from "@/db/schema";

export const getMyProfile = cache(
  async (
    claims: AuthClaims,
  ): Promise<{ fullName: string; email: string; avatarUrl: string | null }> => {
    const [row] = await withRls(claims, (tx) =>
      tx
        .select({
          fullName: profiles.fullName,
          email: profiles.email,
          avatarUrl: profiles.avatarUrl,
        })
        .from(profiles)
        .where(eq(profiles.id, claims.sub)),
    );
    return row ?? { fullName: "", email: claims.email ?? "", avatarUrl: null };
  },
);
