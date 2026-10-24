import { requireMembership } from "@/lib/auth/session";

export default async function WorkspaceOverviewPage({
  params,
}: PageProps<"/w/[slug]">) {
  const { slug } = await params;
  const { membership } = await requireMembership(slug);
  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        {membership.workspace.name}
      </h1>
    </main>
  );
}
