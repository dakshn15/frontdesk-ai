// What a quiet conversation was about and how it ended, by simple rules: explainable,
// repeatable and free. The topic list is fixed so analytics can compare like with like.

export const TOPICS = [
  "Booking",
  "Prices",
  "Opening hours",
  "Location and parking",
  "Gift cards",
  "Policies",
  "Team",
  "Services",
  "Other",
] as const;
export type Topic = (typeof TOPICS)[number];

export const OUTCOMES = [
  "booked",
  "lead",
  "handed_off",
  "answered",
  "unanswered",
] as const;
export type Outcome = (typeof OUTCOMES)[number];

export const OUTCOME_LABEL: Record<Outcome, string> = {
  booked: "Booked",
  lead: "Left their details",
  handed_off: "Handed to the team",
  answered: "Answered",
  unanswered: "Not answered",
};

// In order: the first rule that matches wins.
const RULES: { topic: Topic; tools: string[]; words: RegExp }[] = [
  {
    topic: "Booking",
    tools: ["check_availability", "propose_booking", "send_manage_link"],
    words: /\b(book|booking|appointment|availab\w*|reschedul\w*|slot)\b/i,
  },
  {
    topic: "Prices",
    tools: [],
    words: /\b(price|prices|cost|costs|how much|expensive|cheap)\b|\$/i,
  },
  {
    topic: "Opening hours",
    tools: ["get_hours"],
    words: /\b(open|opening|close|closed|hours|holiday)\b/i,
  },
  {
    topic: "Location and parking",
    tools: [],
    words: /\b(park|parking|address|where|located|location|directions)\b/i,
  },
  { topic: "Gift cards", tools: [], words: /\bgift\b/i },
  {
    topic: "Policies",
    tools: ["get_policies"],
    words: /\b(polic\w*|refund|late|deposit|cancel\w*)\b/i,
  },
  {
    topic: "Team",
    tools: ["get_staff"],
    words: /\b(stylist|staff|therapist|team)\b/i,
  },
  {
    topic: "Services",
    tools: ["get_services"],
    words: /\b(service|services|offer|treatment|do you do)\b/i,
  },
];

export function topicFor(input: { tools: string[]; text: string }): Topic {
  for (const rule of RULES) {
    if (rule.tools.some((tool) => input.tools.includes(tool)))
      return rule.topic;
  }
  for (const rule of RULES) {
    if (rule.words.test(input.text)) return rule.topic;
  }
  return "Other";
}

export function outcomeFor(facts: {
  booked: boolean;
  lead: boolean;
  handedOff: boolean;
  unanswered: boolean;
}): Outcome {
  if (facts.booked) return "booked";
  if (facts.lead) return "lead";
  if (facts.handedOff) return "handed_off";
  return facts.unanswered ? "unanswered" : "answered";
}
