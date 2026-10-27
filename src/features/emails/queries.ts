import { desc, eq } from "drizzle-orm";
import { type AuthClaims, withRls } from "@/db";
import { emailLog } from "@/db/schema";

const PAGE = 50;

/** The workspace's latest emails, sent or not: the outbox the Emails page shows. */
export async function listEmails(claims: AuthClaims, workspaceId: string) {
  return withRls(claims, (tx) =>
    tx
      .select({
        id: emailLog.id,
        kind: emailLog.kind,
        to: emailLog.toEmail,
        subject: emailLog.subject,
        text: emailLog.text,
        status: emailLog.status,
        error: emailLog.error,
        createdAt: emailLog.createdAt,
      })
      .from(emailLog)
      .where(eq(emailLog.workspaceId, workspaceId))
      .orderBy(desc(emailLog.createdAt))
      .limit(PAGE),
  );
}
