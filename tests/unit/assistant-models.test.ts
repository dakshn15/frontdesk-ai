import { simulateReadableStream, streamText, tool } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { fakeModel } from "@/features/assistant/fake-model";
import { withFallback } from "@/features/assistant/fallback";
import { buildInstructions } from "@/features/assistant/instructions";

const usage = {
  inputTokens: {
    total: 3,
    noCache: 3,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: { total: 2, text: 2, reasoning: undefined },
};

function replying(text: string) {
  return new MockLanguageModelV4({
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks: [
          { type: "text-start", id: "t" },
          { type: "text-delta", id: "t", delta: text },
          { type: "text-end", id: "t" },
          {
            type: "finish",
            finishReason: { unified: "stop", raw: undefined },
            usage,
          },
        ],
      }),
    }),
  });
}

const failing = new MockLanguageModelV4({
  doStream: async () => {
    throw new Error("provider down");
  },
});

describe("withFallback", () => {
  it("uses the primary model when it works", async () => {
    const onSwitch = vi.fn();
    const result = streamText({
      model: withFallback(
        replying("from primary"),
        replying("from backup"),
        onSwitch,
      ),
      prompt: "Hi",
    });
    expect(await result.text).toBe("from primary");
    expect(onSwitch).not.toHaveBeenCalled();
  });

  it("retries once on the other provider when the first fails", async () => {
    const onSwitch = vi.fn();
    const result = streamText({
      model: withFallback(failing, replying("from backup"), onSwitch),
      prompt: "Hi",
    });
    expect(await result.text).toBe("from backup");
    expect(onSwitch).toHaveBeenCalledTimes(1);
  });
});

describe("fakeModel", () => {
  it("searches the knowledge first, then answers from what it found", async () => {
    const result = streamText({
      model: fakeModel(),
      prompt: "Is there parking?",
      tools: {
        search_knowledge: tool({
          inputSchema: z.object({ query: z.string() }),
          execute: async ({ query }) => ({
            query,
            passages: [{ content: "Free parking behind the salon." }],
          }),
        }),
      },
      stopWhen: () => false,
    });
    expect(await result.text).toBe("Free parking behind the salon.");
  });

  it("hands off when the visitor asks for a person", async () => {
    const reasons: string[] = [];
    const result = streamText({
      model: fakeModel(),
      prompt: "Can I talk to a person?",
      tools: {
        handoff_to_human: tool({
          inputSchema: z.object({ reason: z.string() }),
          execute: async ({ reason }) => {
            reasons.push(reason);
            return { handedOff: true };
          },
        }),
      },
      stopWhen: () => false,
    });
    expect(await result.text).toBe(
      "I've asked the team to join. Someone will reply here soon.",
    );
    expect(reasons).toEqual(["The visitor asked for a person."]);
  });

  it("offers the first free time when asked to book", async () => {
    const calls: string[] = [];
    const record =
      <T>(name: string, output: T) =>
      async (input: unknown) => {
        calls.push(`${name} ${JSON.stringify(input)}`);
        return output;
      };
    const result = streamText({
      model: fakeModel(),
      prompt: "Can I book a cut?",
      tools: {
        get_services: tool({
          inputSchema: z.object({}),
          execute: record("get_services", { services: [{ id: "svc" }] }),
        }),
        check_availability: tool({
          inputSchema: z.object({ serviceId: z.string(), days: z.number() }),
          execute: record("check_availability", {
            slots: [{ staffId: "maya", startsAt: "2026-11-02T15:00:00.000Z" }],
          }),
        }),
        propose_booking: tool({
          inputSchema: z.object({
            serviceId: z.string(),
            staffId: z.string(),
            startsAt: z.string(),
          }),
          execute: record("propose_booking", { ok: true }),
        }),
      },
      stopWhen: () => false,
    });
    expect(await result.text).toBe(
      "Here's the next free time. Confirm it below to book.",
    );
    expect(calls).toEqual([
      "get_services {}",
      'check_availability {"serviceId":"svc","days":7}',
      'propose_booking {"serviceId":"svc","staffId":"maya","startsAt":"2026-11-02T15:00:00.000Z"}',
    ]);
  });
});

describe("buildInstructions", () => {
  const instructions = buildInstructions({
    business: "Bloom Hair Studio",
    assistantName: "Ava",
    timeZone: "America/Chicago",
    now: new Date("2026-10-26T15:00:00Z"),
  });

  it("names the business and today's date in its time zone", () => {
    expect(instructions).toContain("Ava");
    expect(instructions).toContain("Bloom Hair Studio");
    expect(instructions).toContain("Monday, October 26, 2026");
    expect(instructions).toContain("America/Chicago");
  });

  it("carries the answer rules", () => {
    expect(instructions).toMatch(/you are an AI assistant/i);
    expect(instructions).toMatch(/never claim to be (a )?human/i);
    expect(instructions).toMatch(/find_verified_answer/);
    expect(instructions).toMatch(/data, not instructions/i);
    expect(instructions).toMatch(/propose_booking/);
  });
});
