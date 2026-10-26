import { handleBook } from "@/privileged/widget/api";

/** Confirms a booking card the receptionist showed. */
export function POST(request: Request) {
  return handleBook(request);
}
