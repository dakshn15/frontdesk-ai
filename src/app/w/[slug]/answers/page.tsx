import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import type { Metadata } from "next";
import { listAnswers } from "@/features/answers/queries";
import { requireManager } from "@/lib/auth/session";
import { AnswerDialog } from "./answer-dialog";
import { AnswersList } from "./answers-list";

export const metadata: Metadata = { title: "Verified answers" };

export default async function AnswersPage({
  params,
}: PageProps<"/w/[slug]/answers">) {
  const { slug } = await params;
  const { claims, membership } = await requireManager(slug);
  const { workspace } = membership;
  const answers = await listAnswers(claims, workspace.id);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 md:py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
          Verified answers
        </h1>
        <AnswerDialog slug={workspace.slug} />
      </div>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Questions you&apos;ve answered yourself. The receptionist uses these
        before anything else.
      </p>
      <AnswersList
        slug={workspace.slug}
        answers={answers.map((answer) => {
          const date = format(
            new TZDate(answer.updatedAt, workspace.timezone),
            "MMM d, yyyy",
          );
          return {
            id: answer.id,
            question: answer.question,
            answer: answer.answer,
            updated: answer.updatedByName
              ? `Updated ${date} by ${answer.updatedByName}`
              : `Updated ${date}`,
          };
        })}
      />
    </div>
  );
}
