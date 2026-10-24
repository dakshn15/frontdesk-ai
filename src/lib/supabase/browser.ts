import { createBrowserClient } from "@supabase/ssr";
import { clientEnv } from "@/env/client";

/** Supabase client for Client Components. Auth only. */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
