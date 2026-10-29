"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { useActionForm } from "@/components/forms/use-action-form";
import { Button } from "@/components/ui/button";
import { saveAiKey } from "@/features/assistant/actions";

const PROVIDERS = {
  openai: {
    label: "OpenAI",
    placeholder: "sk-...",
    where: "platform.openai.com → API keys",
  },
  google: {
    label: "Google Gemini",
    placeholder: "AIza...",
    where: "aistudio.google.com → Get API key",
  },
} as const;

type Provider = keyof typeof PROVIDERS;

function ProviderKeyForm({
  slug,
  provider,
  savedEnding,
  disabled,
}: {
  slug: string;
  provider: Provider;
  savedEnding: string | null;
  disabled: boolean;
}) {
  const { label, placeholder, where } = PROVIDERS[provider];
  const formRef = useRef<HTMLFormElement>(null);
  const { state, onSubmit, pending, fieldErrors, formError } = useActionForm(
    saveAiKey.bind(null, slug, provider),
  );

  useEffect(() => {
    if (!state?.ok) return;
    formRef.current?.reset();
    toast.success("Saved.");
  }, [state]);

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      className="grid gap-3 rounded-xl border p-4"
      noValidate
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-medium">{label}</h3>
        <span className="text-xs text-muted-foreground">
          {savedEnding ? `Saved key ending in ${savedEnding}` : "No key saved"}
        </span>
      </div>
      {formError ? <FormMessage tone="error">{formError}</FormMessage> : null}
      <Field
        label={savedEnding ? `Replace the ${label} key` : `${label} key`}
        name="key"
        type="password"
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        hint={`Find it at ${where}.`}
        errors={fieldErrors?.key}
        disabled={disabled}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          name="intent"
          value="save"
          className="h-10 w-fit px-4"
          disabled={disabled || pending}
        >
          Check and save
        </Button>
        {savedEnding ? (
          <Button
            type="submit"
            name="intent"
            value="remove"
            variant="outline"
            className="h-10 w-fit px-4"
            disabled={disabled || pending}
          >
            Remove key
          </Button>
        ) : null}
      </div>
    </form>
  );
}

export function AiKeysForm({
  slug,
  status,
  isDemo,
}: {
  slug: string;
  status: { canSave: boolean; openai: string | null; google: string | null };
  isDemo: boolean;
}) {
  const disabled = isDemo || !status.canSave;
  return (
    <div className="grid max-w-2xl gap-4">
      {isDemo ? (
        <FormMessage tone="success">
          This demo answers with FrontDesk AI&apos;s own key. In your own
          workspace, you paste your OpenAI or Gemini key here, and your
          receptionist answers with it.
        </FormMessage>
      ) : !status.canSave ? (
        <FormMessage tone="error">
          Saving AI keys isn&apos;t set up on this server yet.
        </FormMessage>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        <ProviderKeyForm
          slug={slug}
          provider="openai"
          savedEnding={status.openai}
          disabled={disabled}
        />
        <ProviderKeyForm
          slug={slug}
          provider="google"
          savedEnding={status.google}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
