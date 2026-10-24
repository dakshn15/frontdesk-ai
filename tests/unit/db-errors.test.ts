import { describe, expect, it } from "vitest";
import { getPgError } from "@/db/errors";

describe("getPgError", () => {
  it("reads a Postgres error", () => {
    expect(getPgError({ code: "23505", message: "duplicate key" })).toEqual({
      code: "23505",
      message: "duplicate key",
    });
  });

  it("unwraps Drizzle's query error", () => {
    expect(
      getPgError({
        message: "Failed query",
        cause: { code: "P0001", message: "last_owner" },
      }),
    ).toEqual({ code: "P0001", message: "last_owner" });
  });

  it("returns null for anything else", () => {
    expect(getPgError(new Error("x"))).toBeNull();
    expect(getPgError("x")).toBeNull();
    expect(getPgError({ code: 42 })).toBeNull();
  });
});
