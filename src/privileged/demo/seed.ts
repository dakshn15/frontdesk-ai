import "server-only";
import { randomBytes } from "node:crypto";
import { adminDb } from "@/db/admin";
import {
  bookingEvents,
  bookings,
  businessHours,
  closedDays,
  conversations,
  customers,
  emailLog,
  knowledgeChunks,
  knowledgeSources,
  leads,
  memberships,
  messages,
  policies,
  services,
  staff,
  staffHours,
  staffServices,
  testCases,
  toolCalls,
  verifiedAnswers,
  workspaces,
} from "@/db/schema";
import {
  DEMO_ANSWERS,
  DEMO_BUSINESS,
  DEMO_CLOSED_DAYS,
  DEMO_CONVERSATIONS,
  DEMO_CUSTOMERS,
  DEMO_DAY_PATTERNS,
  DEMO_KNOWLEDGE,
  DEMO_LEADS,
  DEMO_OPENING_HOURS,
  DEMO_POLICIES,
  DEMO_SERVICES,
  DEMO_STAFF,
  DEMO_TESTS,
} from "@/features/demo/content";
import { formatAppointment, timeZoneLabel } from "@/features/bookings/format";
import { chunkText } from "@/features/knowledge/chunk";
import {
  addDays,
  isoWeekday,
  localDate,
  minutesToClock,
  zonedDateTimeToUtc,
} from "@/lib/clock";
import { createSecretToken } from "@/lib/secret-token";
import { bookingEmailContent } from "../booking-emails";
import { seedHistory } from "./history";
import type { Source } from "../assistant/tools";

type Tx = Parameters<Parameters<typeof adminDb.transaction>[0]>[0];

// Rows inserted together share a timestamp; a millisecond apart, lists keep the salon's order.
const inOrder = (now: Date, index: number) => new Date(now.getTime() + index);

const minutesAfter = (at: Date, minutes: number) =>
  new Date(at.getTime() + minutes * 60_000);

/** Bookings from three days ago to a week ahead, in the salon's daily patterns. */
async function seedBookings(
  tx: Tx,
  workspaceId: string,
  ids: { services: string[]; staff: string[]; customers: string[] },
  now: Date,
) {
  const tz = DEMO_BUSINESS.timezone;
  const today = localDate(tz, now);
  const closed = new Set(DEMO_CLOSED_DAYS.map((day) => day.date));
  const rows: (typeof bookings.$inferInsert)[] = [];
  let openDay = 0;
  for (let offset = -3; offset <= 7; offset += 1) {
    const date = addDays(today, offset);
    const weekday = isoWeekday(date);
    if (closed.has(date)) continue;
    if (!DEMO_OPENING_HOURS.some((hours) => hours.weekday === weekday))
      continue;
    const pattern = DEMO_DAY_PATTERNS[openDay % DEMO_DAY_PATTERNS.length];
    openDay += 1;
    for (const [person, minute, serviceIndex, customerIndex] of pattern) {
      const member = DEMO_STAFF[person];
      const service = DEMO_SERVICES[serviceIndex];
      const works = member.hours.some(
        (hours) =>
          hours.weekday === weekday &&
          hours.startMinute <= minute &&
          minute + service.durationMinutes <= hours.endMinute,
      );
      if (!works) continue;
      const startsAt = zonedDateTimeToUtc(date, minutesToClock(minute), tz);
      rows.push({
        workspaceId,
        customerId: ids.customers[customerIndex],
        staffId: ids.staff[person],
        serviceId: ids.services[serviceIndex],
        serviceName: service.name,
        staffName: member.name,
        durationMinutes: service.durationMinutes,
        bufferMinutes: service.bufferMinutes,
        priceCents: service.priceCents,
        startsAt,
        endsAt: minutesAfter(startsAt, service.durationMinutes),
        occupiedUntil: minutesAfter(
          startsAt,
          service.durationMinutes + service.bufferMinutes,
        ),
        status: startsAt < now ? "completed" : "confirmed",
        source: rows.length % 3 === 0 ? "widget" : "dashboard",
        manageTokenHash: createSecretToken().hash,
      });
    }
  }
  if (rows.length === 0) return;
  const inserted = await tx
    .insert(bookings)
    .values(rows)
    .returning({ id: bookings.id });
  await tx.insert(bookingEvents).values(
    inserted.map((booking) => ({
      workspaceId,
      bookingId: booking.id,
      kind: "created",
    })),
  );

  // The outbox shows the confirmations for the next few bookings.
  const upcoming = rows
    .map((row, index) => ({ row, id: inserted[index].id }))
    .filter(({ row }) => row.status === "confirmed")
    .slice(0, 6);
  await tx.insert(emailLog).values(
    upcoming.map(({ row, id }) => {
      const customer = DEMO_CUSTOMERS[ids.customers.indexOf(row.customerId!)];
      const content = bookingEmailContent("confirmed", {
        business: DEMO_BUSINESS.name,
        customerName: customer.name,
        serviceName: row.serviceName,
        staffName: row.staffName,
        when: `${formatAppointment(row.startsAt, tz)} (${timeZoneLabel(tz)})`,
      });
      return {
        workspaceId,
        bookingId: id,
        kind: "booking_confirmed",
        toEmail: customer.email,
        ...content,
        status: "not_sent",
      };
    }),
  );
}

/** The sample chats for the inbox, with the tools used and the sources behind answers. */
async function seedConversations(
  tx: Tx,
  workspaceId: string,
  sourceFor: (title: string) => Source | undefined,
  now: Date,
) {
  for (const sample of DEMO_CONVERSATIONS) {
    const started = minutesAfter(now, -sample.minutesAgo);
    const at = (step: number) => new Date(started.getTime() + step * 20_000);
    const lastStep = sample.turns.length - 1;
    const [conversation] = await tx
      .insert(conversations)
      .values({
        workspaceId,
        channel: "widget",
        status: sample.status,
        handoffReason: sample.handoffReason ?? null,
        handoffAt: sample.status === "needs_human" ? at(lastStep) : null,
        createdAt: started,
        lastMessageAt: at(lastStep),
      })
      .returning({ id: conversations.id });
    for (const [step, turn] of sample.turns.entries()) {
      if ("tool" in turn) {
        await tx.insert(toolCalls).values({
          workspaceId,
          conversationId: conversation.id,
          tool: turn.tool,
          input: turn.input,
          output: {},
          durationMs: 40 + step * 15,
          createdAt: at(step),
        });
        continue;
      }
      const source = turn.source ? sourceFor(turn.source) : undefined;
      await tx.insert(messages).values({
        workspaceId,
        conversationId: conversation.id,
        role: turn.role,
        content: turn.content,
        sources: source ? [source] : [],
        createdAt: at(step),
      });
    }
    if (sample.lead) {
      await tx.insert(leads).values({
        workspaceId,
        conversationId: conversation.id,
        ...sample.lead,
        createdAt: at(lastStep),
      });
    }
  }
}

/**
 * A fresh copy of Bloom Hair & Beauty owned by `userId`, deleted after `expiresAt`.
 * Everything is scoped to the new workspace and written in one transaction.
 */
export async function seedDemoWorkspace(
  userId: string,
  expiresAt: Date,
  now = new Date(),
): Promise<{ id: string; slug: string }> {
  const slug = `bloom-${randomBytes(5).toString("hex")}`;
  return adminDb.transaction(async (tx) => {
    const [workspace] = await tx
      .insert(workspaces)
      .values({
        name: DEMO_BUSINESS.name,
        slug,
        timezone: DEMO_BUSINESS.timezone,
        currency: DEMO_BUSINESS.currency,
        assistantName: DEMO_BUSINESS.assistantName,
        widgetColor: DEMO_BUSINESS.color,
        widgetGreeting: DEMO_BUSINESS.greeting,
        widgetSuggestions: [...DEMO_BUSINESS.suggestions],
        demoExpiresAt: expiresAt,
        createdBy: userId,
      })
      .returning({ id: workspaces.id });
    const workspaceId = workspace.id;
    await tx.insert(memberships).values({ workspaceId, userId, role: "owner" });

    const serviceIds = (
      await tx
        .insert(services)
        .values(
          DEMO_SERVICES.map((service, index) => ({
            workspaceId,
            ...service,
            createdAt: inOrder(now, index),
          })),
        )
        .returning({ id: services.id })
    ).map((row) => row.id);
    const staffIds = (
      await tx
        .insert(staff)
        .values(
          DEMO_STAFF.map(({ name, title, bio }, index) => ({
            workspaceId,
            name,
            title,
            bio,
            createdAt: inOrder(now, index),
          })),
        )
        .returning({ id: staff.id })
    ).map((row) => row.id);
    await tx.insert(staffServices).values(
      DEMO_STAFF.flatMap((member, index) =>
        member.services.map((serviceIndex) => ({
          workspaceId,
          staffId: staffIds[index],
          serviceId: serviceIds[serviceIndex],
        })),
      ),
    );
    await tx.insert(staffHours).values(
      DEMO_STAFF.flatMap((member, index) =>
        member.hours.map((hours) => ({
          workspaceId,
          staffId: staffIds[index],
          ...hours,
        })),
      ),
    );
    await tx
      .insert(businessHours)
      .values(DEMO_OPENING_HOURS.map((hours) => ({ workspaceId, ...hours })));
    const today = localDate(DEMO_BUSINESS.timezone, now);
    const upcomingClosed = DEMO_CLOSED_DAYS.filter((day) => day.date >= today);
    if (upcomingClosed.length > 0) {
      await tx
        .insert(closedDays)
        .values(upcomingClosed.map((day) => ({ workspaceId, ...day })));
    }

    const policyRows = await tx
      .insert(policies)
      .values(DEMO_POLICIES.map((policy) => ({ workspaceId, ...policy })))
      .returning({ id: policies.id, title: policies.title });
    const answerRows = await tx
      .insert(verifiedAnswers)
      .values(
        DEMO_ANSWERS.map((answer) => ({
          workspaceId,
          ...answer,
          createdBy: userId,
          updatedBy: userId,
        })),
      )
      .returning({
        id: verifiedAnswers.id,
        question: verifiedAnswers.question,
      });

    await tx.insert(testCases).values(
      DEMO_TESTS.map((test, index) => ({
        workspaceId,
        ...test,
        createdBy: userId,
        createdAt: inOrder(now, index),
      })),
    );

    const passages: Source[] = [];
    for (const document of DEMO_KNOWLEDGE) {
      const chunks = chunkText(document.content);
      const [source] = await tx
        .insert(knowledgeSources)
        .values({
          workspaceId,
          kind: "text",
          title: document.title,
          content: document.content,
          status: "ready",
          pageCount: 1,
          chunkCount: chunks.length,
          syncedAt: now,
          createdBy: userId,
        })
        .returning({ id: knowledgeSources.id });
      const inserted = await tx
        .insert(knowledgeChunks)
        .values(
          chunks.map((chunk, position) => ({
            workspaceId,
            sourceId: source.id,
            position,
            heading: chunk.heading,
            content: chunk.content,
          })),
        )
        .returning({
          id: knowledgeChunks.id,
          heading: knowledgeChunks.heading,
        });
      for (const chunk of inserted) {
        passages.push({
          kind: "passage",
          id: chunk.id,
          title: chunk.heading
            ? `${document.title} › ${chunk.heading}`
            : document.title,
          url: null,
        });
      }
    }
    const sources: Source[] = [
      ...answerRows.map((row) => ({
        kind: "answer" as const,
        id: row.id,
        title: row.question,
      })),
      ...policyRows.map((row) => ({
        kind: "policy" as const,
        id: row.id,
        title: row.title,
      })),
      ...passages,
    ];

    const customerIds = (
      await tx
        .insert(customers)
        .values(
          DEMO_CUSTOMERS.map((customer) => ({ workspaceId, ...customer })),
        )
        .returning({ id: customers.id })
    ).map((row) => row.id);
    await seedBookings(
      tx,
      workspaceId,
      { services: serviceIds, staff: staffIds, customers: customerIds },
      now,
    );
    await seedConversations(
      tx,
      workspaceId,
      (title) => sources.find((source) => source.title === title),
      now,
    );
    await seedHistory(
      tx,
      workspaceId,
      { services: serviceIds, staff: staffIds, customers: customerIds },
      now,
    );
    await tx.insert(leads).values(
      DEMO_LEADS.map((lead) => ({
        workspaceId,
        ...lead,
        createdAt: minutesAfter(now, -60 * 26),
      })),
    );
    return { id: workspaceId, slug };
  });
}
