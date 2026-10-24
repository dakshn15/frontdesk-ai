import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { listMyWorkspaces } from "@/features/workspaces/queries";
import { LAST_WORKSPACE_COOKIE, pickHomeWorkspace } from "@/lib/auth/home";
import { requireUser } from "@/lib/auth/session";

// Sends a signed-in user to the workspace they last used, or to onboarding when they have none.
export default async function DashboardPage() {
  const claims = await requireUser("/dashboard");
  const workspaces = await listMyWorkspaces(claims);
  const lastSlug = (await cookies()).get(LAST_WORKSPACE_COOKIE)?.value;
  const slug = pickHomeWorkspace(workspaces, lastSlug);
  if (!slug) redirect("/onboarding");
  redirect(`/w/${slug}`);
}
