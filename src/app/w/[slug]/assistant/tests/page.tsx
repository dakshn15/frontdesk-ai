import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { describeChecks } from "@/features/testlab/describe";
import {
  listQuestionsToReview,
  listRuns,
  listTests,
} from "@/features/testlab/queries";
import { MAX_TESTS } from "@/features/testlab/schemas";
import { requireManager } from "@/lib/auth/session";
import { TestLabTabs } from "../test-lab-tabs";
import {
  DeleteTestDialog,
  RefreshWhileRunning,
  RunTestsButton,
} from "./test-controls";
import { TestDialog } from "./test-dialog";

export const metadata: Metadata = { title: "Tests" };

// "Run all tests" keeps working after the response, one question at a time.
export const maxDuration = 300;

export default async function TestsPage({
  params,
}: PageProps<"/w/[slug]/assistant/tests">) {
  const { slug } = await params;
  const { claims, membership } = await requireManager(slug);
  const { workspace } = membership;
  const [tests, runs, review] = await Promise.all([
    listTests(claims, workspace.id),
    listRuns(claims, workspace.id),
    listQuestionsToReview(claims, workspace.id),
  ]);
  const when = (at: Date) =>
    format(new TZDate(at, workspace.timezone), "MMM d, h:mm a");
  const running = runs.some((run) => run.status === "running");

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 md:py-10">
      <RefreshWhileRunning running={running} />
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Test lab
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Questions you want the receptionist to keep getting right. Run them
        after changing your answers or knowledge, and see what broke and why.
      </p>
      <TestLabTabs slug={workspace.slug} />

      <section aria-labelledby="tests-title" className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="tests-title" className="text-lg font-semibold">
            Tests{" "}
            <span className="text-sm font-normal text-muted-foreground">
              {tests.length} of {MAX_TESTS}
            </span>
          </h2>
          <div className="flex gap-2">
            <RunTestsButton
              slug={workspace.slug}
              disabled={tests.length === 0}
            />
            <TestDialog slug={workspace.slug} />
          </div>
        </div>
        {tests.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
            No tests yet. Add a question customers ask, and what a good answer
            does.
          </p>
        ) : (
          <ul aria-label="Tests" className="mt-4 divide-y rounded-xl border">
            {tests.map((test) => (
              <li
                key={test.id}
                className="flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3"
              >
                <div className="min-w-0 flex-1 basis-72">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{test.question}</p>
                    {test.mustPass ? <Badge>Must pass</Badge> : null}
                  </div>
                  <ul className="mt-1.5 flex flex-wrap gap-1">
                    {describeChecks(test.checks).map((check) => (
                      <li key={check}>
                        <Badge variant="outline" className="font-normal">
                          {check}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex gap-1">
                  <TestDialog slug={workspace.slug} test={test} />
                  <DeleteTestDialog
                    slug={workspace.slug}
                    testId={test.id}
                    question={test.question}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        <section aria-labelledby="runs-title">
          <h2 id="runs-title" className="text-lg font-semibold">
            Past runs
          </h2>
          {runs.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              No runs yet. Results stay here so you can see quality over time.
            </p>
          ) : (
            <ul
              aria-label="Past runs"
              className="mt-4 divide-y rounded-xl border"
            >
              {runs.map((run) => (
                <li key={run.id}>
                  <Link
                    href={`/w/${workspace.slug}/assistant/runs/${run.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-muted/50"
                  >
                    <span>{when(run.startedAt)}</span>
                    {run.status === "running" ? (
                      <Badge variant="secondary">
                        Running, {run.passed + run.failed} of {run.total}
                      </Badge>
                    ) : run.status === "failed" ? (
                      <Badge variant="destructive">Didn&apos;t finish</Badge>
                    ) : (
                      <Badge variant={run.failed ? "destructive" : "secondary"}>
                        {run.passed} of {run.total} passed
                      </Badge>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="review-title">
          <h2 id="review-title" className="text-lg font-semibold">
            Questions to review
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            From website chats in the last 30 days, where your knowledge
            didn&apos;t have a clear answer.
          </p>
          {review.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Nothing to review.
            </p>
          ) : (
            <ul
              aria-label="Questions to review"
              className="mt-4 divide-y rounded-xl border"
            >
              {review.map((item) => (
                <li
                  key={`${item.conversationId}:${item.question}`}
                  className="flex flex-wrap items-start justify-between gap-2 px-4 py-3"
                >
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="text-sm font-medium">{item.question}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.confidence === "none"
                        ? "Nothing found"
                        : "Only a loose match"}{" "}
                      ·{" "}
                      <Link
                        href={`/w/${workspace.slug}/inbox/${item.conversationId}`}
                        className="underline"
                      >
                        Open the chat
                      </Link>
                    </p>
                  </div>
                  <TestDialog slug={workspace.slug} question={item.question} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
