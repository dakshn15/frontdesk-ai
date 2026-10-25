import { describe, expect, it } from "vitest";
import { formatTimeOff } from "@/features/staff/format";

const chicago = "America/Chicago";
const at = (iso: string) => new Date(iso);

describe("formatTimeOff", () => {
  it("shows whole days as dates, in the business's time zone", () => {
    expect(
      formatTimeOff(
        at("2026-12-24T06:00:00Z"),
        at("2026-12-25T06:00:00Z"),
        chicago,
      ),
    ).toBe("Dec 24, 2026");
    expect(
      formatTimeOff(
        at("2026-12-24T06:00:00Z"),
        at("2026-12-27T06:00:00Z"),
        chicago,
      ),
    ).toBe("Dec 24 – Dec 26, 2026");
    expect(
      formatTimeOff(
        at("2026-12-31T06:00:00Z"),
        at("2027-01-03T06:00:00Z"),
        chicago,
      ),
    ).toBe("Dec 31, 2026 – Jan 2, 2027");
  });

  it("shows times when it isn't whole days", () => {
    expect(
      formatTimeOff(
        at("2026-12-24T19:00:00Z"),
        at("2026-12-24T23:30:00Z"),
        chicago,
      ),
    ).toBe("Dec 24, 2026, 1:00 PM – 5:30 PM");
    expect(
      formatTimeOff(
        at("2026-12-24T19:00:00Z"),
        at("2026-12-26T15:00:00Z"),
        chicago,
      ),
    ).toBe("Dec 24, 2026, 1:00 PM – Dec 26, 2026, 9:00 AM");
  });

  it("keeps whole days whole across a daylight-saving change", () => {
    // Chicago leaves daylight saving on 1 November 2026.
    expect(
      formatTimeOff(
        at("2026-10-31T05:00:00Z"),
        at("2026-11-02T06:00:00Z"),
        chicago,
      ),
    ).toBe("Oct 31 – Nov 1, 2026");
  });
});
