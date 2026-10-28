import { describe, expect, it } from "vitest";
import { isPlatformAdmin } from "@/features/admin/access";

describe("isPlatformAdmin", () => {
  const list = " Daksh@Example.com, ops@example.com ";

  it("matches a signed-in user's email against the list, ignoring case and spaces", () => {
    expect(
      isPlatformAdmin({ sub: "1", email: "daksh@example.com" }, list),
    ).toBe(true);
    expect(isPlatformAdmin({ sub: "1", email: "OPS@example.com" }, list)).toBe(
      true,
    );
    expect(
      isPlatformAdmin({ sub: "1", email: "someone@example.com" }, list),
    ).toBe(false);
  });

  it("never lets in demo guests, users without an email, or anyone when the list is empty", () => {
    expect(
      isPlatformAdmin(
        { sub: "1", email: "daksh@example.com", is_anonymous: true },
        list,
      ),
    ).toBe(false);
    expect(isPlatformAdmin({ sub: "1" }, list)).toBe(false);
    expect(isPlatformAdmin({ sub: "1", email: "" }, "")).toBe(false);
    expect(isPlatformAdmin(null, list)).toBe(false);
  });
});
