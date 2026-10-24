/** Remembers the workspace someone last opened, so /dashboard takes them back there. */
export const LAST_WORKSPACE_COOKIE = "fd_last_workspace";

/** The last workspace if the user still belongs to it, else their first, else null. */
export function pickHomeWorkspace(
  workspaces: { slug: string }[],
  lastSlug: string | undefined,
): string | null {
  if (lastSlug && workspaces.some((w) => w.slug === lastSlug)) return lastSlug;
  return workspaces[0]?.slug ?? null;
}
