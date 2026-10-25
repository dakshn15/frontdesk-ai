import { z } from "zod";

export const customerSchema = z.object({
  name: z
    .string({ error: "Add the customer's name." })
    .trim()
    .min(1, { error: "Add the customer's name." })
    .max(120, { error: "Use 120 characters or fewer." }),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: "Enter an email like name@example.com." })),
  phone: z
    .string()
    .trim()
    .max(40, { error: "Use 40 characters or fewer." })
    .default(""),
});

export type CustomerInput = z.output<typeof customerSchema>;

/** An instant sent from a slot button: an ISO date-time in UTC. */
export const instantSchema = z.iso
  .datetime({ error: "Pick a time." })
  .transform((value) => new Date(value));

export const staffChoiceSchema = z.union([z.literal("any"), z.uuid()], {
  error: "Pick a staff member.",
});

export const newBookingSchema = z.object({
  serviceId: z.uuid({ error: "Pick a service." }),
  staffId: staffChoiceSchema,
  startsAt: instantSchema,
  notes: z
    .string()
    .trim()
    .max(500, { error: "Use 500 characters or fewer." })
    .default(""),
});

export const rescheduleSchema = z.object({
  bookingId: z.uuid(),
  staffId: z.uuid({ error: "Pick a staff member." }),
  startsAt: instantSchema,
});
