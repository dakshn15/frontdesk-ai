/** What the business has filled in so far. */
export type SetupFacts = {
  openingHours: boolean;
  services: number;
  /** Active staff with at least one service and some weekly hours. */
  bookableStaff: number;
  policies: number;
  answers: number;
};

export type SetupStep = {
  key: string;
  label: string;
  done: boolean;
  href: string;
};

/** The steps that make the receptionist useful, in the order to do them. */
export function setupChecklist(
  slug: string,
  facts: SetupFacts,
): { steps: SetupStep[]; doneCount: number; total: number } {
  const base = `/w/${slug}`;
  const steps: SetupStep[] = [
    // Onboarding asks for these, so a workspace always has them.
    {
      key: "details",
      label: "Business details",
      done: true,
      href: `${base}/settings`,
    },
    {
      key: "hours",
      label: "Opening hours",
      done: facts.openingHours,
      href: `${base}/hours`,
    },
    {
      key: "services",
      label: "Services",
      done: facts.services > 0,
      href: `${base}/services`,
    },
    {
      key: "staff",
      label: "Staff who can be booked",
      done: facts.bookableStaff > 0,
      href: `${base}/staff`,
    },
    {
      key: "policies",
      label: "Policies",
      done: facts.policies > 0,
      href: `${base}/policies`,
    },
    {
      key: "answers",
      label: "Verified answers",
      done: facts.answers > 0,
      href: `${base}/answers`,
    },
  ];
  return {
    steps,
    doneCount: steps.filter((step) => step.done).length,
    total: steps.length,
  };
}
