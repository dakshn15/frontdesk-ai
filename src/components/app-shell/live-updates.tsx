"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

/**
 * Refreshes the page when this workspace's conversations or messages change. Realtime
 * applies row level security, so only rows this member can read arrive.
 */
export function InboxLiveUpdates({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 300);
    };
    const filter = `workspace_id=eq.${workspaceId}`;
    const channel = supabase
      .channel(`inbox:${workspaceId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations", filter },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter },
        refresh,
      )
      .subscribe();
    return () => {
      clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [router, workspaceId]);
  return null;
}

/** On every workspace page: a toast when a website chat starts waiting for a person. */
export function HandoffAlerts({
  workspaceId,
  slug,
}: {
  workspaceId: string;
  slug: string;
}) {
  const router = useRouter();
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`handoffs:${workspaceId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversations",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string;
            status: string;
            handoff_at: string | null;
          };
          // A fresh handoff: the status is needs_human and handoff_at was just set.
          const fresh =
            row.status === "needs_human" &&
            row.handoff_at !== null &&
            Date.now() - new Date(row.handoff_at).getTime() < 60_000;
          if (!fresh) return;
          router.refresh();
          toast("A website visitor needs a person.", {
            id: `handoff:${row.id}`,
            action: {
              label: "Open",
              onClick: () => router.push(`/w/${slug}/inbox/${row.id}`),
            },
          });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [router, slug, workspaceId]);
  return null;
}
