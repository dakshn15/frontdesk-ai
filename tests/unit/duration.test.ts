import { expect, it } from "vitest";
import { formatDuration } from "@/lib/duration";

it.each([
  [45, "45 min"],
  [60, "1 hr"],
  [90, "1 hr 30 min"],
  [180, "3 hr"],
])("formatDuration(%i) is %s", (minutes, expected) => {
  expect(formatDuration(minutes)).toBe(expected);
});
