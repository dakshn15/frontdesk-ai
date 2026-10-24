import { describe, expect, it } from "vitest";
import { newPasswordSchema, signUpSchema } from "@/features/auth/schemas";

describe("signUpSchema", () => {
  it("trims the name and lower-cases the email", () => {
    expect(
      signUpSchema.parse({
        fullName: "  Ana ",
        email: " Ana@Salon.COM ",
        password: "longenough",
      }),
    ).toMatchObject({ fullName: "Ana", email: "ana@salon.com" });
  });

  it("enforces password length", () => {
    const base = { fullName: "Ana", email: "a@b.co" };
    expect(
      signUpSchema.safeParse({ ...base, password: "1234567" }).success,
    ).toBe(false);
    expect(
      signUpSchema.safeParse({ ...base, password: "x".repeat(73) }).success,
    ).toBe(false);
    expect(
      signUpSchema.safeParse({ ...base, password: "12345678" }).success,
    ).toBe(true);
  });

  it("rejects an invalid email", () => {
    expect(
      signUpSchema.safeParse({
        fullName: "Ana",
        email: "not-an-email",
        password: "longenough",
      }).success,
    ).toBe(false);
  });
});

describe("newPasswordSchema", () => {
  it("flags mismatched passwords on the confirm field", () => {
    const r = newPasswordSchema.safeParse({
      password: "Password123!",
      confirmPassword: "Password124!",
    });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]).toMatchObject({
      path: ["confirmPassword"],
      message: "Passwords don't match.",
    });
  });
});
