import "server-only";
import { adminDb } from "@/db/admin";
import { emailLog } from "@/db/schema";
import { getServerEnv } from "@/env/server";

export type OutgoingEmail = {
  workspaceId: string;
  bookingId?: string;
  kind: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: { filename: string; content: string; contentType: string }[];
};

export type EmailStatus = "sent" | "failed" | "not_sent";

/**
 * Sends through Resend when a key is set, and always records the email in email_log.
 * Never throws: a failed email must not undo the booking that triggered it.
 */
export async function sendEmail(email: OutgoingEmail): Promise<EmailStatus> {
  const env = getServerEnv();
  let status: EmailStatus = "not_sent";
  let providerId: string | null = null;
  let error: string | null = null;

  if (env.RESEND_API_KEY) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: env.EMAIL_FROM,
          to: [email.to],
          subject: email.subject,
          html: email.html,
          text: email.text,
          attachments: email.attachments?.map((file) => ({
            filename: file.filename,
            content: Buffer.from(file.content, "utf8").toString("base64"),
            content_type: file.contentType,
          })),
        }),
        signal: AbortSignal.timeout(10_000),
      });
      const body = (await response.json().catch(() => ({}))) as {
        id?: string;
        message?: string;
      };
      if (response.ok) {
        status = "sent";
        providerId = body.id ?? null;
      } else {
        status = "failed";
        error = body.message ?? `Resend answered ${response.status}`;
      }
    } catch (err) {
      status = "failed";
      error = err instanceof Error ? err.message : String(err);
    }
  }

  try {
    await adminDb.insert(emailLog).values({
      workspaceId: email.workspaceId,
      bookingId: email.bookingId,
      kind: email.kind,
      toEmail: email.to,
      subject: email.subject,
      html: email.html,
      text: email.text,
      status,
      providerId,
      error,
    });
  } catch (err) {
    console.error("email_log insert failed", err);
  }
  return status;
}
