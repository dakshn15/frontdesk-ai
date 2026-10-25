export type TextChunk = { heading: string; content: string };

const HEADING_SEPARATOR = " › ";

/**
 * Splits Markdown-style text into chunks for search. Headings (# to ######) start sections,
 * and every chunk carries its heading path ("About us › Parking"). Long sections split on
 * paragraph boundaries, repeating the end of each chunk at the start of the next.
 */
export function chunkText(
  text: string,
  { maxChars = 2400, overlapChars = 300 } = {},
): TextChunk[] {
  const sections: { heading: string; lines: string[] }[] = [];
  const path: string[] = [];
  let current = { heading: "", lines: [] as string[] };

  for (const line of text.replace(/\r\n?/g, "\n").split("\n")) {
    const heading = /^(#{1,6})\s+(.+)$/.exec(line.trim());
    if (!heading) {
      current.lines.push(line);
      continue;
    }
    sections.push(current);
    const level = heading[1].length;
    path.length = level - 1;
    path[level - 1] = heading[2].trim();
    current = {
      heading: path.filter(Boolean).join(HEADING_SEPARATOR),
      lines: [],
    };
  }
  sections.push(current);

  return sections.flatMap(({ heading, lines }) =>
    splitSection(lines.join("\n"), maxChars, overlapChars).map((content) => ({
      heading,
      content,
    })),
  );
}

function splitSection(
  body: string,
  maxChars: number,
  overlapChars: number,
): string[] {
  const pieces = body
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    // A paragraph longer than a whole chunk is cut into chunk-sized pieces.
    .flatMap((paragraph) => {
      const cut: string[] = [];
      for (let i = 0; i < paragraph.length; i += maxChars) {
        cut.push(paragraph.slice(i, i + maxChars));
      }
      return cut;
    });

  const chunks: string[] = [];
  let current = "";
  for (const piece of pieces) {
    const joined = current ? `${current}\n\n${piece}` : piece;
    if (joined.length <= maxChars) {
      current = joined;
      continue;
    }
    chunks.push(current);
    const overlap = tail(current, overlapChars);
    const next = overlap ? `${overlap}\n\n${piece}` : piece;
    current = next.length <= maxChars ? next : piece;
  }
  if (current) chunks.push(current);
  return chunks;
}

/** The last whole paragraphs of a chunk that fit in `limit` characters. */
function tail(chunk: string, limit: number): string {
  const kept: string[] = [];
  let length = 0;
  for (const paragraph of chunk.split("\n\n").reverse()) {
    const added = length + paragraph.length + (kept.length ? 2 : 0);
    if (added > limit) break;
    kept.unshift(paragraph);
    length = added;
  }
  return kept.join("\n\n");
}
