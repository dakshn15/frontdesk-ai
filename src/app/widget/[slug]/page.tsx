import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { assistantReady } from "@/privileged/assistant/models";
import { chatAllowed } from "@/privileged/billing/limits";
import { getWidgetConfig } from "@/privileged/widget/guard";
import { WidgetChat } from "./widget-chat";

export const metadata: Metadata = {
  title: "Chat",
  robots: { index: false, follow: false },
};

/** The chat inside the iframe that /embed.js adds to a business's website. */
export default async function WidgetPage({
  params,
}: PageProps<"/widget/[slug]">) {
  const { slug } = await params;
  const config = await getWidgetConfig(slug);
  if (!config) notFound();

  return (
    <>
      {/* The page sits over the business's site: only the launcher and panel show. */}
      <style>{`:root, body { background: transparent !important; color-scheme: normal !important; }`}</style>
      <WidgetChat
        config={{
          slug: config.slug,
          business: config.name,
          assistantName: config.assistantName,
          timeZone: config.timeZone,
          color: config.color,
          greeting: config.greeting,
          suggestions: config.suggestions,
          position: config.position === "left" ? "left" : "right",
        }}
        // Without a live plan, visitors get the contact form instead of the AI.
        ready={assistantReady() && (await chatAllowed(config.id)).allowed}
      />
    </>
  );
}
