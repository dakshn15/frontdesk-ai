"use client";

import { Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Field, TextareaField } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { useActionForm } from "@/components/forms/use-action-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { addKnowledge } from "@/features/knowledge/actions";
import { ACCEPTED_FILES } from "@/features/knowledge/constants";
import { cn } from "@/lib/utils";

type Kind = "file" | "url" | "sitemap" | "text";

const KINDS: { kind: Kind; label: string }[] = [
  { kind: "file", label: "Upload a file" },
  { kind: "url", label: "Web page" },
  { kind: "sitemap", label: "Whole site" },
  { kind: "text", label: "Paste text" },
];

export function AddSourceDialog({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  // Stable, so the form's success effect runs once per result.
  const close = useCallback(() => setOpen(false), []);
  // A new key each time it opens gives a fresh form.
  const [session, setSession] = useState(0);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setSession((count) => count + 1);
      }}
    >
      <DialogTrigger render={<Button className="h-9 px-3" />}>
        <Plus />
        Add knowledge
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <AddSourceForm key={session} slug={slug} onDone={close} />
      </DialogContent>
    </Dialog>
  );
}

function AddSourceForm({ slug, onDone }: { slug: string; onDone: () => void }) {
  const [kind, setKind] = useState<Kind>("file");
  const { state, onSubmit, pending, fieldErrors, formError } = useActionForm(
    addKnowledge.bind(null, slug),
  );

  useEffect(() => {
    if (state?.ok) {
      toast.success("Added. We're reading it now.");
      onDone();
    }
  }, [state, onDone]);

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>Add knowledge</DialogTitle>
        <DialogDescription>
          The receptionist can search it once it&apos;s ready.
        </DialogDescription>
      </DialogHeader>
      {formError ? <FormMessage tone="error">{formError}</FormMessage> : null}

      <fieldset>
        <legend className="sr-only">What are you adding?</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {KINDS.map((option) => (
            <label
              key={option.kind}
              className={cn(
                "flex h-10 cursor-pointer items-center justify-center rounded-lg border px-2 text-center text-sm has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                kind === option.kind
                  ? "border-primary bg-primary-soft font-medium"
                  : "hover:bg-muted",
              )}
            >
              <input
                type="radio"
                name="kind"
                value={option.kind}
                checked={kind === option.kind}
                onChange={() => setKind(option.kind)}
                className="sr-only"
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      {kind === "file" ? (
        <Field
          key="file"
          label="File"
          name="file"
          type="file"
          accept={ACCEPTED_FILES}
          hint="PDF, Word, text or Markdown, up to 4 MB."
          className="h-10 pt-2"
          errors={fieldErrors?.file}
        />
      ) : kind === "text" ? null : (
        <Field
          key={kind}
          label={kind === "url" ? "Web address" : "Website address"}
          name="url"
          inputMode="url"
          placeholder={kind === "url" ? "bloom.com/about" : "bloom.com"}
          hint={
            kind === "sitemap"
              ? "We read the site's sitemap and up to 25 of its pages."
              : undefined
          }
          errors={fieldErrors?.url}
        />
      )}

      <Field
        label={kind === "text" ? "Title" : "Title (optional)"}
        name="title"
        placeholder={kind === "text" ? "About us" : undefined}
        hint={
          kind === "file"
            ? "Leave blank to use the file name."
            : kind === "text"
              ? undefined
              : "Leave blank to use the page's own title."
        }
        errors={fieldErrors?.title}
      />

      {kind === "text" ? (
        <TextareaField
          label="Text"
          name="content"
          rows={8}
          errors={fieldErrors?.content}
        />
      ) : null}

      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add knowledge"}
        </Button>
      </DialogFooter>
    </form>
  );
}
