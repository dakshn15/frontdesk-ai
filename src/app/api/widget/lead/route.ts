import { handleLead } from "@/privileged/widget/api";

/** Saves a visitor's contact details for the team. */
export function POST(request: Request) {
  return handleLead(request);
}
