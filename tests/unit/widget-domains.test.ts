import { describe, expect, it } from "vitest";
import {
  frameAncestors,
  hostAllowed,
  normalizeDomain,
} from "@/features/widget/domains";
import { widgetSettingsSchema } from "@/features/widget/schemas";

describe("normalizeDomain", () => {
  it("keeps just the host, without www", () => {
    expect(normalizeDomain("bloomsalon.com")).toBe("bloomsalon.com");
    expect(normalizeDomain(" https://www.BloomSalon.com/book?x=1 ")).toBe(
      "bloomsalon.com",
    );
    expect(normalizeDomain("*.bloomsalon.com")).toBe("bloomsalon.com");
    expect(normalizeDomain("shop.bloom-salon.co.uk:8080")).toBe(
      "shop.bloom-salon.co.uk",
    );
    expect(normalizeDomain("localhost:3000")).toBe("localhost");
  });

  it("rejects things that aren't domains", () => {
    for (const bad of ["", "bloom", "bloom..com", "-bloom.com", "a b.com", "*"])
      expect(normalizeDomain(bad)).toBeNull();
  });
});

describe("hostAllowed", () => {
  it("allows any site until domains are set", () => {
    expect(hostAllowed("anything.example", [])).toBe(true);
  });

  it("allows the domain and its subdomains only", () => {
    const domains = ["bloomsalon.com"];
    expect(hostAllowed("bloomsalon.com", domains)).toBe(true);
    expect(hostAllowed("www.bloomsalon.com", domains)).toBe(true);
    expect(hostAllowed("BOOK.bloomsalon.com", domains)).toBe(true);
    expect(hostAllowed("evilbloomsalon.com", domains)).toBe(false);
    expect(hostAllowed("bloomsalon.com.evil.io", domains)).toBe(false);
    expect(hostAllowed("", domains)).toBe(false);
    expect(hostAllowed(null, domains)).toBe(false);
  });
});

describe("frameAncestors", () => {
  it("sends no policy until domains are set", () => {
    expect(frameAncestors([])).toBeNull();
  });

  it("lists the app, each domain and its subdomains", () => {
    expect(frameAncestors(["bloomsalon.com", "localhost"])).toBe(
      "frame-ancestors 'self' https://bloomsalon.com https://*.bloomsalon.com http://localhost:*",
    );
  });
});

describe("widgetSettingsSchema", () => {
  const valid = {
    widgetColor: "#0F766E",
    widgetGreeting: "Hi there.",
    widgetSuggestions: "Do you have parking?\n\n  Can I book a cut?  \n",
    widgetPosition: "left",
    allowedDomains: "https://www.bloomsalon.com\nbloomsalon.com\nbook.bloom.io",
  };

  it("reads lines into lists and tidies them", () => {
    expect(widgetSettingsSchema.parse(valid)).toEqual({
      widgetColor: "#0f766e",
      widgetGreeting: "Hi there.",
      widgetSuggestions: ["Do you have parking?", "Can I book a cut?"],
      widgetPosition: "left",
      allowedDomains: ["bloomsalon.com", "book.bloom.io"],
    });
  });

  it("explains what's wrong", () => {
    const result = widgetSettingsSchema.safeParse({
      ...valid,
      widgetColor: "teal",
      widgetSuggestions: "a\nb\nc\nd\ne",
      allowedDomains: "bloomsalon.com\nnot a domain",
    });
    expect(result.success).toBe(false);
    const issues = Object.fromEntries(
      result.error!.issues.map((issue) => [issue.path[0], issue.message]),
    );
    expect(issues).toEqual({
      widgetColor: "Pick a colour like #0f766e.",
      widgetSuggestions: "Add up to 4 questions.",
      allowedDomains:
        "“not a domain” isn't a domain. Use one like bloomsalon.com.",
    });
  });
});
