import { describe, expect, it } from "vitest";
import { mapSupabaseStatus, parseEnvOutput } from "../../scripts/supabase-env";

describe("parseEnvOutput", () => {
  it('parses KEY="value" lines', () => {
    expect(
      parseEnvOutput(
        'API_URL="http://127.0.0.1:54321"\nDB_URL="postgresql://x"\n',
      ),
    ).toEqual({
      API_URL: "http://127.0.0.1:54321",
      DB_URL: "postgresql://x",
    });
  });
});

describe("mapSupabaseStatus", () => {
  it("maps CLI names to app names", () => {
    expect(
      mapSupabaseStatus({
        API_URL: "http://a",
        DB_URL: "postgresql://d",
        PUBLISHABLE_KEY: "pk",
        SECRET_KEY: "sk",
        MAILPIT_URL: "http://m",
      }),
    ).toEqual({
      NEXT_PUBLIC_SUPABASE_URL: "http://a",
      DATABASE_URL: "postgresql://d",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "pk",
      SUPABASE_SECRET_KEY: "sk",
      MAILPIT_URL: "http://m",
      NEXT_PUBLIC_SITE_URL: "http://localhost:3300",
      NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: "false",
    });
  });

  it("falls back to legacy key names and the default mail URL", () => {
    const out = mapSupabaseStatus({
      API_URL: "http://a",
      DB_URL: "postgresql://d",
      ANON_KEY: "anon",
      SERVICE_ROLE_KEY: "service",
    });
    expect(out.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).toBe("anon");
    expect(out.SUPABASE_SECRET_KEY).toBe("service");
    expect(out.MAILPIT_URL).toBe("http://127.0.0.1:54324");
  });

  it("uses INBUCKET_URL when that's what the CLI prints", () => {
    expect(
      mapSupabaseStatus({
        API_URL: "http://a",
        DB_URL: "postgresql://d",
        ANON_KEY: "a",
        SERVICE_ROLE_KEY: "s",
        INBUCKET_URL: "http://i",
      }).MAILPIT_URL,
    ).toBe("http://i");
  });

  it("explains what to do when the stack isn't running", () => {
    expect(() => mapSupabaseStatus({})).toThrow(/npm run db:start/);
  });
});
