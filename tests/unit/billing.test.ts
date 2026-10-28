import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { effectivePlan, PLANS } from "@/features/billing/plans";
import { verifyStripeSignature } from "@/features/billing/signature";

const day = 86_400_000;
const created = new Date("2026-10-01T12:00:00Z");

describe("effectivePlan", () => {
  it("is the trial for 14 days after the workspace is created", () => {
    expect(
      effectivePlan({
        subscription: null,
        createdAt: created,
        demo: false,
        now: new Date(created.getTime() + 13 * day),
      }),
    ).toMatchObject({ plan: "trial", active: true, trialDaysLeft: 1 });
    expect(
      effectivePlan({
        subscription: null,
        createdAt: created,
        demo: false,
        now: new Date(created.getTime() + 15 * day),
      }),
    ).toMatchObject({ plan: "trial", active: false, trialDaysLeft: 0 });
  });

  it("follows a paid subscription while it's in good standing", () => {
    const now = new Date(created.getTime() + 40 * day);
    for (const status of ["active", "trialing", "past_due"]) {
      expect(
        effectivePlan({
          subscription: { plan: "pro", status },
          createdAt: created,
          demo: false,
          now,
        }),
      ).toMatchObject({ plan: "pro", active: true });
    }
    expect(
      effectivePlan({
        subscription: { plan: "pro", status: "canceled" },
        createdAt: created,
        demo: false,
        now,
      }),
    ).toMatchObject({ plan: "trial", active: false });
  });

  it("gives demo sandboxes no plan limits", () => {
    expect(
      effectivePlan({
        subscription: null,
        createdAt: created,
        demo: true,
        now: new Date(created.getTime() + 90 * day),
      }),
    ).toMatchObject({ plan: "demo", active: true, limits: PLANS.demo.limits });
  });
});

describe("verifyStripeSignature", () => {
  const secret = "whsec_test";
  const payload = '{"id":"evt_1"}';
  const sign = (timestamp: number, body = payload, key = secret) =>
    `t=${timestamp},v1=${createHmac("sha256", key).update(`${timestamp}.${body}`).digest("hex")}`;
  const now = 1_800_000_000;

  it("accepts Stripe's signature within 5 minutes", () => {
    expect(verifyStripeSignature(payload, sign(now), secret, now)).toBe(true);
    expect(verifyStripeSignature(payload, sign(now - 299), secret, now)).toBe(
      true,
    );
  });

  it("refuses an old, altered or wrongly signed event", () => {
    expect(verifyStripeSignature(payload, sign(now - 301), secret, now)).toBe(
      false,
    );
    expect(
      verifyStripeSignature('{"id":"evt_2"}', sign(now), secret, now),
    ).toBe(false);
    expect(
      verifyStripeSignature(
        payload,
        sign(now, payload, "whsec_other"),
        secret,
        now,
      ),
    ).toBe(false);
    expect(verifyStripeSignature(payload, "nonsense", secret, now)).toBe(false);
    expect(verifyStripeSignature(payload, null, secret, now)).toBe(false);
  });
});
