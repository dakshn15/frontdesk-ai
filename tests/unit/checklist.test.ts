import { describe, expect, it } from "vitest";
import { setupChecklist } from "@/features/setup/checklist";

describe("setupChecklist", () => {
  it("marks each step from the business's facts", () => {
    const list = setupChecklist("bloom", {
      openingHours: true,
      services: 2,
      bookableStaff: 0,
      policies: 1,
      answers: 0,
      aiKey: true,
    });
    expect(list.doneCount).toBe(5);
    expect(list.total).toBe(7);
    expect(list.steps).toEqual([
      {
        key: "details",
        label: "Business details",
        done: true,
        href: "/w/bloom/settings",
      },
      {
        key: "ai",
        label: "AI key",
        done: true,
        href: "/w/bloom/settings#ai-keys",
      },
      {
        key: "hours",
        label: "Opening hours",
        done: true,
        href: "/w/bloom/hours",
      },
      {
        key: "services",
        label: "Services",
        done: true,
        href: "/w/bloom/services",
      },
      {
        key: "staff",
        label: "Staff who can be booked",
        done: false,
        href: "/w/bloom/staff",
      },
      {
        key: "policies",
        label: "Policies",
        done: true,
        href: "/w/bloom/policies",
      },
      {
        key: "answers",
        label: "Verified answers",
        done: false,
        href: "/w/bloom/answers",
      },
    ]);
  });

  it("counts a new business's details as the only done step", () => {
    const list = setupChecklist("bloom", {
      openingHours: false,
      services: 0,
      bookableStaff: 0,
      policies: 0,
      answers: 0,
      aiKey: false,
    });
    expect(list.doneCount).toBe(1);
  });

  it("is complete when every fact is filled", () => {
    const list = setupChecklist("bloom", {
      openingHours: true,
      services: 1,
      bookableStaff: 1,
      policies: 1,
      answers: 1,
      aiKey: true,
    });
    expect(list.doneCount).toBe(7);
    expect(list.steps.every((step) => step.done)).toBe(true);
  });
});
