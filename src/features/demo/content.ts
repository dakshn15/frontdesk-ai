// Bloom Hair & Beauty, the fictional Austin salon every demo sandbox starts from. Times are
// minutes after midnight in the salon's time zone; weekdays run 1 (Monday) to 7 (Sunday).

export const DEMO_BUSINESS = {
  name: "Bloom Hair & Beauty",
  timezone: "America/Chicago",
  currency: "USD",
  assistantName: "Bea",
  color: "#0f766e",
  greeting:
    "Hi, I'm Bea, Bloom's assistant. Ask me about services, prices or opening hours, or book an appointment.",
  suggestions: [
    "Do you have parking?",
    "Can I book a women's cut this week?",
    "How much is balayage?",
    "Can I talk to a person?",
  ],
  address: "1408 South Congress Ave, Austin, TX 78704",
  phone: "(512) 555-0142",
  tagline: "Cuts, colour and beauty on South Congress since 2016.",
} as const;

export type DemoService = {
  name: string;
  category: "Hair" | "Colour" | "Styling" | "Beauty";
  description: string;
  durationMinutes: number;
  bufferMinutes: number;
  priceCents: number;
  priceIsFrom?: boolean;
};

export const DEMO_SERVICES: DemoService[] = [
  {
    name: "Women's cut and blow-dry",
    category: "Hair",
    description: "Consultation, wash, cut and a finished blow-dry.",
    durationMinutes: 60,
    bufferMinutes: 15,
    priceCents: 6500,
  },
  {
    name: "Men's cut",
    category: "Hair",
    description: "Scissor or clipper cut with a wash and style.",
    durationMinutes: 30,
    bufferMinutes: 10,
    priceCents: 3500,
  },
  {
    name: "Kids' cut (under 12)",
    category: "Hair",
    description: "A relaxed cut for children under 12.",
    durationMinutes: 30,
    bufferMinutes: 10,
    priceCents: 2500,
  },
  {
    name: "Blow-dry",
    category: "Hair",
    description: "Wash and blow-dry, smooth or with volume.",
    durationMinutes: 45,
    bufferMinutes: 10,
    priceCents: 4500,
  },
  {
    name: "Root touch-up",
    category: "Colour",
    description: "Single-process colour on up to 2 inches of regrowth.",
    durationMinutes: 90,
    bufferMinutes: 15,
    priceCents: 8500,
  },
  {
    name: "Full colour",
    category: "Colour",
    description: "All-over colour from roots to ends. Price depends on length.",
    durationMinutes: 120,
    bufferMinutes: 15,
    priceCents: 11000,
    priceIsFrom: true,
  },
  {
    name: "Balayage",
    category: "Colour",
    description:
      "Hand-painted, natural-looking lightening with a toner and blow-dry. Price depends on length and thickness.",
    durationMinutes: 180,
    bufferMinutes: 15,
    priceCents: 19500,
    priceIsFrom: true,
  },
  {
    name: "Gloss and tone",
    category: "Colour",
    description: "Refreshes colour and adds shine between appointments.",
    durationMinutes: 45,
    bufferMinutes: 10,
    priceCents: 5000,
  },
  {
    name: "Event styling",
    category: "Styling",
    description: "Curls, waves or an updo for a special occasion.",
    durationMinutes: 60,
    bufferMinutes: 15,
    priceCents: 7500,
  },
  {
    name: "Bridal hair trial",
    category: "Styling",
    description: "Try your wedding look ahead of the day.",
    durationMinutes: 90,
    bufferMinutes: 15,
    priceCents: 12000,
  },
  {
    name: "Keratin smoothing",
    category: "Styling",
    description: "Smooths frizz for up to 4 months. Price depends on length.",
    durationMinutes: 150,
    bufferMinutes: 15,
    priceCents: 25000,
    priceIsFrom: true,
  },
  {
    name: "Brow shape and tint",
    category: "Beauty",
    description: "Wax, tidy and tint.",
    durationMinutes: 30,
    bufferMinutes: 10,
    priceCents: 3000,
  },
  {
    name: "Lash lift and tint",
    category: "Beauty",
    description: "A natural curl and tint that lasts 6 to 8 weeks.",
    durationMinutes: 60,
    bufferMinutes: 10,
    priceCents: 7000,
  },
  {
    name: "Makeup application",
    category: "Beauty",
    description: "Full makeup for an event or photos.",
    durationMinutes: 60,
    bufferMinutes: 15,
    priceCents: 8500,
  },
  {
    name: "Bridal makeup trial",
    category: "Beauty",
    description: "Try your wedding makeup ahead of the day.",
    durationMinutes: 90,
    bufferMinutes: 15,
    priceCents: 11500,
  },
];

export type DemoStaff = {
  name: string;
  title: string;
  bio: string;
  /** Indexes into DEMO_SERVICES. */
  services: number[];
  hours: { weekday: number; startMinute: number; endMinute: number }[];
};

const days = (weekdays: number[], startMinute: number, endMinute: number) =>
  weekdays.map((weekday) => ({ weekday, startMinute, endMinute }));

export const DEMO_STAFF: DemoStaff[] = [
  {
    name: "Maya Torres",
    title: "Owner and senior stylist",
    bio: "Maya opened Bloom in 2016 after ten years in salons in Austin and New York. She loves precision cuts and bridal styling.",
    services: [0, 1, 3, 8, 9, 10],
    hours: [...days([2, 3, 4, 5], 540, 1140), ...days([6], 540, 1020)],
  },
  {
    name: "Jordan Lee",
    title: "Colour specialist",
    bio: "Jordan does balayage, lived-in blondes and colour corrections.",
    services: [0, 4, 5, 6, 7],
    hours: [...days([2, 3, 4, 5], 600, 1140), ...days([6], 540, 1020)],
  },
  {
    name: "Priya Nair",
    title: "Stylist",
    bio: "Priya is great with curly hair, kids' cuts and event styling.",
    services: [0, 1, 2, 3, 8],
    hours: [...days([3, 4, 5], 540, 1140), ...days([6], 540, 1020)],
  },
  {
    name: "Sofia Alvarez",
    title: "Beauty therapist",
    bio: "Sofia does brows, lashes and makeup, including bridal parties.",
    services: [11, 12, 13, 14],
    hours: [...days([2, 4, 5], 600, 1080), ...days([6], 540, 1020)],
  },
];

/** Tuesday to Friday 9:00 to 19:00, Saturday 9:00 to 17:00. Closed Sunday and Monday. */
export const DEMO_OPENING_HOURS = [
  ...days([2, 3, 4, 5], 540, 1140),
  ...days([6], 540, 1020),
];

export const DEMO_CLOSED_DAYS = [
  { date: "2026-11-26", name: "Thanksgiving" },
  { date: "2026-12-24", name: "Christmas Eve" },
  { date: "2026-12-25", name: "Christmas Day" },
  { date: "2027-01-01", name: "New Year's Day" },
  { date: "2027-05-29", name: "Memorial Day weekend" },
  { date: "2027-07-03", name: "Independence Day" },
  { date: "2027-11-25", name: "Thanksgiving" },
  { date: "2027-12-24", name: "Christmas Eve" },
];

export const DEMO_POLICIES = [
  {
    kind: "cancellation",
    title: "Cancellations",
    body: "Cancel or reschedule at least 24 hours ahead at no charge. Later cancellations and no-shows are charged 50% of the service price.",
  },
  {
    kind: "late_arrival",
    title: "Late arrivals",
    body: "If you're more than 15 minutes late we may need to shorten your service or move your appointment, so the next guest isn't kept waiting.",
  },
  {
    kind: "payment",
    title: "Payment",
    body: "We take all major cards, Apple Pay and Google Pay. Payment is taken after your appointment. Gratuity is welcome but never expected.",
  },
  {
    kind: "parking",
    title: "Parking",
    body: "There's free parking for guests in the lot behind the salon, entered from Elizabeth Street. Street parking on South Congress is metered.",
  },
  {
    kind: "accessibility",
    title: "Accessibility",
    body: "The salon is on the ground floor with step-free access and an accessible restroom. Let us know if you need anything else.",
  },
] as const;

export const DEMO_ANSWERS = [
  {
    question: "Do you sell gift cards?",
    answer:
      "Yes. Gift cards are available in the salon in any amount from $25, and they never expire.",
  },
  {
    question: "Do you take walk-ins?",
    answer:
      "Sometimes, if a stylist is free, but we're usually booked a few days ahead. Booking online is the surest way to get a time.",
  },
  {
    question: "Do I need a consultation before colour?",
    answer:
      "For balayage, full colour or a big change, we offer a free 15-minute consultation and patch test. For a root touch-up or gloss, no consultation is needed.",
  },
  {
    question: "What products do you use?",
    answer:
      "We use Davines for hair care and colour, and Kevyn Aucoin for makeup. Most products are for sale at the front desk.",
  },
  {
    question: "Do you do group bookings for weddings?",
    answer:
      "Yes, we do bridal parties of up to eight. Ask the team for a quote, since it depends on the services and the date.",
  },
];

export const DEMO_KNOWLEDGE = [
  {
    title: "About us",
    content: `
Bloom is an independent hair and beauty salon on South Congress Avenue in Austin, opened by Maya Torres in 2016. We're a small team of four, and we'd rather do a few appointments well than rush.

## Our team

Maya Torres is the owner and senior stylist. Jordan Lee is our colour specialist, Priya Nair is a stylist who loves curly hair and kids' cuts, and Sofia Alvarez does brows, lashes and makeup.

## Sustainability

We recycle foils, colour tubes and cut hair through Green Circle Salons, and we use Davines products, which are made with renewable energy.

## Location

You'll find us at 1408 South Congress Ave, Austin, TX 78704, between the coffee shop and the bookstore. Guest parking is behind the salon.`,
  },
  {
    title: "Salon FAQ",
    content: `
## Keratin smoothing

Our keratin smoothing treatment takes about two and a half hours and lasts up to four months. Wait three days before washing your hair afterwards. It's formaldehyde-free.

## Balayage aftercare

Use a sulfate-free shampoo and book a gloss and tone every 8 to 10 weeks to keep the colour fresh. Most guests come back for a full balayage every 4 to 6 months.

## Curly hair

Priya cuts curly hair dry, curl by curl, so you can see the shape as it's cut. Please arrive with your hair dry and styled the way you usually wear it.

## Kids

Children under 12 get a kids' cut. A parent or guardian should stay in the salon during the appointment.

## Bridal

We do bridal hair and makeup trials in the salon, and on the day we can come to you within 30 miles of Austin for parties of three or more.`,
  },
];

export const DEMO_CUSTOMERS = [
  { name: "Emily Carter", email: "emily.carter@example.com" },
  { name: "Marcus Johnson", email: "marcus.johnson@example.com" },
  { name: "Olivia Martinez", email: "olivia.martinez@example.com" },
  { name: "Noah Williams", email: "noah.williams@example.com" },
  { name: "Ava Thompson", email: "ava.thompson@example.com" },
  { name: "Liam Garcia", email: "liam.garcia@example.com" },
  { name: "Sophia Brown", email: "sophia.brown@example.com" },
  { name: "Ethan Davis", email: "ethan.davis@example.com" },
  { name: "Isabella Wilson", email: "isabella.wilson@example.com" },
  { name: "Mia Anderson", email: "mia.anderson@example.com" },
  { name: "James Taylor", email: "james.taylor@example.com" },
  { name: "Grace Moore", email: "grace.moore@example.com" },
];

/**
 * A day's bookings: [staff, start minute, service, customer], with no overlaps for any one
 * person (service time plus buffer). Each open day uses the next pattern in turn; a
 * booking is skipped when that person doesn't work that weekday.
 */
export const DEMO_DAY_PATTERNS: [number, number, number, number][][] = [
  [
    [0, 600, 0, 0],
    [0, 720, 1, 1],
    [1, 660, 4, 2],
    [1, 840, 7, 3],
    [2, 600, 3, 4],
    [3, 660, 12, 5],
  ],
  [
    [0, 570, 9, 6],
    [0, 780, 0, 7],
    [1, 600, 6, 8],
    [2, 720, 0, 9],
    [2, 900, 2, 10],
    [3, 780, 11, 11],
  ],
  [
    [0, 660, 10, 3],
    [1, 720, 5, 0],
    [2, 600, 1, 5],
    [2, 660, 8, 2],
    [3, 600, 13, 7],
    [3, 720, 14, 9],
  ],
];

/** A conversation for the inbox: messages in order, with the tools the AI used. */
export type DemoConversation = {
  status: "ai" | "needs_human" | "resolved";
  minutesAgo: number;
  handoffReason?: string;
  lead?: { name: string; email: string; message: string };
  turns: (
    | { role: "visitor" | "ai"; content: string; source?: string }
    | { tool: string; input: Record<string, unknown> }
  )[];
};

export const DEMO_CONVERSATIONS: DemoConversation[] = [
  {
    status: "needs_human",
    minutesAgo: 3,
    handoffReason: "Wants a quote for a bridal party of five.",
    lead: {
      name: "Hannah Kim",
      email: "hannah.kim@example.com",
      message: "Bridal party of five on June 12.",
    },
    turns: [
      {
        role: "visitor",
        content:
          "Hi, I'm getting married on June 12. Can you do hair and makeup for me and four bridesmaids?",
      },
      {
        tool: "find_verified_answer",
        input: { question: "group bookings for weddings" },
      },
      {
        role: "ai",
        content:
          "Congratulations. Yes, we do bridal parties of up to eight. The price depends on the services and the date, so I've asked the team to put together a quote for you.",
        source: "Do you do group bookings for weddings?",
      },
      {
        tool: "handoff_to_human",
        input: { reason: "Wants a quote for a bridal party of five." },
      },
      {
        tool: "capture_lead",
        input: { name: "Hannah Kim", email: "hannah.kim@example.com" },
      },
    ],
  },
  {
    status: "ai",
    minutesAgo: 40,
    turns: [
      { role: "visitor", content: "How long does keratin smoothing last?" },
      { tool: "search_knowledge", input: { query: "keratin smoothing last" } },
      {
        role: "ai",
        content:
          "Keratin smoothing lasts up to four months. The treatment takes about two and a half hours, and you should wait three days before washing your hair afterwards. It starts at $250.",
        source: "Salon FAQ › Keratin smoothing",
      },
    ],
  },
  {
    status: "resolved",
    minutesAgo: 180,
    turns: [
      { role: "visitor", content: "Is there parking?" },
      { tool: "get_policies", input: {} },
      {
        role: "ai",
        content:
          "Yes, there's free guest parking in the lot behind the salon, entered from Elizabeth Street.",
        source: "Parking",
      },
      { role: "visitor", content: "Perfect, thanks" },
      { role: "ai", content: "You're welcome. See you soon." },
    ],
  },
  {
    status: "ai",
    minutesAgo: 60 * 20,
    lead: {
      name: "Daniel Reyes",
      email: "daniel.reyes@example.com",
      message: "Wants a $100 gift card for his wife's birthday.",
    },
    turns: [
      { role: "visitor", content: "Can I buy a gift card online?" },
      { tool: "find_verified_answer", input: { question: "gift cards" } },
      {
        role: "ai",
        content:
          "Gift cards are available in the salon in any amount from $25, and they never expire. I can't sell one in the chat, but I can ask the team to get in touch if you leave your name and email.",
        source: "Do you sell gift cards?",
      },
      {
        role: "visitor",
        content: "Sure, Daniel Reyes, daniel.reyes@example.com",
      },
      {
        tool: "capture_lead",
        input: { name: "Daniel Reyes", email: "daniel.reyes@example.com" },
      },
      { role: "ai", content: "Thanks, Daniel. The team will email you today." },
    ],
  },
];

/** Older leads with no chat, from before the widget went live. */
export const DEMO_LEADS = [
  {
    name: "Rachel Green",
    email: "rachel.green@example.com",
    phone: "(512) 555-0188",
    message: "Asked about a colour correction after a box dye.",
  },
];
