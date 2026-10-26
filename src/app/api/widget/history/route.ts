import { handleHistory } from "@/privileged/widget/api";

/** The transcript of the visitor's conversation, after a reload. */
export function POST(request: Request) {
  return handleHistory(request);
}
