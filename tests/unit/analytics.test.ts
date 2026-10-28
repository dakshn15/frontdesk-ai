import { describe, expect, it } from "vitest";
import { costOf, formatUsd } from "@/features/analytics/prices";
import { outcomeFor, topicFor } from "@/features/analytics/tagging";

describe("costOf", () => {
  it("prices tokens per million, by model", () => {
    expect(costOf("gpt-5.4-mini", 1_000_000, 1_000_000)).toBeCloseTo(5.25);
    expect(costOf("gemini-3.5-flash", 2000, 500)).toBeCloseTo(0.0075);
  });

  it("costs nothing for the scripted test model or an unknown one", () => {
    expect(costOf("scripted", 5000, 5000)).toBe(0);
    expect(costOf("mystery-model", 5000, 5000)).toBe(0);
  });
});

describe("formatUsd", () => {
  it("shows cents, and small amounts as under a cent", () => {
    expect(formatUsd(0)).toBe("$0.00");
    expect(formatUsd(0.004)).toBe("under $0.01");
    expect(formatUsd(1.234)).toBe("$1.23");
  });
});

describe("topicFor", () => {
  it("uses the tools first, then the visitor's words", () => {
    expect(topicFor({ tools: ["check_availability"], text: "hi" })).toBe(
      "Booking",
    );
    expect(topicFor({ tools: [], text: "Can I book a cut on Friday?" })).toBe(
      "Booking",
    );
    expect(topicFor({ tools: [], text: "How much is balayage?" })).toBe(
      "Prices",
    );
    expect(topicFor({ tools: ["get_hours"], text: "Sunday?" })).toBe(
      "Opening hours",
    );
    expect(topicFor({ tools: [], text: "Is there parking?" })).toBe(
      "Location and parking",
    );
    expect(topicFor({ tools: [], text: "Do you sell gift cards?" })).toBe(
      "Gift cards",
    );
    expect(topicFor({ tools: ["get_policies"], text: "late" })).toBe(
      "Policies",
    );
    expect(topicFor({ tools: [], text: "Do you do hair extensions?" })).toBe(
      "Services",
    );
    expect(topicFor({ tools: [], text: "hello" })).toBe("Other");
  });
});

describe("outcomeFor", () => {
  const none = {
    booked: false,
    lead: false,
    handedOff: false,
    unanswered: false,
  };

  it("picks the strongest result", () => {
    expect(outcomeFor({ ...none, booked: true, lead: true })).toBe("booked");
    expect(outcomeFor({ ...none, lead: true, handedOff: true })).toBe("lead");
    expect(outcomeFor({ ...none, handedOff: true, unanswered: true })).toBe(
      "handed_off",
    );
    expect(outcomeFor({ ...none, unanswered: true })).toBe("unanswered");
    expect(outcomeFor(none)).toBe("answered");
  });
});
