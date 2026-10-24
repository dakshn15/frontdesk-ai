import { describe, expect, it } from "vitest";
import { parseClientEnv, parseServerEnv } from "@/env/schema";

const full = {
  DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x",
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000/",
};

describe("parseServerEnv", () => {
  it("parses a complete environment and applies defaults", () => {
    const env = parseServerEnv(full);
    expect(env.NEXT_PUBLIC_SITE_URL).toBe("http://localhost:3000");
    expect(env.DB_POOL_MAX).toBe(5);
    expect(env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED).toBe(false);
  });

  it("reads the Google flag and pool size", () => {
    const env = parseServerEnv({
      ...full,
      NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: "true",
      DB_POOL_MAX: "1",
    });
    expect(env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED).toBe(true);
    expect(env.DB_POOL_MAX).toBe(1);
  });

  it("names every missing variable in one error", () => {
    expect(() => parseServerEnv({})).toThrow(
      /DATABASE_URL[\s\S]*NEXT_PUBLIC_SUPABASE_URL[\s\S]*NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY[\s\S]*NEXT_PUBLIC_SITE_URL/,
    );
  });
});

describe("parseClientEnv", () => {
  it("keeps server values out of the client env", () => {
    expect(parseClientEnv(full)).not.toHaveProperty("DATABASE_URL");
  });
});
