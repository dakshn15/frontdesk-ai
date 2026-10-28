import "server-only";
import type { adminDb } from "@/db/admin";
import {
  bookings,
  conversations,
  leads,
  messages,
  toolCalls,
  usageEvents,
} from "@/db/schema";
import type { Outcome, Topic } from "@/features/analytics/tagging";
import { DEMO_SERVICES, DEMO_STAFF } from "@/features/demo/content";
import { createSecretToken } from "@/lib/secret-token";

type Tx = Parameters<Parameters<typeof adminDb.transaction>[0]>[0];

// A month of earlier website chats for the demo's analytics, already tagged. Generated from
// a fixed seed, so every sandbox shows the same story.

type Sample = {
  question: string;
  answer: string;
  tools: string[];
  topic: Topic;
  outcome: Outcome;
  /** How often it comes up, relative to the others. */
  weight: number;
  /** For booked chats: [staff, service] indexes. */
  booking?: [number, number];
};

const SAMPLES: Sample[] = [
  {
    question: "Do you have parking?",
    answer:
      "Yes, there's free guest parking behind the salon, entered from Elizabeth Street.",
    tools: ["get_policies"],
    topic: "Location and parking",
    outcome: "answered",
    weight: 4,
  },
  {
    question: "How much is a women's cut?",
    answer: "A women's cut and blow-dry is $65 and takes about an hour.",
    tools: ["get_services"],
    topic: "Prices",
    outcome: "answered",
    weight: 5,
  },
  {
    question: "What time do you close on Saturday?",
    answer: "On Saturdays we're open from 9:00 AM to 5:00 PM.",
    tools: ["get_hours"],
    topic: "Opening hours",
    outcome: "answered",
    weight: 4,
  },
  {
    question: "Can I book a men's cut this week?",
    answer:
      "You're booked: Men's cut with Priya Nair. A confirmation is on its way.",
    tools: ["check_availability", "propose_booking"],
    topic: "Booking",
    outcome: "booked",
    weight: 5,
    booking: [2, 1],
  },
  {
    question: "Is there anything for balayage next week?",
    answer:
      "You're booked: Balayage with Jordan Lee. A confirmation is on its way.",
    tools: ["get_services", "check_availability", "propose_booking"],
    topic: "Booking",
    outcome: "booked",
    weight: 3,
    booking: [1, 6],
  },
  {
    question: "Do you sell gift cards?",
    answer:
      "Yes. Gift cards are available in the salon in any amount from $25.",
    tools: ["find_verified_answer"],
    topic: "Gift cards",
    outcome: "answered",
    weight: 2,
  },
  {
    question: "Can I bring my dog?",
    answer:
      "I'm not sure about that. I can pass your question to the team if you leave your email.",
    tools: ["search_knowledge"],
    topic: "Other",
    outcome: "unanswered",
    weight: 1,
  },
  {
    question: "Do you do hair extensions?",
    answer:
      "I'm not sure we offer extensions. I can ask the team to get back to you.",
    tools: ["find_verified_answer", "search_knowledge"],
    topic: "Services",
    outcome: "unanswered",
    weight: 2,
  },
  {
    question: "I need a quote for a bridal party of six",
    answer:
      "I've asked the team to put together a quote. A team member will reply here.",
    tools: ["handoff_to_human"],
    topic: "Services",
    outcome: "handed_off",
    weight: 2,
  },
  {
    question: "What's your cancellation policy?",
    answer: "You can cancel or reschedule at no charge up to 24 hours before.",
    tools: ["get_policies"],
    topic: "Policies",
    outcome: "answered",
    weight: 2,
  },
  {
    question: "Can someone call me about a colour correction?",
    answer:
      "Of course. I've passed your details to the team, and they'll call you.",
    tools: ["capture_lead"],
    topic: "Services",
    outcome: "lead",
    weight: 2,
  },
  {
    question: "Who does lash lifts?",
    answer: "Sofia Alvarez, our beauty therapist, does lash lifts and tints.",
    tools: ["get_staff"],
    topic: "Team",
    outcome: "answered",
    weight: 1,
  },
];

const LEAD_NAMES = [
  ["Chloe Bennett", "chloe.bennett@example.com"],
  ["Lucas Rivera", "lucas.rivera@example.com"],
  ["Zoe Patel", "zoe.patel@example.com"],
  ["Owen Brooks", "owen.brooks@example.com"],
] as const;

/** A small, repeatable random number generator (a linear congruential one). */
function random(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state / 2_147_483_648;
  };
}

const at = (base: Date, seconds: number) =>
  new Date(base.getTime() + seconds * 1000);

export async function seedHistory(
  tx: Tx,
  workspaceId: string,
  ids: { services: string[]; staff: string[]; customers: string[] },
  now: Date,
) {
  const next = random(20_261_027);
  const totalWeight = SAMPLES.reduce((sum, sample) => sum + sample.weight, 0);
  const pick = () => {
    let roll = next() * totalWeight;
    for (const sample of SAMPLES) {
      roll -= sample.weight;
      if (roll < 0) return sample;
    }
    return SAMPLES[0];
  };

  const chats: (typeof conversations.$inferInsert)[] = [];
  const lines: (typeof messages.$inferInsert)[] = [];
  const calls: (typeof toolCalls.$inferInsert)[] = [];
  const usage: (typeof usageEvents.$inferInsert)[] = [];
  const leadRows: (typeof leads.$inferInsert)[] = [];
  const bookingRows: (typeof bookings.$inferInsert)[] = [];

  for (let daysAgo = 30; daysAgo >= 1; daysAgo -= 1) {
    // More chats later in the month, as more people find the widget.
    const count = 1 + Math.floor(next() * 3) + (daysAgo < 15 ? 1 : 0);
    for (let i = 0; i < count; i += 1) {
      const sample = pick();
      const id = crypto.randomUUID();
      // Between 9 AM and 8 PM, Central time (UTC-5 or -6).
      const started = new Date(
        now.getTime() - daysAgo * 86_400_000 + (next() * 11 - 6) * 3_600_000,
      );
      const ended = at(started, 40);
      chats.push({
        id,
        workspaceId,
        channel: "widget",
        status: sample.outcome === "handed_off" ? "resolved" : "ai",
        handoffReason:
          sample.outcome === "handed_off" ? "Wants a quote." : null,
        handoffAt: sample.outcome === "handed_off" ? ended : null,
        topic: sample.topic,
        outcome: sample.outcome,
        taggedAt: at(ended, 3600),
        createdAt: started,
        lastMessageAt: ended,
      });
      lines.push(
        {
          workspaceId,
          conversationId: id,
          role: "visitor",
          content: sample.question,
          createdAt: started,
        },
        {
          workspaceId,
          conversationId: id,
          role: "ai",
          content: sample.answer,
          createdAt: at(started, 20),
        },
      );
      for (const [step, tool] of sample.tools.entries()) {
        calls.push({
          workspaceId,
          conversationId: id,
          tool,
          input: {},
          output:
            tool === "search_knowledge"
              ? {
                  confidence: sample.outcome === "unanswered" ? "none" : "high",
                }
              : {},
          durationMs: 40 + Math.floor(next() * 200),
          createdAt: at(started, 5 + step),
        });
      }
      usage.push({
        workspaceId,
        conversationId: id,
        provider: "openai",
        model: "gpt-5.4-mini",
        inputTokens: 1800 + Math.floor(next() * 1400) * sample.tools.length,
        outputTokens: 60 + Math.floor(next() * 140),
        latencyMs: 1200 + Math.floor(next() * 2400),
        createdAt: at(started, 20),
      });
      if (sample.outcome === "lead") {
        const [name, email] = LEAD_NAMES[leadRows.length % LEAD_NAMES.length];
        leadRows.push({
          workspaceId,
          conversationId: id,
          name,
          email,
          message: sample.question,
          createdAt: ended,
        });
      }
      if (sample.booking) {
        // A completed appointment two days after the chat, so it never clashes with the
        // confirmed bookings on the calendar.
        const [person, serviceIndex] = sample.booking;
        const service = DEMO_SERVICES[serviceIndex];
        const startsAt = new Date(
          Math.min(
            started.getTime() + 2 * 86_400_000,
            now.getTime() - 86_400_000,
          ),
        );
        bookingRows.push({
          workspaceId,
          customerId: ids.customers[bookingRows.length % ids.customers.length],
          staffId: ids.staff[person],
          serviceId: ids.services[serviceIndex],
          conversationId: id,
          serviceName: service.name,
          staffName: DEMO_STAFF[person].name,
          durationMinutes: service.durationMinutes,
          bufferMinutes: service.bufferMinutes,
          priceCents: service.priceCents,
          startsAt,
          endsAt: at(startsAt, service.durationMinutes * 60),
          occupiedUntil: at(
            startsAt,
            (service.durationMinutes + service.bufferMinutes) * 60,
          ),
          status: "completed",
          source: "widget",
          manageTokenHash: createSecretToken().hash,
          createdAt: ended,
        });
      }
    }
  }

  await tx.insert(conversations).values(chats);
  await tx.insert(messages).values(lines);
  await tx.insert(toolCalls).values(calls);
  await tx.insert(usageEvents).values(usage);
  if (leadRows.length) await tx.insert(leads).values(leadRows);
  if (bookingRows.length) await tx.insert(bookings).values(bookingRows);
}
