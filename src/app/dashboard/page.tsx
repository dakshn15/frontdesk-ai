import { redirect } from "next/navigation";
import { listMyWorkspaces } from "@/features/workspaces/queries";
import { requireUser } from "@/lib/auth/session";

// Sends a signed-in user to their workspace, or to onboarding when they have none.
export default async function DashboardPage() {
  const claims = await requireUser("/dashboard");
  const workspaces = await listMyWorkspaces(claims);
  if (workspaces.length === 0) redirect("/onboarding");
  redirect(`/w/${workspaces[0].slug}`);
}
