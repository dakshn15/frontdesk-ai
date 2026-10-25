import { describe, expect, it } from "vitest";
import { icsCalendar, icsText } from "@/lib/ics";

const NOW = new Date("2026-10-25T12:00:00Z");

describe("icsText", () => {
  it("escapes backslashes, commas, semicolons and newlines", () => {
    expect(icsText("Cut, colour; style\\more\nline two")).toBe(
      "Cut\\, colour\\; style\\\\more\\nline two",
    );
  });
});

describe("icsCalendar", () => {
  const event = {
    uid: "b1@frontdesk-ai",
    start: new Date("2026-11-02T15:00:00Z"),
    end: new Date("2026-11-02T16:00:00.500Z"),
    summary: "Cut, with Maya",
  };

  it("writes a calendar with CRLF line endings and UTC times", () => {
    const ics = icsCalendar({ method: "PUBLISH", events: [event], now: NOW });
    expect(ics.endsWith("\r\n")).toBe(true);
    const lines = ics.split("\r\n");
    expect(lines.slice(0, 5)).toEqual([
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//FrontDesk AI//Bookings//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
    ]);
    expect(lines).toContain("DTSTAMP:20261025T120000Z");
    expect(lines).toContain("DTSTART:20261102T150000Z");
    expect(lines).toContain("DTEND:20261102T160000Z");
    expect(lines).toContain("SUMMARY:Cut\\, with Maya");
    expect(lines).toContain("STATUS:CONFIRMED");
    expect(lines.at(-2)).toBe("END:VCALENDAR");
  });

  it("folds long lines at 75 bytes without splitting a character", () => {
    const ics = icsCalendar({
      method: "PUBLISH",
      events: [{ ...event, description: "é".repeat(100) }],
      now: NOW,
    });
    const lines = ics.split("\r\n");
    const start = lines.findIndex((line) => line.startsWith("DESCRIPTION:"));
    const folded = [lines[start]];
    for (let i = start + 1; lines[i].startsWith(" "); i += 1) {
      folded.push(lines[i]);
    }
    expect(folded.length).toBeGreaterThan(1);
    for (const line of folded) {
      expect(Buffer.byteLength(line, "utf8")).toBeLessThanOrEqual(75);
    }
    const unfolded = folded
      .map((line, i) => (i ? line.slice(1) : line))
      .join("");
    expect(unfolded).toBe(`DESCRIPTION:${"é".repeat(100)}`);
  });

  it("names a feed and marks cancelled events", () => {
    const ics = icsCalendar({
      method: "CANCEL",
      name: "Maya at Bloom",
      events: [{ ...event, status: "CANCELLED", sequence: 3 }],
      now: NOW,
    });
    expect(ics).toContain("X-WR-CALNAME:Maya at Bloom\r\n");
    expect(ics).toContain("STATUS:CANCELLED\r\n");
    expect(ics).toContain("SEQUENCE:3\r\n");
  });
});
