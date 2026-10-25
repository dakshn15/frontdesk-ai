import { describe, expect, it } from "vitest";
import { isPublicAddress, parseFetchableUrl } from "@/lib/safe-url";

describe("isPublicAddress", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "::1",
    "::",
    "fc00::1",
    "fd12::1",
    "fe80::1",
    "::ffff:127.0.0.1",
    "::ffff:10.0.0.1",
  ])("refuses %s", (ip) => {
    expect(isPublicAddress(ip)).toBe(false);
  });

  it.each(["8.8.8.8", "172.32.0.1", "104.18.2.3", "2606:4700::1111"])(
    "allows %s",
    (ip) => {
      expect(isPublicAddress(ip)).toBe(true);
    },
  );
});

describe("parseFetchableUrl", () => {
  it("accepts http and https URLs and adds https when missing", () => {
    expect(parseFetchableUrl("bloom.test/about")?.href).toBe(
      "https://bloom.test/about",
    );
    expect(parseFetchableUrl("http://bloom.test")?.protocol).toBe("http:");
  });

  it("refuses other schemes, credentials and bare words", () => {
    expect(parseFetchableUrl("file:///etc/passwd")).toBeNull();
    expect(parseFetchableUrl("ftp://bloom.test")).toBeNull();
    expect(parseFetchableUrl("https://user:pass@bloom.test")).toBeNull();
    expect(parseFetchableUrl("not a url")).toBeNull();
  });
});
