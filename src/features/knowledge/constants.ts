// Safe to import from client components.

export const ACCEPTED_FILES = ".pdf,.docx,.txt,.md,.markdown";

/** Vercel caps request bodies at 4.5 MB, so uploads stop at 4 MB. */
export const MAX_FILE_BYTES = 4 * 1024 * 1024;

export const KIND_LABEL = {
  file: "File",
  url: "Web page",
  sitemap: "Website",
  text: "Text",
} as const;

export const STATUS_LABEL = {
  queued: "Queued",
  processing: "Processing",
  ready: "Ready",
  failed: "Failed",
} as const;
