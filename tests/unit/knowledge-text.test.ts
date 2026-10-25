import { describe, expect, it } from "vitest";
import { chunkText } from "@/features/knowledge/chunk";
import { htmlToText, sitemapUrls } from "@/features/knowledge/html-text";
import { reciprocalRankFusion } from "@/features/knowledge/rrf";

describe("chunkText", () => {
  it("keeps the heading path with each section", () => {
    const text = [
      "# About us",
      "Bloom is a salon in Austin.",
      "## Parking",
      "Free parking behind the building.",
      "## Pets",
      "",
      "# Prices",
      "See the services page.",
    ].join("\n");
    expect(chunkText(text)).toEqual([
      { heading: "About us", content: "Bloom is a salon in Austin." },
      {
        heading: "About us › Parking",
        content: "Free parking behind the building.",
      },
      { heading: "Prices", content: "See the services page." },
    ]);
  });

  it("splits long sections on paragraphs, with overlap", () => {
    const paragraphs = Array.from(
      { length: 6 },
      (_, i) => `Paragraph ${i + 1}. ${"word ".repeat(40).trim()}`,
    );
    const chunks = chunkText(paragraphs.join("\n\n"), {
      maxChars: 600,
      overlapChars: 250,
    });
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeLessThanOrEqual(600);
      expect(chunk.heading).toBe("");
    }
    // Each chunk after the first starts with the end of the one before it.
    expect(chunks[1].content.startsWith(paragraphs[1].slice(0, 12))).toBe(true);
    expect(chunks.at(-1)?.content).toContain("Paragraph 6.");
  });

  it("cuts a single paragraph longer than the limit", () => {
    const chunks = chunkText("x".repeat(1300), {
      maxChars: 500,
      overlapChars: 0,
    });
    expect(chunks.map((c) => c.content.length)).toEqual([500, 500, 300]);
  });
});

describe("htmlToText", () => {
  it("keeps headings and text from the main content", () => {
    const html = `<html><head><title> Bloom | About </title><style>p{}</style></head>
      <body><nav><a href="/">Home</a></nav>
      <main><h1>About us</h1><p>We are a <b>salon</b>.</p>
      <h2>Parking</h2><ul><li>Free behind the building</li><li>Street parking</li></ul>
      <script>alert(1)</script></main>
      <footer>© Bloom</footer></body></html>`;
    expect(htmlToText(html)).toEqual({
      title: "Bloom | About",
      text: [
        "# About us",
        "We are a salon.",
        "## Parking",
        "Free behind the building",
        "Street parking",
      ].join("\n"),
    });
  });
});

describe("sitemapUrls", () => {
  it("reads every loc", () => {
    const xml = `<?xml version="1.0"?><urlset>
      <url><loc>https://bloom.test/</loc></url>
      <url><loc> https://bloom.test/about </loc></url></urlset>`;
    expect(sitemapUrls(xml)).toEqual([
      "https://bloom.test/",
      "https://bloom.test/about",
    ]);
  });
});

describe("reciprocalRankFusion", () => {
  it("rewards items found by both lists", () => {
    const merged = reciprocalRankFusion([
      ["a", "b", "c"],
      ["c", "d"],
    ]);
    expect(merged.map((m) => m.id)).toEqual(["c", "a", "b", "d"]);
    expect(merged[0].score).toBeCloseTo(1 / 63 + 1 / 61);
  });
});
