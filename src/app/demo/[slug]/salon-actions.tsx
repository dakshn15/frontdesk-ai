"use client";

import { LayoutDashboard, MessageCircle } from "lucide-react";

declare global {
  interface Window {
    FrontDesk?: { open: () => void; ask: (text: string) => void };
  }
}

/** Buttons that open the salon's chat, optionally asking a question straight away. */
export function AskButton({
  question,
  className,
  children,
}: {
  question?: string;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={className}
      onClick={() =>
        question ? window.FrontDesk?.ask(question) : window.FrontDesk?.open()
      }
    >
      {children}
    </button>
  );
}

export function OpenChatIcon() {
  return <MessageCircle aria-hidden className="size-4" />;
}

/**
 * The way from the salon's website to its dashboard. A full page load on purpose, so the
 * chat's iframe doesn't come along to the dashboard.
 */
export function DashboardLink({
  slug,
  timeLeft,
}: {
  slug: string;
  timeLeft: string;
}) {
  return (
    <div className="fixed bottom-4 left-4 z-40 flex max-w-[calc(100vw-8rem)] flex-col items-start gap-1">
      <a
        href={`/w/${slug}`}
        className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#2A1430] px-4 py-2.5 text-sm font-semibold text-white shadow-lg ring-1 ring-white/15 hover:bg-[#45233F] focus-visible:ring-4 focus-visible:ring-[#E8A93A] focus-visible:outline-none"
      >
        <LayoutDashboard aria-hidden className="size-4" />
        Open the dashboard
      </a>
      <p className="rounded-full bg-white/90 px-3 py-1 text-xs text-[#5A3A52] shadow-sm">
        Your private demo copy. Deleted in {timeLeft}.
      </p>
    </div>
  );
}
