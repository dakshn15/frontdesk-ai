import { describe, expect, it, vi } from "vitest";
import { FetchPageError, fetchPage } from "@/jobs/fetch-page";

const DNS: Record<string, string[]> = {
  "bloom.test": ["93.184.216.34"],
  "www.bloom.test": ["93.184.216.35"],
  "internal.bloom.test": ["10.0.0.5"],
  "sneaky.test": ["93.184.216.36", "127.0.0.1"],
};
const resolve = async (host: string) => DNS[host] ?? [];

function respond(
  status: number,
  headers: Record<string, string>,
  body = "",
): Response {
  return new Response(status >= 300 && status < 400 ? null : body, {
    status,
    headers,
  });
}

const html = (body: string) =>
  respond(200, { "content-type": "text/html; charset=utf-8" }, body);

describe("fetchPage", () => {
  it("fetches a public page", async () => {
    const fetchFn = vi.fn(async () => html("<p>Hello</p>"));
    const page = await fetchPage("bloom.test/about", { resolve, fetchFn });
    expect(page).toEqual({
      url: "https://bloom.test/about",
      contentType: "text/html; charset=utf-8",
      body: "<p>Hello</p>",
    });
  });

  it.each([
    "http://127.0.0.1/",
    "http://169.254.169.254/latest/meta-data",
    "http://[::1]/",
    "https://internal.bloom.test/",
    "https://sneaky.test/",
    "https://nowhere.test/",
  ])("refuses %s without fetching it", async (url) => {
    const fetchFn = vi.fn();
    await expect(fetchPage(url, { resolve, fetchFn })).rejects.toBeInstanceOf(
      FetchPageError,
    );
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("follows public redirects and refuses one into the private network", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        respond(301, { location: "https://www.bloom.test/about" }),
      )
      .mockResolvedValueOnce(html("<p>Moved</p>"));
    expect(
      (await fetchPage("https://bloom.test/about", { resolve, fetchFn })).url,
    ).toBe("https://www.bloom.test/about");

    const toInternal = vi
      .fn()
      .mockResolvedValueOnce(
        respond(302, { location: "https://internal.bloom.test/admin" }),
      );
    await expect(
      fetchPage("https://bloom.test/", { resolve, fetchFn: toInternal }),
    ).rejects.toThrow("We can't fetch pages from that address.");
    expect(toInternal).toHaveBeenCalledTimes(1);
  });

  it("refuses files that aren't pages and pages that are too big", async () => {
    await expect(
      fetchPage("https://bloom.test/logo.png", {
        resolve,
        fetchFn: async () => respond(200, { "content-type": "image/png" }, "x"),
      }),
    ).rejects.toThrow("That address isn't a web page.");
    await expect(
      fetchPage("https://bloom.test/", {
        resolve,
        fetchFn: async () => html("x".repeat(2 * 1024 * 1024 + 1)),
      }),
    ).rejects.toThrow("That page is too large.");
    await expect(
      fetchPage("https://bloom.test/", {
        resolve,
        fetchFn: async () => respond(404, { "content-type": "text/html" }),
      }),
    ).rejects.toThrow("That page answered with an error (404).");
  });
});
