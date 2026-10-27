import type { Metadata } from "next";
import { FormMessage } from "@/components/forms/form-message";
import { requireManager } from "@/lib/auth/session";
import { assistantReady } from "@/privileged/assistant/models";
import { PreviewChat } from "./preview-chat";
import { TestLabTabs } from "./test-lab-tabs";

export const metadata: Metadata = { title: "Test lab" };

export default async function PlaygroundPage({
  params,
}: PageProps<"/w/[slug]/assistant">) {
  const { slug } = await params;
  const { membership } = await requireManager(slug);
  const { workspace } = membership;
  const ready = assistantReady();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 md:py-10">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Test lab
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Try your receptionist and see how each answer was made. It uses the same
        facts and knowledge customers see. Bookings, leads, emails and handoffs
        aren&apos;t saved or sent from here.
      </p>
      <TestLabTabs slug={workspace.slug} />
      {ready ? null : (
        <div className="mt-6">
          <FormMessage tone="error">
            The receptionist needs an AI key before it can answer. Add
            OPENAI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY in your hosting
            settings.
          </FormMessage>
        </div>
      )}
      <div className="mt-6">
        <PreviewChat
          slug={workspace.slug}
          assistantName={workspace.assistantName}
          disabled={!ready}
        />
      </div>
    </div>
  );
}
