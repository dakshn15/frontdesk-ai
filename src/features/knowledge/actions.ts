"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { withRls } from "@/db";
import { canAddKnowledge } from "@/privileged/billing/limits";
import { syncSource } from "@/jobs/knowledge";
import { getManagerContext } from "@/features/workspaces/manager-context";
import {
  type ActionResult,
  CHECK_FIELDS,
  fail,
  type FormState,
  NOT_ALLOWED,
  ok,
} from "@/lib/action-result";
import { parseFetchableUrl } from "@/lib/safe-url";
import { zodFieldErrors } from "@/lib/validation";
import { MAX_FILE_BYTES } from "./constants";
import { embedQuery } from "./embeddings";
import { ExtractError, extractText } from "./extract";
import {
  addSourceRecord,
  deleteSourceRecord,
  requeueSourceRecord,
} from "./records";
import type { NewSource } from "./records";
import { searchKnowledge } from "./search";

const MAX_TEXT = 500_000;

const titleField = z
  .string()
  .trim()
  .max(200, { error: "Use 200 characters or fewer." })
  .default("");

const textSchema = z.object({
  title: titleField.pipe(z.string().min(1, { error: "Add a title." })),
  content: z
    .string()
    .trim()
    .min(1, { error: "Paste some text." })
    .max(MAX_TEXT, { error: "Paste up to 500,000 characters." }),
});

const kindSchema = z.enum(["file", "url", "sitemap", "text"]);

function refresh(slug: string) {
  revalidatePath(`/w/${slug}/knowledge`);
}

/** Reads the form into a new source, or field errors. */
async function readSource(
  kind: z.infer<typeof kindSchema>,
  formData: FormData,
): Promise<NewSource | { errors: Record<string, string[]> }> {
  const title = titleField.safeParse(formData.get("title") ?? "");
  if (!title.success) return { errors: zodFieldErrors(title.error) };

  if (kind === "text") {
    const parsed = textSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { errors: zodFieldErrors(parsed.error) };
    return { kind, ...parsed.data };
  }

  if (kind === "url" || kind === "sitemap") {
    const url = parseFetchableUrl(String(formData.get("url") ?? ""));
    if (!url)
      return { errors: { url: ["Enter a web address like bloom.com/about."] } };
    const fallback = kind === "url" ? url.href : url.hostname;
    return { kind, url: url.href, title: title.data || fallback };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { errors: { file: ["Choose a file."] } };
  }
  if (file.size > MAX_FILE_BYTES)
    return { errors: { file: ["Files can be up to 4 MB."] } };
  try {
    const extracted = await extractText({
      name: file.name,
      type: file.type,
      bytes: new Uint8Array(await file.arrayBuffer()),
    });
    if (extracted.text.length > MAX_TEXT) {
      const tooLong =
        "That file has more text than we can keep (500,000 characters).";
      return { errors: { file: [tooLong] } };
    }
    return {
      kind,
      title: (title.data || extracted.title).slice(0, 200),
      fileName: file.name.slice(0, 255),
      content: extracted.text,
    };
  } catch (err) {
    if (err instanceof ExtractError) return { errors: { file: [err.message] } };
    throw err;
  }
}

export async function addKnowledge(
  slug: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await getManagerContext(slug);
  const kind = kindSchema.safeParse(formData.get("kind"));
  if (!context || !kind.success) return fail(NOT_ALLOWED);
  if (!(await canAddKnowledge(context.workspace.id)))
    return fail(
      "Your plan's knowledge limit is reached. Delete a source or upgrade your plan in Billing.",
    );
  const source = await readSource(kind.data, formData);
  if ("errors" in source) return fail(CHECK_FIELDS, source.errors);

  const result = await addSourceRecord(
    context.claims,
    context.workspace.id,
    source,
  );
  if (!result.ok) return fail(NOT_ALLOWED);
  // Process it after the response; the page refreshes until it's ready.
  after(() => syncSource(result.id));
  refresh(slug);
  return ok();
}

export async function resyncKnowledge(
  slug: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await getManagerContext(slug);
  const sourceId = z.uuid().safeParse(formData.get("sourceId"));
  if (!context || !sourceId.success) return fail(NOT_ALLOWED);
  const result = await requeueSourceRecord(
    context.claims,
    context.workspace.id,
    sourceId.data,
  );
  if (result !== "ok") return fail(NOT_ALLOWED);
  after(() => syncSource(sourceId.data));
  refresh(slug);
  return ok();
}

export async function deleteKnowledge(
  slug: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await getManagerContext(slug);
  const sourceId = z.uuid().safeParse(formData.get("sourceId"));
  if (!context || !sourceId.success) return fail(NOT_ALLOWED);
  const result = await deleteSourceRecord(
    context.claims,
    context.workspace.id,
    sourceId.data,
  );
  if (result !== "ok") return fail(NOT_ALLOWED);
  refresh(slug);
  return ok();
}

export type SearchResult = {
  chunkId: string;
  sourceTitle: string;
  heading: string;
  content: string;
  pageUrl: string | null;
};

/** The search the receptionist will use, for owners to try out. */
export async function previewSearch(
  slug: string,
  query: string,
): Promise<ActionResult<SearchResult[]>> {
  const context = await getManagerContext(slug);
  const text = z.string().trim().min(1).max(500).safeParse(query);
  if (!context || !text.success) return fail(NOT_ALLOWED);
  const queryEmbedding = await embedQuery(text.data);
  const passages = await withRls(context.claims, (tx) =>
    searchKnowledge(tx, context.workspace.id, text.data, { queryEmbedding }),
  );
  return ok(
    passages.map(({ chunkId, sourceTitle, heading, content, pageUrl }) => ({
      chunkId,
      sourceTitle,
      heading,
      content,
      pageUrl,
    })),
  );
}
