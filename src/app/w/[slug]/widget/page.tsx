import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getServerEnv } from "@/env/server";
import { getWidgetSettingsRecord } from "@/features/widget/records";
import { requireManager } from "@/lib/auth/session";
import { EmbedCode } from "./embed-code";
import { WidgetForm } from "./widget-form";

export const metadata: Metadata = { title: "Widget" };

export default async function WidgetPage({
  params,
}: PageProps<"/w/[slug]/widget">) {
  const { slug } = await params;
  const { claims, membership } = await requireManager(slug);
  const { workspace } = membership;
  const settings = await getWidgetSettingsRecord(claims, workspace.id);
  if (!settings) notFound();
  const site = getServerEnv().NEXT_PUBLIC_SITE_URL;
  const code = `<script src="${site}/embed.js" data-workspace="${workspace.slug}" async></script>`;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 md:py-10">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Widget
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        The chat that sits on your website. Visitors ask questions, book
        appointments and leave their details here.
      </p>

      <section aria-labelledby="embed" className="mt-8">
        <h2 id="embed" className="text-lg font-semibold">
          Add it to your website
        </h2>
        <p className="mt-1 mb-6 text-sm text-muted-foreground">
          Paste this just before the closing &lt;/body&gt; tag on every page
          where you want the chat.
        </p>
        <EmbedCode code={code} />
        <a
          href={`/widget/${workspace.slug}`}
          target="_blank"
          rel="noreferrer"
          className={buttonVariants({
            variant: "outline",
            className: "mt-3 h-9 px-3",
          })}
        >
          <ExternalLink />
          Try it
        </a>
      </section>

      <Separator className="my-10" />
      <section aria-labelledby="look">
        <h2 id="look" className="text-lg font-semibold">
          Look and websites
        </h2>
        <p className="mt-1 mb-6 text-sm text-muted-foreground">
          The chat uses the assistant name from Settings.
        </p>
        <WidgetForm slug={workspace.slug} settings={settings} />
      </section>
    </div>
  );
}
