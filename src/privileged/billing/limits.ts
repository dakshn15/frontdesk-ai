import "server-only";
import { and, count, eq, gte, inArray, isNull, gt, sql } from "drizzle-orm";
import { adminDb } from "@/db/admin";
import {
  conversations,
  invitations,
  knowledgeSources,
  memberships,
  profiles,
  subscriptions,
  workspaces,
} from "@/db/schema";
import { getServerEnv } from "@/env/server";
import { type EffectivePlan, effectivePlan } from "@/features/billing/plans";
import { sendEmail } from "../mailer";
import { allowRequest } from "../rate-limit";

/** The first moment of this calendar month, in UTC: chat limits reset then. */
export function monthStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function planForWorkspace(
  workspaceId: string,
  now = new Date(),
): Promise<EffectivePlan> {
  const [row] = await adminDb
    .select({
      createdAt: workspaces.createdAt,
      demoExpiresAt: workspaces.demoExpiresAt,
      plan: subscriptions.plan,
      status: subscriptions.status,
    })
    .from(workspaces)
    .leftJoin(subscriptions, eq(subscriptions.workspaceId, workspaces.id))
    .where(eq(workspaces.id, workspaceId));
  return effectivePlan({
    subscription:
      row?.plan && row.status ? { plan: row.plan, status: row.status } : null,
    createdAt: row?.createdAt ?? now,
    demo: Boolean(row?.demoExpiresAt),
    now,
  });
}

/** What the workspace is using against its plan's limits. */
export async function usageOf(workspaceId: string, now = new Date()) {
  const [[chats], [sources], [members], [invites]] = await Promise.all([
    adminDb
      .select({ n: count() })
      .from(conversations)
      .where(
        and(
          eq(conversations.workspaceId, workspaceId),
          eq(conversations.channel, "widget"),
          gte(conversations.createdAt, monthStart(now)),
        ),
      ),
    adminDb
      .select({ n: count() })
      .from(knowledgeSources)
      .where(eq(knowledgeSources.workspaceId, workspaceId)),
    adminDb
      .select({ n: count() })
      .from(memberships)
      .where(eq(memberships.workspaceId, workspaceId)),
    adminDb
      .select({ n: count() })
      .from(invitations)
      .where(
        and(
          eq(invitations.workspaceId, workspaceId),
          isNull(invitations.acceptedAt),
          isNull(invitations.revokedAt),
          gt(invitations.expiresAt, now),
        ),
      ),
  ]);
  return {
    conversations: chats.n,
    knowledgeSources: sources.n,
    seats: members.n + invites.n,
  };
}

export type ChatAccess =
  { allowed: true } | { allowed: false; reason: "trial_ended" | "limit" };

/**
 * Whether the AI may answer this workspace's website chats: its trial or plan is live and
 * this month's chats are within the limit. With `notify`, reaching the limit emails the
 * owners, once a month.
 */
export async function chatAllowed(
  workspaceId: string,
  options: { now?: Date; notify?: boolean } = {},
): Promise<ChatAccess> {
  const now = options.now ?? new Date();
  const plan = await planForWorkspace(workspaceId, now);
  if (!plan.active) return { allowed: false, reason: "trial_ended" };
  const usage = await usageOf(workspaceId, now);
  if (usage.conversations <= plan.limits.conversations)
    return { allowed: true };
  if (options.notify)
    await sendLimitEmail(workspaceId, plan.limits.conversations, now);
  return { allowed: false, reason: "limit" };
}

export async function canAddKnowledge(workspaceId: string): Promise<boolean> {
  const [plan, usage] = await Promise.all([
    planForWorkspace(workspaceId),
    usageOf(workspaceId),
  ]);
  return usage.knowledgeSources < plan.limits.knowledgeSources;
}

export async function canAddSeat(workspaceId: string): Promise<boolean> {
  const [plan, usage] = await Promise.all([
    planForWorkspace(workspaceId),
    usageOf(workspaceId),
  ]);
  return usage.seats < plan.limits.seats;
}

async function sendLimitEmail(workspaceId: string, limit: number, now: Date) {
  const month = now.toISOString().slice(0, 7);
  if (
    !(await allowRequest(
      `limit-email:${workspaceId}:${month}`,
      1,
      40 * 86_400,
      now,
    ))
  )
    return;
  const owners = await adminDb
    .select({
      email: profiles.email,
      slug: workspaces.slug,
      name: workspaces.name,
    })
    .from(memberships)
    .innerJoin(profiles, eq(profiles.id, memberships.userId))
    .innerJoin(workspaces, eq(workspaces.id, memberships.workspaceId))
    .where(
      and(
        eq(memberships.workspaceId, workspaceId),
        inArray(memberships.role, ["owner"]),
        sql`${profiles.email} <> ''`,
      ),
    );
  for (const owner of owners) {
    const link = `${getServerEnv().NEXT_PUBLIC_SITE_URL}/w/${owner.slug}/billing`;
    await sendEmail({
      workspaceId,
      kind: "limit",
      to: owner.email,
      subject: `${owner.name} has reached its chat limit for this month`,
      text: `Your receptionist has had ${limit} website chats this month, the limit on your plan. Until next month, visitors can leave their details instead of chatting with the AI.\n\nUpgrade your plan: ${link}`,
      html: `<p>Your receptionist has had ${limit} website chats this month, the limit on your plan. Until next month, visitors can leave their details instead of chatting with the AI.</p><p><a href="${link}">Upgrade your plan</a></p>`,
    });
  }
}

/** The workspace's Stripe subscription, if it ever had one. */
export async function subscriptionOf(workspaceId: string) {
  const [row] = await adminDb
    .select({
      status: subscriptions.status,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
    })
    .from(subscriptions)
    .where(eq(subscriptions.workspaceId, workspaceId));
  return row ?? null;
}
