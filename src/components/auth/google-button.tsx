"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function GoogleButton({ next }: { next: string }) {
  const [pending, setPending] = useState(false);
  async function continueWithGoogle() {
    setPending(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) setPending(false);
  }
  return (
    <Button
      type="button"
      variant="outline"
      className="h-10 w-full"
      disabled={pending}
      onClick={continueWithGoogle}
    >
      Continue with Google
    </Button>
  );
}

export function OrDivider() {
  return (
    <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
      <span className="h-px flex-1 bg-border" />
      or
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
