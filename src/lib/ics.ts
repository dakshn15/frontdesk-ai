// Minimal iCalendar (RFC 5545) writer for booking emails and staff calendar feeds.

export type IcsEvent = {
  uid: string;
  start: Date;
  end: Date;
  summary: string;
  description?: string;
  location?: string;
  status?: "CONFIRMED" | "CANCELLED";
  sequence?: number;
};

/** Escapes text values: backslash, semicolon, comma and newlines. */
export function icsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** 2026-11-02T15:00:00.000Z → 20261102T150000Z (seconds are dropped below that). */
function icsTime(date: Date): string {
  return `${date.toISOString().slice(0, 19).replace(/[-:]/g, "")}Z`;
}

/** Splits a line into pieces of at most 75 bytes, never inside a character. */
function fold(line: string): string[] {
  const pieces: string[] = [];
  let current = "";
  let bytes = 0;
  for (const char of line) {
    const size = Buffer.byteLength(char, "utf8");
    // Continuation lines start with a space, which counts toward their 75 bytes.
    const limit = pieces.length === 0 ? 75 : 74;
    if (bytes + size > limit) {
      pieces.push(current);
      current = "";
      bytes = 0;
    }
    current += char;
    bytes += size;
  }
  pieces.push(current);
  return pieces.map((piece, i) => (i === 0 ? piece : ` ${piece}`));
}

export function icsCalendar(input: {
  method: "PUBLISH" | "CANCEL";
  name?: string;
  events: IcsEvent[];
  now: Date;
}): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//FrontDesk AI//Bookings//EN",
    "CALSCALE:GREGORIAN",
    `METHOD:${input.method}`,
  ];
  if (input.name) lines.push(`X-WR-CALNAME:${icsText(input.name)}`);
  for (const event of input.events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.uid}`,
      `DTSTAMP:${icsTime(input.now)}`,
      `DTSTART:${icsTime(event.start)}`,
      `DTEND:${icsTime(event.end)}`,
      `SUMMARY:${icsText(event.summary)}`,
    );
    if (event.description) {
      lines.push(`DESCRIPTION:${icsText(event.description)}`);
    }
    if (event.location) lines.push(`LOCATION:${icsText(event.location)}`);
    lines.push(
      `STATUS:${event.status ?? "CONFIRMED"}`,
      `SEQUENCE:${event.sequence ?? 0}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return `${lines.flatMap(fold).join("\r\n")}\r\n`;
}
