import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { adminDb } from "@/db/admin";
import {
  conversations,
  leads,
  memberships,
  profiles,
  workspaces,
} from "@/db/schema";
import { getServerEnv } from "@/env/server";
import { escapeHtml } from "./booking-emails";
import { type EmailStatus, sendEmail } from "./mailer";

/** Tells the owners and admins that a visitor is waiting for a person. */
export async function sendHandoffAlert(input: {
  workspaceId: string;
  conversationId: string;
  reason: string;
}): Promise<void> {
  const managers = await adminDb
    .select({
      email: profiles.email,
      business: workspaces.name,
      slug: workspaces.slug,
    })
    .from(memberships)
    .innerJoin(profiles, eq(profiles.id, memberships.userId))
    .innerJoin(workspaces, eq(workspaces.id, memberships.workspaceId))
    .where(
      and(
        eq(memberships.workspaceId, input.workspaceId),
        inArray(memberships.role, ["owner", "admin"]),
      ),
    );
  const url = (slug: string) =>
    `${getServerEnv().NEXT_PUBLIC_SITE_URL}/w/${slug}/inbox/${input.conversationId}`;
  for (const manager of managers) {
    const link = url(manager.slug);
    await sendEmail({
      workspaceId: input.workspaceId,
      kind: "handoff",
      to: manager.email,
      subject: `A website visitor needs a person at ${manager.business}`,
      text: [
        "The receptionist handed a chat to the team.",
        `Why: ${input.reason}`,
        `Open the chat: ${link}`,
      ].join("\n\n"),
      html: `<!doctype html><html><body style="font-family:system-ui,sans-serif;color:#1c1917;line-height:1.5">
<p>The receptionist handed a chat to the team.</p>
<p><strong>Why:</strong> ${escapeHtml(input.reason)}</p>
<p><a href="${escapeHtml(link)}">Open the chat</a></p>
</body></html>`,
    });
  }
}

/**
 * Emails a team reply to the address the visitor left in this conversation. The address
 * always comes from the conversation's own lead, never from the person replying.
 */
export async function sendReplyEmail(input: {
  workspaceId: string;
  conversationId: string;
  staffName: string;
  content: string;
}): Promise<EmailStatus | "no_address"> {
  const [lead] = await adminDb
    .select({
      name: leads.name,
      email: leads.email,
      business: workspaces.name,
    })
    .from(leads)
    .innerJoin(conversations, eq(conversations.id, leads.conversationId))
    .innerJoin(workspaces, eq(workspaces.id, leads.workspaceId))
    .where(
      and(
        eq(leads.conversationId, input.conversationId),
        eq(leads.workspaceId, input.workspaceId),
        eq(conversations.workspaceId, input.workspaceId),
      ),
    )
    .orderBy(desc(leads.createdAt))
    .limit(1);
  if (!lead) return "no_address";
  const signature = `${input.staffName}, ${lead.business}`;
  return sendEmail({
    workspaceId: input.workspaceId,
    kind: "reply",
    to: lead.email,
    subject: `A reply from ${lead.business}`,
    text: [`Hi ${lead.name},`, input.content, signature].join("\n\n"),
    html: `<!doctype html><html><body style="font-family:system-ui,sans-serif;color:#1c1917;line-height:1.5">
<p>Hi ${escapeHtml(lead.name)},</p>
<p style="white-space:pre-line">${escapeHtml(input.content)}</p>
<p>${escapeHtml(signature)}</p>
</body></html>`,
  });
}
