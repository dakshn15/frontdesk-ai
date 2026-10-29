import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import {
  canDeleteWorkspace,
  canEditWorkspace,
} from "@/features/workspaces/permissions";
import { requireMembership } from "@/lib/auth/session";
import { currencyOptions, timeZoneOptions } from "@/lib/locale-options";
import { aiKeyStatus } from "@/privileged/ai-keys";
import { AiKeysForm } from "./ai-keys-form";
import { BookingRulesForm } from "./booking-rules-form";
import { ReceptionistForm } from "./receptionist-form";
import { BusinessDetailsForm } from "./business-details-form";
import { DeleteWorkspaceDialog } from "./delete-workspace-dialog";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage({
  params,
}: PageProps<"/w/[slug]/settings">) {
  const { slug } = await params;
  const { membership } = await requireMembership(slug);
  if (!canEditWorkspace(membership.role)) notFound();
  const { workspace } = membership;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 md:py-10">
      <h1 className="text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
        Settings
      </h1>

      <section className="mt-8" aria-labelledby="business-details">
        <h2 id="business-details" className="text-lg font-semibold">
          Business details
        </h2>
        <p className="mt-1 mb-6 text-sm text-muted-foreground">
          Your receptionist uses these to answer questions and show times.
        </p>
        <BusinessDetailsForm
          slug={workspace.slug}
          details={workspace}
          timeZones={timeZoneOptions()}
          currencies={currencyOptions()}
        />
      </section>

      <Separator className="my-10" />
      <section aria-labelledby="receptionist">
        <h2 id="receptionist" className="text-lg font-semibold">
          Receptionist
        </h2>
        <p className="mt-1 mb-6 text-sm text-muted-foreground">
          How the AI receptionist introduces itself, and which AI answers.
        </p>
        <ReceptionistForm
          slug={workspace.slug}
          assistantName={workspace.assistantName}
          aiProvider={workspace.aiProvider}
        />
      </section>

      <Separator className="my-10" />
      <section aria-labelledby="ai-keys" className="scroll-mt-20">
        <h2 id="ai-keys" className="text-lg font-semibold">
          AI keys
        </h2>
        <p className="mt-1 mb-6 max-w-2xl text-sm text-muted-foreground">
          Your receptionist answers with your own OpenAI or Google Gemini
          account, so you pay the provider directly for what it uses. Keys are
          checked with the provider, stored encrypted, and never shown again.
          With both saved, the other one answers if your chosen provider is
          down. An OpenAI key also turns on meaning-based search of your
          documents.
        </p>
        <AiKeysForm
          slug={workspace.slug}
          status={await aiKeyStatus(workspace.id)}
          isDemo={workspace.demoExpiresAt !== null}
        />
      </section>

      <Separator className="my-10" />
      <section aria-labelledby="booking-rules">
        <h2 id="booking-rules" className="text-lg font-semibold">
          Booking rules
        </h2>
        <p className="mt-1 mb-6 text-sm text-muted-foreground">
          How customers can book, cancel and move appointments themselves.
        </p>
        <BookingRulesForm slug={workspace.slug} rules={workspace} />
      </section>

      {canDeleteWorkspace(membership.role) ? (
        <>
          <Separator className="my-10" />
          <section aria-labelledby="danger-zone">
            <h2 id="danger-zone" className="text-lg font-semibold">
              Danger zone
            </h2>
            <p className="mt-1 mb-6 text-sm text-muted-foreground">
              Deleting the workspace removes the team and all of its data.
            </p>
            <DeleteWorkspaceDialog
              slug={workspace.slug}
              name={workspace.name}
            />
          </section>
        </>
      ) : null}
    </div>
  );
}
