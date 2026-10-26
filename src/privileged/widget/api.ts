import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { adminDb } from "@/db/admin";
import {
  bookings,
  conversations,
  leads,
  messages,
  toolCalls,
  workspaces,
} from "@/db/schema";
import { insertBooking } from "@/features/bookings/engine";
import { formatAppointment } from "@/features/bookings/format";
import { customerSchema } from "@/features/bookings/schemas";
import { zodFieldErrors } from "@/lib/validation";
import { saveMessage } from "../assistant/agent";
import { json, readJson, tooMany } from "../assistant/chat-api";
import { sessionFromToken } from "../assistant/sessions";
import { sendBookingEmail } from "../booking-emails";
import { allowRequest } from "../rate-limit";
import { foreignOrigin, fromOtherSite } from "./guard";

// The widget's own endpoints besides chatting: the transcript after a reload, confirming a
// booking card, and leaving contact details. Each one needs the visitor's session token.

export const WIDGET_LIMITS = {
  bookingsPerSession: { limit: 5, windowSeconds: 3600 },
  leadsPerSession: { limit: 5, windowSeconds: 3600 },
} as const;

// The booking form's rules, worded for the visitor filling it in.
const visitorDetails = customerSchema.extend({
  name: z
    .string({ error: "Add your name." })
    .trim()
    .min(1, { error: "Add your name." })
    .max(120, { error: "Use 120 characters or fewer." }),
});

const HISTORY = 50;
const token = z.string().min(1).max(100);
const expired = () =>
  json({ error: "This chat has expired. Reload the page." }, 401);

type Session = { sessionId: string; workspaceId: string };

/** The conversation if it belongs to this visitor's session. */
async function ownConversation(session: Session, conversationId?: string) {
  if (!conversationId) return null;
  const [row] = await adminDb
    .select({ id: conversations.id, status: conversations.status })
    .from(conversations)
    .where(
      and(
        eq(conversations.id, conversationId),
        eq(conversations.workspaceId, session.workspaceId),
        eq(conversations.sessionId, session.sessionId),
      ),
    );
  return row ?? null;
}

/** Parses the body and checks origin and session; a Response when any of that fails. */
async function start<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<Response | { body: z.output<T>; session: Session }> {
  if (foreignOrigin(request)) return fromOtherSite();
  const raw = await readJson(request);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return json({ error: "Check the request." }, 400);
  const session = await sessionFromToken(
    (parsed.data as { token: string }).token,
  );
  if (!session) return expired();
  return { body: parsed.data, session };
}

const historyBody = z.object({ token, conversationId: z.uuid().optional() });

export async function handleHistory(request: Request): Promise<Response> {
  const started = await start(request, historyBody);
  if (started instanceof Response) return started;
  const { body, session } = started;
  const conversation = await ownConversation(session, body.conversationId);
  if (!conversation) return json({ status: "ai", messages: [] });
  const rows = await adminDb
    .select({
      id: messages.id,
      role: messages.role,
      content: messages.content,
      sources: messages.sources,
    })
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversation.id),
        eq(messages.workspaceId, session.workspaceId),
      ),
    )
    .orderBy(desc(messages.createdAt))
    .limit(HISTORY);
  return json({ status: conversation.status, messages: rows.reverse() });
}

const bookBody = z.object({
  token,
  conversationId: z.uuid(),
  serviceId: z.uuid(),
  staffId: z.uuid(),
  startsAt: z.iso.datetime(),
  name: z.unknown().optional(),
  email: z.unknown().optional(),
  phone: z.unknown().optional(),
});

/**
 * Books a time from a card the receptionist showed in this visitor's conversation. A time
 * it never offered is refused, so the chat can't be used to book anything else.
 */
export async function handleBook(request: Request): Promise<Response> {
  const started = await start(request, bookBody);
  if (started instanceof Response) return started;
  const { body, session } = started;
  const customer = visitorDetails.safeParse({
    name: body.name,
    email: body.email,
    phone: body.phone ?? "",
  });
  if (!customer.success) {
    return json(
      {
        error: "Check your details.",
        fieldErrors: zodFieldErrors(customer.error),
      },
      400,
    );
  }
  const { limit, windowSeconds } = WIDGET_LIMITS.bookingsPerSession;
  if (
    !(await allowRequest(
      `widget-book:session:${session.sessionId}`,
      limit,
      windowSeconds,
    ))
  ) {
    return tooMany();
  }

  const conversation = await ownConversation(session, body.conversationId);
  const startsAt = new Date(body.startsAt);
  const [offer] = conversation
    ? await adminDb
        .select({ id: toolCalls.id })
        .from(toolCalls)
        .where(
          and(
            eq(toolCalls.conversationId, conversation.id),
            eq(toolCalls.workspaceId, session.workspaceId),
            eq(toolCalls.tool, "propose_booking"),
            sql`${toolCalls.input}->>'serviceId' = ${body.serviceId}`,
            sql`${toolCalls.input}->>'staffId' = ${body.staffId}`,
            sql`(${toolCalls.input}->>'startsAt')::timestamptz = ${startsAt.toISOString()}::timestamptz`,
            sql`${toolCalls.output}->>'ok' = 'true'`,
          ),
        )
        .limit(1)
    : [];
  if (!conversation || !offer) {
    return json({ error: "That booking wasn't offered in this chat." }, 400);
  }

  const result = await adminDb.transaction((tx) =>
    insertBooking(
      tx,
      session.workspaceId,
      {
        serviceId: body.serviceId,
        staffId: body.staffId,
        startsAt,
        customer: customer.data,
        notes: "",
      },
      { actorId: null, ignoreWindow: false, now: new Date(), source: "widget" },
    ),
  );
  if (!result.ok) {
    return result.error === "slot_taken"
      ? json({ error: "That time was just taken. Ask for another time." }, 409)
      : json({ error: "That time can't be booked any more." }, 400);
  }
  await sendBookingEmail({
    bookingId: result.id,
    kind: "confirmed",
    manageToken: result.manageToken,
  });

  const [booked] = await adminDb
    .select({
      serviceName: bookings.serviceName,
      staffName: bookings.staffName,
      timeZone: workspaces.timezone,
    })
    .from(bookings)
    .innerJoin(workspaces, eq(workspaces.id, bookings.workspaceId))
    .where(eq(bookings.id, result.id));
  const message = `You're booked: ${booked.serviceName} with ${booked.staffName}, ${formatAppointment(startsAt, booked.timeZone)}. A confirmation is on its way to ${customer.data.email}.`;
  await saveMessage(session.workspaceId, conversation.id, "ai", message);
  return json({ ok: true, message });
}

const leadBody = z.object({
  token,
  conversationId: z.uuid().optional(),
  name: z.unknown().optional(),
  email: z.unknown().optional(),
  phone: z.unknown().optional(),
  message: z.unknown().optional(),
});

const leadDetails = visitorDetails.extend({
  message: z
    .string()
    .trim()
    .max(1000, { error: "Use 1,000 characters or fewer." })
    .default(""),
});

/** The visitor's contact details, so the team can get back to them. */
export async function handleLead(request: Request): Promise<Response> {
  const started = await start(request, leadBody);
  if (started instanceof Response) return started;
  const { body, session } = started;
  const details = leadDetails.safeParse({
    name: body.name,
    email: body.email,
    phone: body.phone ?? "",
    message: body.message ?? "",
  });
  if (!details.success) {
    return json(
      {
        error: "Check your details.",
        fieldErrors: zodFieldErrors(details.error),
      },
      400,
    );
  }
  const { limit, windowSeconds } = WIDGET_LIMITS.leadsPerSession;
  if (
    !(await allowRequest(
      `widget-lead:session:${session.sessionId}`,
      limit,
      windowSeconds,
    ))
  ) {
    return tooMany();
  }
  const conversation = await ownConversation(session, body.conversationId);
  await adminDb.insert(leads).values({
    workspaceId: session.workspaceId,
    conversationId: conversation?.id ?? null,
    ...details.data,
  });
  return json({ ok: true });
}
