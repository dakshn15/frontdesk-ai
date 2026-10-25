import { htmlToText } from "./html-text";

/** A file we can't turn into text; the message is shown to the owner. */
export class ExtractError extends Error {}

const UNSUPPORTED = "Upload a PDF, Word, text or Markdown file.";
const UNREADABLE = "We couldn't read that file.";
const EMPTY = "That file has no text in it.";

function normalize(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function pdfText(bytes: Uint8Array): Promise<string> {
  const { extractText: readPdf, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(bytes);
  const { text } = await readPdf(pdf, { mergePages: true });
  return text;
}

async function docxText(bytes: Uint8Array): Promise<string> {
  const mammoth = await import("mammoth");
  const { value } = await mammoth.convertToHtml({
    buffer: Buffer.from(bytes),
  });
  return htmlToText(value).text;
}

/** The text of an uploaded file, with the file name (no extension) as its title. */
export async function extractText(file: {
  name: string;
  type: string;
  bytes: Uint8Array;
}): Promise<{ title: string; text: string }> {
  const extension = file.name.toLowerCase().split(".").pop() ?? "";
  const title = file.name.replace(/\.[^.]+$/, "").trim() || "Untitled";
  let raw: string;
  try {
    if (extension === "pdf" || file.type === "application/pdf") {
      raw = await pdfText(file.bytes);
    } else if (extension === "docx") {
      raw = await docxText(file.bytes);
    } else if (["txt", "md", "markdown"].includes(extension)) {
      raw = new TextDecoder().decode(file.bytes);
    } else {
      throw new ExtractError(UNSUPPORTED);
    }
  } catch (err) {
    if (err instanceof ExtractError) throw err;
    throw new ExtractError(UNREADABLE);
  }
  const text = normalize(raw);
  if (!text) throw new ExtractError(EMPTY);
  return { title, text };
}
