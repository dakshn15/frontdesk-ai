import "server-only";
import { and, asc, eq, gt, inArray, lt, ne, sql } from "drizzle-orm";
import type { RlsTx } from "@/db";
import { getPgError } from "@/db/errors";
import {
  bookingEvents,
  bookings,
  closedDays,
  customers,
  services,
  staff,
  staffHours,
  staffServices,
  staffTimeOff,
  workspaces,
} from "@/db/schema";
import { rowsToWeek } from "@/features/hours/weekly-hours";
import { addDays, localDate, zonedDateTimeToUtc } from "@/lib/clock";
import { createSecretToken } from "@/lib/secret-token";
import {
  availableSlots,
  type BookingRules,
  occupiedUntil,
  type StaffAvailability,
} from "./availability";
import type { CustomerInput } from "./schemas";

// Booking logic shared by the dashboard (inside withRls, as the signed-in user) and by
// token-holder pages (inside a privileged transaction). Every query filters by workspace.

const PG_EXCLUSION_VIOLATION = "23P01";
const DAY_MS = 86_400_000;

export type SlotOption = { staffId: string; staffName: string; startsAt: Date };
export type WorkspaceRules = { timeZone: string; rules: BookingRules };
type Actor = { actorId: string | null; ignoreWindow: boolean; now: Date };

export async function loadWorkspaceRules(
  tx: RlsTx,
  workspaceId: string,
): Promise<WorkspaceRules | null> {
  const [row] = await tx
    .select({
      timeZone: workspaces.timezone,
      slotStepMinutes: workspaces.slotStepMinutes,
      minNoticeMinutes: workspaces.minNoticeMinutes,
      maxDaysAhead: workspaces.maxDaysAhead,
      cancellationWindowHours: workspaces.cancellationWindowHours,
    })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId));
  if (!row) return null;
  const { timeZone, ...rules } = row;
  return { timeZone, rules };
}

/** The service, the active staff who perform it, and what blocks their time around `date`. */
async function loadDayFacts(
  tx: RlsTx,
  workspaceId: string,
  ws: WorkspaceRules,
  input: { serviceId: string; date: string; excludeBookingId?: string },
) {
  const [service] = await tx
    .select({
      id: services.id,
      name: services.name,
      durationMinutes: services.durationMinutes,
      bufferMinutes: services.bufferMinutes,
      priceCents: services.priceCents,
    })
    .from(services)
    .where(
      and(
        eq(services.id, input.serviceId),
        eq(services.workspaceId, workspaceId),
      ),
    );
  if (!service) return null;

  const people = await tx
    .select({ id: staff.id, name: staff.name })
    .from(staff)
    .innerJoin(
      staffServices,
      and(
        eq(staffServices.staffId, staff.id),
        eq(staffServices.serviceId, service.id),
      ),
    )
    .where(and(eq(staff.workspaceId, workspaceId), eq(staff.active, true)))
    .orderBy(asc(sql`lower(${staff.name})`));
  const ids = people.map((person) => person.id);

  const dayStart = zonedDateTimeToUtc(input.date, "00:00", ws.timeZone);
  const dayEnd = zonedDateTimeToUtc(
    addDays(input.date, 1),
    "00:00",
    ws.timeZone,
  );
  // A day either side catches buffers and time off that cross midnight.
  const from = new Date(dayStart.getTime() - DAY_MS);
  const to = new Date(dayEnd.getTime() + DAY_MS);

  const [hours, timeOff, booked, closed] = ids.length
    ? await Promise.all([
        tx
          .select({
            staffId: staffHours.staffId,
            weekday: staffHours.weekday,
            startMinute: staffHours.startMinute,
            endMinute: staffHours.endMinute,
          })
          .from(staffHours)
          .where(inArray(staffHours.staffId, ids)),
        tx
          .select({
            staffId: staffTimeOff.staffId,
            start: staffTimeOff.startsAt,
            end: staffTimeOff.endsAt,
          })
          .from(staffTimeOff)
          .where(
            and(
              inArray(staffTimeOff.staffId, ids),
              lt(staffTimeOff.startsAt, to),
              gt(staffTimeOff.endsAt, from),
            ),
          ),
        tx
          .select({
            staffId: bookings.staffId,
            start: bookings.startsAt,
            end: bookings.occupiedUntil,
          })
          .from(bookings)
          .where(
            and(
              eq(bookings.workspaceId, workspaceId),
              eq(bookings.status, "confirmed"),
              inArray(bookings.staffId, ids),
              lt(bookings.startsAt, to),
              gt(bookings.occupiedUntil, from),
              input.excludeBookingId
                ? ne(bookings.id, input.excludeBookingId)
                : undefined,
            ),
          ),
        tx
          .select({ id: closedDays.id })
          .from(closedDays)
          .where(
            and(
              eq(closedDays.workspaceId, workspaceId),
              eq(closedDays.date, input.date),
            ),
          ),
      ])
    : [[], [], [], []];

  return {
    service,
    closed: closed.length > 0,
    staff: people.map((person) => {
      const mine = <T extends { staffId: string | null }>(rows: T[]) =>
        rows.filter((row) => row.staffId === person.id);
      const blocked = [...mine(timeOff), ...mine(booked)].map(
        ({ start, end }) => ({ start, end }),
      );
      const availability: StaffAvailability = {
        staffId: person.id,
        hours: rowsToWeek(mine(hours)),
        blocked,
      };
      const dayCount = mine(booked).filter(
        (b) => b.start >= dayStart && b.start < dayEnd,
      ).length;
      return { ...person, availability, dayCount };
    }),
  };
}

type DayFacts = NonNullable<Awaited<ReturnType<typeof loadDayFacts>>>;

function slotsFor(
  facts: DayFacts,
  people: DayFacts["staff"],
  ws: WorkspaceRules,
  date: string,
  actor: Pick<Actor, "ignoreWindow" | "now">,
  length: { durationMinutes: number; bufferMinutes: number } = facts.service,
): SlotOption[] {
  const names = new Map(people.map((person) => [person.id, person.name]));
  return availableSlots({
    date,
    timeZone: ws.timeZone,
    durationMinutes: length.durationMinutes,
    bufferMinutes: length.bufferMinutes,
    staff: people.map((person) => person.availability),
    closedDates: facts.closed ? [date] : [],
    rules: ws.rules,
    now: actor.now,
    ignoreWindow: actor.ignoreWindow,
  }).map((slot) => ({ ...slot, staffName: names.get(slot.staffId) ?? "" }));
}

/** Free start times for a service on a local date, for one person or anyone who does it. */
export async function findSlots(
  tx: RlsTx,
  workspaceId: string,
  input: {
    serviceId: string;
    staffId: string | "any";
    date: string;
    excludeBookingId?: string;
  },
  actor: Pick<Actor, "ignoreWindow" | "now">,
): Promise<SlotOption[]> {
  const ws = await loadWorkspaceRules(tx, workspaceId);
  if (!ws) return [];
  const facts = await loadDayFacts(tx, workspaceId, ws, input);
  if (!facts) return [];
  const people =
    input.staffId === "any"
      ? facts.staff
      : facts.staff.filter((person) => person.id === input.staffId);
  return slotsFor(facts, people, ws, input.date, actor);
}

async function upsertCustomer(
  tx: RlsTx,
  workspaceId: string,
  customer: CustomerInput,
): Promise<string> {
  // One customer per email, stored lower-case whichever path the booking came from.
  const email = customer.email.trim().toLowerCase();
  const [row] = await tx
    .insert(customers)
    .values({ workspaceId, ...customer, email })
    .onConflictDoUpdate({
      target: [customers.workspaceId, customers.email],
      set: {
        name: customer.name,
        phone: customer.phone,
        updatedAt: sql`now()`,
      },
    })
    .returning({ id: customers.id });
  return row.id;
}

/** Runs `fn` in a savepoint and turns an overlap rejection into null. */
async function unlessTaken<T>(
  tx: RlsTx,
  fn: (sp: RlsTx) => Promise<T>,
): Promise<T | null> {
  try {
    return await tx.transaction(fn);
  } catch (err) {
    if (getPgError(err)?.code === PG_EXCLUSION_VIOLATION) return null;
    throw err;
  }
}

export type NewBooking = {
  serviceId: string;
  staffId: string | "any";
  startsAt: Date;
  customer: CustomerInput;
  notes: string;
  /** The website chat it was booked from (a confirmed booking card). */
  conversationId?: string;
};

export type CreateResult =
  | { ok: true; id: string; manageToken: string }
  | { ok: false; error: "slot_taken" | "not_allowed" };

/**
 * Books the slot if it's free. With "any", the least busy qualified person that day gets
 * it; if the database rejects them (someone booked them a moment ago), the next is tried.
 */
export async function insertBooking(
  tx: RlsTx,
  workspaceId: string,
  input: NewBooking,
  actor: Actor & { source: "dashboard" | "customer" | "widget" },
): Promise<CreateResult> {
  const ws = await loadWorkspaceRules(tx, workspaceId);
  if (!ws) return { ok: false, error: "not_allowed" };
  const date = localDate(ws.timeZone, input.startsAt);
  const facts = await loadDayFacts(tx, workspaceId, ws, {
    serviceId: input.serviceId,
    date,
  });
  if (!facts) return { ok: false, error: "not_allowed" };
  const pool =
    input.staffId === "any"
      ? facts.staff
      : facts.staff.filter((person) => person.id === input.staffId);
  if (input.staffId !== "any" && pool.length === 0) {
    return { ok: false, error: "not_allowed" };
  }

  const free = new Set(
    slotsFor(facts, pool, ws, date, actor)
      .filter((slot) => slot.startsAt.getTime() === input.startsAt.getTime())
      .map((slot) => slot.staffId),
  );
  const ordered = pool
    .filter((person) => free.has(person.id))
    .sort((a, b) => a.dayCount - b.dayCount);
  if (ordered.length === 0) return { ok: false, error: "slot_taken" };

  const customerId = await upsertCustomer(tx, workspaceId, input.customer);
  const { token, hash } = createSecretToken();
  const { service } = facts;
  for (const person of ordered) {
    const id = await unlessTaken(tx, async (sp) => {
      const [row] = await sp
        .insert(bookings)
        .values({
          workspaceId,
          customerId,
          staffId: person.id,
          serviceId: service.id,
          serviceName: service.name,
          staffName: person.name,
          durationMinutes: service.durationMinutes,
          bufferMinutes: service.bufferMinutes,
          priceCents: service.priceCents,
          startsAt: input.startsAt,
          endsAt: occupiedUntil(input.startsAt, service.durationMinutes, 0),
          occupiedUntil: occupiedUntil(
            input.startsAt,
            service.durationMinutes,
            service.bufferMinutes,
          ),
          notes: input.notes,
          conversationId: input.conversationId ?? null,
          source: actor.source,
          manageTokenHash: hash,
        })
        .returning({ id: bookings.id });
      await sp.insert(bookingEvents).values({
        workspaceId,
        bookingId: row.id,
        kind: "created",
        actorId: actor.actorId,
      });
      return row.id;
    });
    if (id) return { ok: true, id, manageToken: token };
  }
  return { ok: false, error: "slot_taken" };
}

/** Moves a confirmed booking to another time or person who does the service. */
export async function moveBooking(
  tx: RlsTx,
  workspaceId: string,
  bookingId: string,
  target: { staffId: string; startsAt: Date },
  actor: Actor,
): Promise<"ok" | "slot_taken" | "not_allowed"> {
  const [booking] = await tx
    .select({
      serviceId: bookings.serviceId,
      staffId: bookings.staffId,
      startsAt: bookings.startsAt,
      durationMinutes: bookings.durationMinutes,
      bufferMinutes: bookings.bufferMinutes,
    })
    .from(bookings)
    .where(
      and(
        eq(bookings.id, bookingId),
        eq(bookings.workspaceId, workspaceId),
        eq(bookings.status, "confirmed"),
      ),
    );
  if (!booking?.serviceId) return "not_allowed";
  const ws = await loadWorkspaceRules(tx, workspaceId);
  if (!ws) return "not_allowed";
  const date = localDate(ws.timeZone, target.startsAt);
  const facts = await loadDayFacts(tx, workspaceId, ws, {
    serviceId: booking.serviceId,
    date,
    excludeBookingId: bookingId,
  });
  const person = facts?.staff.find((p) => p.id === target.staffId);
  if (!facts || !person) return "not_allowed";
  // The booking keeps the length it was booked with.
  const free = slotsFor(facts, [person], ws, date, actor, booking).some(
    (slot) => slot.startsAt.getTime() === target.startsAt.getTime(),
  );
  if (!free) return "slot_taken";

  const moved = await unlessTaken(tx, async (sp) => {
    await sp
      .update(bookings)
      .set({
        staffId: person.id,
        staffName: person.name,
        startsAt: target.startsAt,
        endsAt: occupiedUntil(target.startsAt, booking.durationMinutes, 0),
        occupiedUntil: occupiedUntil(
          target.startsAt,
          booking.durationMinutes,
          booking.bufferMinutes,
        ),
        reminderSentAt: null,
        updatedAt: sql`now()`,
      })
      .where(
        and(eq(bookings.id, bookingId), eq(bookings.workspaceId, workspaceId)),
      );
    await sp.insert(bookingEvents).values({
      workspaceId,
      bookingId,
      kind: "rescheduled",
      actorId: actor.actorId,
      details: {
        from: booking.startsAt.toISOString(),
        to: target.startsAt.toISOString(),
        fromStaffId: booking.staffId,
        toStaffId: person.id,
      },
    });
    return true;
  });
  return moved ? "ok" : "slot_taken";
}

/** Cancels a confirmed booking, freeing its time. */
export async function cancelBooking(
  tx: RlsTx,
  workspaceId: string,
  bookingId: string,
  actorId: string | null,
): Promise<"ok" | "not_allowed"> {
  const cancelled = await tx
    .update(bookings)
    .set({
      status: "cancelled",
      cancelledAt: sql`now()`,
      updatedAt: sql`now()`,
    })
    .where(
      and(
        eq(bookings.id, bookingId),
        eq(bookings.workspaceId, workspaceId),
        eq(bookings.status, "confirmed"),
      ),
    )
    .returning({ id: bookings.id });
  if (cancelled.length === 0) return "not_allowed";
  await tx
    .insert(bookingEvents)
    .values({ workspaceId, bookingId, kind: "cancelled", actorId });
  return "ok";
}

/** Marks how an appointment went. Cancelled bookings stay cancelled. */
export async function setBookingStatus(
  tx: RlsTx,
  workspaceId: string,
  bookingId: string,
  status: "completed" | "no_show",
  actorId: string | null,
): Promise<"ok" | "not_allowed"> {
  const updated = await tx
    .update(bookings)
    .set({ status, updatedAt: sql`now()` })
    .where(
      and(
        eq(bookings.id, bookingId),
        eq(bookings.workspaceId, workspaceId),
        inArray(bookings.status, ["confirmed", "completed", "no_show"]),
      ),
    )
    .returning({ id: bookings.id });
  if (updated.length === 0) return "not_allowed";
  await tx
    .insert(bookingEvents)
    .values({ workspaceId, bookingId, kind: status, actorId });
  return "ok";
}
