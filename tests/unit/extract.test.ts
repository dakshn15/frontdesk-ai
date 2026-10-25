import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { ExtractError, extractText } from "@/features/knowledge/extract";

const bytes = (text: string) => new TextEncoder().encode(text);

async function docx(paragraphs: string[]): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
  );
  const body = paragraphs
    .map((p) => `<w:p><w:r><w:t>${p}</w:t></w:r></w:p>`)
    .join("");
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`,
  );
  return zip.generateAsync({ type: "uint8array" });
}

describe("extractText", () => {
  it("reads text and Markdown files as they are", async () => {
    expect(
      await extractText({
        name: "faq.md",
        type: "text/markdown",
        bytes: bytes("# FAQ\r\nWe open at 9."),
      }),
    ).toEqual({ title: "faq", text: "# FAQ\nWe open at 9." });
    expect(
      (await extractText({ name: "notes.txt", type: "", bytes: bytes("Hi") }))
        .text,
    ).toBe("Hi");
  });

  it("reads Word documents", async () => {
    const result = await extractText({
      name: "About Us.docx",
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      bytes: await docx(["Bloom is a salon.", "We have free parking."]),
    });
    expect(result.title).toBe("About Us");
    expect(result.text).toContain("Bloom is a salon.");
    expect(result.text).toContain("We have free parking.");
  });

  it("refuses unsupported, empty and broken files with a reason", async () => {
    await expect(
      extractText({ name: "photo.png", type: "image/png", bytes: bytes("x") }),
    ).rejects.toThrow(
      new ExtractError("Upload a PDF, Word, text or Markdown file."),
    );
    await expect(
      extractText({
        name: "empty.txt",
        type: "text/plain",
        bytes: bytes("  "),
      }),
    ).rejects.toThrow(new ExtractError("That file has no text in it."));
    await expect(
      extractText({
        name: "broken.pdf",
        type: "application/pdf",
        bytes: bytes("not a pdf"),
      }),
    ).rejects.toThrow(new ExtractError("We couldn't read that file."));
  });
});
