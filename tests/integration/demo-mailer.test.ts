import { eq } from "drizzle-orm";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { adminDb } from "@/db/admin";
import { workspaces } from "@/db/schema";
import { sendEmail } from "@/privileged/mailer";
import {
  cleanupTestData,
  createTestUser,
  createTestWorkspace,
} from "../helpers/seed";

// As if Resend were set up, so the only thing stopping a send is the demo rule.
vi.mock("@/env/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/env/server")>();
  return {
    getServerEnv: () => ({
      ...actual.getServerEnv(),
      RESEND_API_KEY: "re_test",
      EMAIL_FROM: "Bloom <hello@example.com>",
    }),
  };
});

afterAll(cleanupTestData);
afterEach(() => vi.restoreAllMocks());

const email = (workspaceId: string) => ({
  workspaceId,
  kind: "test",
  to: "someone@example.com",
  subject: "Hello",
  html: "<p>Hello</p>",
  text: "Hello",
});

describe("email from a demo sandbox", () => {
  it("goes to the outbox and never to Resend", async () => {
    const owner = await createTestUser();
    const real = await createTestWorkspace(owner);
    const demo = await createTestWorkspace(owner);
    await adminDb
      .update(workspaces)
      .set({ demoExpiresAt: new Date(Date.now() + 3_600_000) })
      .where(eq(workspaces.id, demo.id));
    // Mocked only now: setting up the test users also goes through fetch.
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json({ id: "email_1" }));

    expect(await sendEmail(email(demo.id))).toBe("not_sent");
    expect(fetch).not.toHaveBeenCalled();
    expect(await sendEmail(email(real.id))).toBe("sent");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
