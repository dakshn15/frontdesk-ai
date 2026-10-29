import { describe, expect, it } from "vitest";
import { open, seal } from "@/lib/secret-box";

const secret = "a-server-secret-that-is-long-enough";

describe("secret box", () => {
  it("opens what it sealed, and never stores the text as is", () => {
    const sealed = seal("sk-test-1234", secret);
    expect(sealed).not.toContain("sk-test-1234");
    expect(sealed.startsWith("v1.")).toBe(true);
    expect(open(sealed, secret)).toBe("sk-test-1234");
  });

  it("seals the same text differently each time", () => {
    expect(seal("same", secret)).not.toBe(seal("same", secret));
  });

  it("refuses another secret, a changed value and junk", () => {
    const sealed = seal("sk-test-1234", secret);
    expect(open(sealed, "another-secret-that-is-long-enough")).toBeNull();
    const [v, iv, tag, data] = sealed.split(".");
    const flipped = `${data[0] === "A" ? "B" : "A"}${data.slice(1)}`;
    expect(open([v, iv, tag, flipped].join("."), secret)).toBeNull();
    expect(open("not sealed", secret)).toBeNull();
  });
});
