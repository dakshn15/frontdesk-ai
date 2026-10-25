import { type HTMLElement, NodeType, parse } from "node-html-parser";

// Turns a web page into plain text with Markdown headings, so chunks keep their sections.

const DROPPED = new Set([
  "script",
  "style",
  "noscript",
  "svg",
  "nav",
  "footer",
  "form",
  "iframe",
  "template",
  "button",
]);

const LINES = new Set([
  "p",
  "li",
  "td",
  "th",
  "dt",
  "dd",
  "blockquote",
  "pre",
  "figcaption",
  "caption",
  "summary",
]);

const BLOCKS =
  "div,section,article,main,aside,header,ul,ol,dl,table,p,li,h1,h2,h3,h4,h5,h6,blockquote,pre,figure";

const collapse = (text: string) => text.replace(/\s+/g, " ").trim();

function walk(node: HTMLElement, out: string[]) {
  for (const child of node.childNodes) {
    if (child.nodeType === NodeType.TEXT_NODE) {
      const text = collapse(child.text);
      if (text) out.push(text);
      continue;
    }
    if (child.nodeType !== NodeType.ELEMENT_NODE) continue;
    const element = child as HTMLElement;
    const tag = element.tagName.toLowerCase();
    if (DROPPED.has(tag)) continue;

    const heading = /^h([1-6])$/.exec(tag);
    if (heading) {
      const text = collapse(element.text);
      if (text) out.push(`${"#".repeat(Number(heading[1]))} ${text}`);
      continue;
    }
    // A line element, or a container with only inline content, becomes one line.
    if (LINES.has(tag) || !element.querySelector(BLOCKS)) {
      for (const dropped of element.querySelectorAll([...DROPPED].join(","))) {
        dropped.remove();
      }
      const text = collapse(element.text);
      if (text) out.push(text);
      continue;
    }
    walk(element, out);
  }
}

export function htmlToText(html: string): { title: string; text: string } {
  const root = parse(html, { comment: false });
  const title = collapse(root.querySelector("title")?.text ?? "");
  const content =
    root.querySelector("main") ??
    root.querySelector("article") ??
    root.querySelector("body") ??
    root;
  const lines: string[] = [];
  walk(content, lines);
  return { title, text: lines.join("\n") };
}

/** Page addresses listed in a sitemap. */
export function sitemapUrls(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((match) =>
    match[1].replace(/&amp;/g, "&"),
  );
}
