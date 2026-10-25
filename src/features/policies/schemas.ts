import { z } from "zod";

export type StandardPolicyKind =
  "cancellation" | "late_arrival" | "payment" | "parking" | "accessibility";

/** The standard policies, in the order the page shows them. */
export const POLICY_KINDS: {
  kind: StandardPolicyKind;
  title: string;
  placeholder: string;
}[] = [
  {
    kind: "cancellation",
    title: "Cancellations",
    placeholder: "Cancel or reschedule at least 24 hours ahead to avoid a fee.",
  },
  {
    kind: "late_arrival",
    title: "Late arrivals",
    placeholder:
      "If you're more than 15 minutes late, we may need to shorten or move your appointment.",
  },
  {
    kind: "payment",
    title: "Payment",
    placeholder: "We take cards and cash. Colour services need a $20 deposit.",
  },
  {
    kind: "parking",
    title: "Parking",
    placeholder:
      "Free parking behind the building. The entrance is on Oak Street.",
  },
  {
    kind: "accessibility",
    title: "Accessibility",
    placeholder:
      "Step-free entrance and an accessible restroom on the ground floor.",
  },
];

const KINDS = [...POLICY_KINDS.map((p) => p.kind), "custom"] as const;

export const policyInputSchema = z
  .object({
    // Only custom policies are saved by id; a standard kind has one row per workspace.
    id: z
      .union([z.literal(""), z.uuid()])
      .default("")
      .transform((value) => value || null),
    kind: z.enum(KINDS),
    title: z
      .string()
      .trim()
      .max(60, { error: "Use 60 characters or fewer." })
      .default(""),
    body: z
      .string()
      .trim()
      .min(1, { error: "Write the policy." })
      .max(1000, { error: "Use 1,000 characters or fewer." }),
  })
  .superRefine((value, ctx) => {
    if (value.kind === "custom" && !value.title) {
      ctx.addIssue({
        code: "custom",
        path: ["title"],
        message: "Add a title.",
      });
    }
  })
  .transform((value) => {
    const standard = POLICY_KINDS.find((p) => p.kind === value.kind);
    return standard ? { ...value, id: null, title: standard.title } : value;
  });

export type PolicyInput = z.output<typeof policyInputSchema>;
