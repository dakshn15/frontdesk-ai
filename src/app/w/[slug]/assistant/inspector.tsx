import { TOOL_LABEL } from "@/features/inbox/constants";
import { FixAnswerDialog } from "./fix-answer-dialog";

export type Inspect = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
};

type ToolPart = {
  type: string;
  state?: string;
  input?: unknown;
  output?: unknown;
};

type Passage = {
  id: string;
  source: string;
  heading: string | null;
  content: string;
};

const CONFIDENCE = {
  high: "Matched the question's words",
  low: "Only matched by meaning, so it answers cautiously",
  none: "Nothing matched",
} as const;

/** Readable tool input without ids: "query: parking". */
function describeInput(input: unknown): string {
  if (!input || typeof input !== "object") return "";
  return Object.entries(input as Record<string, unknown>)
    .filter(([key]) => !key.endsWith("Id"))
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(", ");
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-2">
      <h3 className="text-xs font-semibold text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

/** How one reply was made: tools, passages, the verified answer, model, tokens and time. */
export function Inspector({
  slug,
  question,
  answer,
  parts,
  inspect,
}: {
  slug: string;
  question: string;
  answer: string;
  parts: ToolPart[];
  inspect?: Inspect;
}) {
  const tools = parts.filter((part) => part.type.startsWith("tool-"));
  const output = (name: string) =>
    tools.find(
      (part) =>
        part.type === `tool-${name}` && part.state === "output-available",
    )?.output as Record<string, unknown> | undefined;
  const verified = (
    output("find_verified_answer")?.answers as
      { question: string; answer: string }[] | undefined
  )?.[0];
  const search = output("search_knowledge") as
    { confidence: keyof typeof CONFIDENCE; passages: Passage[] } | undefined;

  return (
    <aside
      aria-label="How this answer was made"
      className="grid h-fit gap-5 rounded-xl border p-4 text-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">How this answer was made</h2>
        {answer ? (
          <FixAnswerDialog slug={slug} question={question} answer={answer} />
        ) : null}
      </div>

      {inspect ? (
        <dl className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <dt className="text-muted-foreground">Model</dt>
            <dd className="font-medium break-words">{inspect.model}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Tokens</dt>
            <dd className="font-medium tabular-nums">
              {inspect.inputTokens} in, {inspect.outputTokens} out
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Time</dt>
            <dd className="font-medium tabular-nums">
              {(inspect.latencyMs / 1000).toFixed(1)} s
            </dd>
          </div>
        </dl>
      ) : null}

      <Section title="Verified answer used">
        {verified ? (
          <div className="rounded-lg bg-muted p-2.5">
            <p className="font-medium">{verified.question}</p>
            <p className="mt-1 text-muted-foreground">{verified.answer}</p>
          </div>
        ) : (
          <p className="text-muted-foreground">None matched.</p>
        )}
      </Section>

      <Section title="Knowledge found">
        {search ? (
          <>
            <p className="text-muted-foreground">
              {CONFIDENCE[search.confidence]}.
            </p>
            {search.passages.length > 0 ? (
              <ul className="grid gap-2">
                {search.passages.slice(0, 3).map((passage) => (
                  <li key={passage.id} className="rounded-lg bg-muted p-2.5">
                    <p className="font-medium">
                      {passage.heading
                        ? `${passage.source} › ${passage.heading}`
                        : passage.source}
                    </p>
                    <p className="mt-1 line-clamp-3 text-muted-foreground">
                      {passage.content}
                    </p>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : (
          <p className="text-muted-foreground">It didn&apos;t search.</p>
        )}
      </Section>

      <Section title="Tools used">
        {tools.length > 0 ? (
          <ol className="grid gap-1.5">
            {tools.map((part, index) => {
              const name = part.type.slice("tool-".length);
              const dry = (part.output as { dryRun?: boolean } | undefined)
                ?.dryRun;
              return (
                <li key={`${name}-${index}`}>
                  <p className="font-medium">{TOOL_LABEL[name] ?? name}</p>
                  {describeInput(part.input) ? (
                    <p className="text-xs break-words text-muted-foreground">
                      {describeInput(part.input)}
                    </p>
                  ) : null}
                  {dry ? (
                    <p className="text-xs text-muted-foreground">
                      Dry run: nothing was saved or sent.
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="text-muted-foreground">None.</p>
        )}
      </Section>
    </aside>
  );
}
