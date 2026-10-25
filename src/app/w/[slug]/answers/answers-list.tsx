"use client";

import { Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { useActionForm } from "@/components/forms/use-action-form";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteAnswer } from "@/features/answers/actions";
import { AnswerDialog } from "./answer-dialog";

type Answer = { id: string; question: string; answer: string; updated: string };

export function AnswersList({
  slug,
  answers,
}: {
  slug: string;
  answers: Answer[];
}) {
  const [query, setQuery] = useState("");

  if (answers.length === 0) {
    return (
      <p className="mt-8 rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
        No verified answers yet.
      </p>
    );
  }

  const needle = query.trim().toLowerCase();
  const shown = needle
    ? answers.filter(
        (a) =>
          a.question.toLowerCase().includes(needle) ||
          a.answer.toLowerCase().includes(needle),
      )
    : answers;

  return (
    <div className="mt-8 grid gap-4">
      <div className="relative max-w-sm">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          aria-label="Search answers"
          placeholder="Search answers"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="h-10 pl-9"
        />
      </div>

      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          No answers match &ldquo;{query.trim()}&rdquo;.
        </p>
      ) : (
        <ul
          aria-label="Verified answers"
          className="divide-y rounded-xl border"
        >
          {shown.map((answer) => (
            <li
              key={answer.id}
              className="flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3"
            >
              <div className="min-w-0 flex-1 basis-64">
                <p className="font-medium">{answer.question}</p>
                <p className="mt-0.5 text-sm whitespace-pre-line">
                  {answer.answer}
                </p>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {answer.updated}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <AnswerDialog slug={slug} answer={answer} />
                <DeleteAnswerButton slug={slug} answer={answer} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DeleteAnswerButton({
  slug,
  answer,
}: {
  slug: string;
  answer: Answer;
}) {
  const { onSubmit, pending, formError } = useActionForm(
    deleteAnswer.bind(null, slug),
  );
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="h-9"
            aria-label={`Delete answer: ${answer.question}`}
          />
        }
      >
        <Trash2 />
        Delete
      </AlertDialogTrigger>
      <AlertDialogContent>
        <form onSubmit={onSubmit} className="grid gap-4">
          <input type="hidden" name="answerId" value={answer.id} />
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this answer?</AlertDialogTitle>
            <AlertDialogDescription>
              The receptionist stops using it right away.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {formError ? (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button type="submit" variant="destructive" disabled={pending}>
              Delete
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
