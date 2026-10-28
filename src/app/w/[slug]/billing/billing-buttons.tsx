"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { manageBilling, subscribe } from "@/features/billing/actions";

/** Opens a Stripe page (Checkout or the Customer Portal) from a server action's URL. */
function useStripeRedirect() {
  const [pending, startTransition] = useTransition();
  function go(
    action: () => Promise<
      { ok: true; data: { url: string } } | { ok: false; error: string }
    >,
  ) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      window.location.href = result.data.url;
    });
  }
  return { pending, go };
}

export function SubscribeButton({
  slug,
  plan,
  label,
  disabled,
}: {
  slug: string;
  plan: "starter" | "pro";
  label: string;
  disabled: boolean;
}) {
  const { pending, go } = useStripeRedirect();
  return (
    <Button
      type="button"
      className="h-10 w-full"
      disabled={disabled || pending}
      onClick={() => go(() => subscribe(slug, plan))}
    >
      {pending ? "Opening checkout…" : label}
    </Button>
  );
}

export function ManageBillingButton({
  slug,
  disabled,
}: {
  slug: string;
  disabled: boolean;
}) {
  const { pending, go } = useStripeRedirect();
  return (
    <Button
      type="button"
      variant="outline"
      className="h-10 px-4"
      disabled={disabled || pending}
      onClick={() => go(() => manageBilling(slug))}
    >
      {pending ? "Opening…" : "Manage billing"}
    </Button>
  );
}
