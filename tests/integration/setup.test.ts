import { afterAll, describe, expect, it } from "vitest";
import { emptyWeek } from "@/features/hours/weekly-hours";
import { saveAnswerRecord } from "@/features/answers/records";
import { savePolicyRecord } from "@/features/policies/records";
import { getSetupFacts } from "@/features/setup/queries";
import {
  replaceStaffHoursRecord,
  setStaffServicesRecord,
  updateStaffProfileRecord,
} from "@/features/staff/records";
import {
  addTestMember,
  claimsFor,
  cleanupTestData,
  createTestService,
  createTestStaff,
  createTestUser,
  createTestWorkspace,
  setTestOpeningHours,
} from "../helpers/seed";

afterAll(cleanupTestData);

const week = { ...emptyWeek(), 2: [{ start: 540, end: 1020 }] };

describe("getSetupFacts", () => {
  it("starts empty for a new workspace", async () => {
    const owner = await createTestUser();
    const ws = await createTestWorkspace(owner);
    expect(await getSetupFacts(claimsFor(owner), ws.id)).toEqual({
      openingHours: false,
      services: 0,
      bookableStaff: 0,
      policies: 0,
      answers: 0,
      aiKey: false,
    });
  });

  it("counts only active staff with a service and some hours as bookable", async () => {
    const [owner, member] = await Promise.all([
      createTestUser(),
      createTestUser(),
    ]);
    const ws = await createTestWorkspace(owner);
    await addTestMember(ws.id, member, "staff");
    const claims = claimsFor(owner);
    await setTestOpeningHours(ws.id, owner, [
      { weekday: 2, startMinute: 540, endMinute: 1020 },
    ]);
    const { id: cut } = await createTestService(ws.id, owner);
    await createTestService(ws.id, owner);

    const ready = await createTestStaff(ws.id, owner, { name: "Ready" });
    await setStaffServicesRecord(claims, ws.id, ready.id, [cut]);
    await replaceStaffHoursRecord(claims, ws.id, ready.id, week);

    const noHours = await createTestStaff(ws.id, owner, { name: "No hours" });
    await setStaffServicesRecord(claims, ws.id, noHours.id, [cut]);

    const noServices = await createTestStaff(ws.id, owner, {
      name: "No services",
    });
    await replaceStaffHoursRecord(claims, ws.id, noServices.id, week);

    const inactive = await createTestStaff(ws.id, owner, { name: "Inactive" });
    await setStaffServicesRecord(claims, ws.id, inactive.id, [cut]);
    await replaceStaffHoursRecord(claims, ws.id, inactive.id, week);
    await updateStaffProfileRecord(claims, ws.id, inactive.id, {
      name: "Inactive",
      title: "",
      bio: "",
      userId: null,
      active: false,
    });

    await savePolicyRecord(claims, ws.id, {
      id: null,
      kind: "parking",
      title: "Parking",
      body: "Free parking.",
    });
    await saveAnswerRecord(claims, ws.id, {
      id: null,
      question: "Do you do bridal hair?",
      answer: "Yes.",
    });

    // Staff-role members read the same facts.
    expect(await getSetupFacts(claimsFor(member), ws.id)).toEqual({
      openingHours: true,
      services: 2,
      bookableStaff: 1,
      policies: 1,
      answers: 1,
      aiKey: false,
    });
  });
});
