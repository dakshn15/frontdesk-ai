"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import { startDemo } from "@/features/demo/actions";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Turnstile = {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
    },
  ) => string;
  reset: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

const TURNSTILE_SCRIPT =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/**
 * Signs the visitor in as a guest (Supabase anonymous sign-in, with Cloudflare Turnstile when
 * it's set up), makes their sandbox and takes them to the salon's website.
 */
export function StartDemo({
  turnstileSiteKey,
}: {
  turnstileSiteKey: string | null;
}) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const box = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    if (!turnstileSiteKey) return;
    function render() {
      if (!box.current || !window.turnstile || widgetId.current) return;
      widgetId.current = window.turnstile.render(box.current, {
        sitekey: turnstileSiteKey!,
        callback: setToken,
        "expired-callback": () => setToken(null),
      });
    }
    if (window.turnstile) return render();
    const script = document.createElement("script");
    script.src = TURNSTILE_SCRIPT;
    script.async = true;
    script.onload = render;
    document.head.appendChild(script);
  }, [turnstileSiteKey]);

  function start() {
    setError(null);
    if (turnstileSiteKey && !token) {
      setError("Complete the check above first.");
      return;
    }
    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        const signIn = await supabase.auth.signInAnonymously({
          options: { captchaToken: token ?? undefined },
        });
        if (signIn.error) {
          setError("The guest sign-in didn't work. Try again in a moment.");
          if (widgetId.current) window.turnstile?.reset(widgetId.current);
          setToken(null);
          return;
        }
      }
      const result = await startDemo();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/demo/${result.data.slug}`);
    });
  }

  return (
    <div className="grid gap-4">
      {turnstileSiteKey ? <div ref={box} /> : null}
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      <Button
        type="button"
        size="lg"
        className="w-fit px-4"
        onClick={start}
        disabled={pending}
      >
        {pending ? "Setting up your salon…" : "Start the demo"}
      </Button>
    </div>
  );
}
