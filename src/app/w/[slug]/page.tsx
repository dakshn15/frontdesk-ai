import type { Metadata } from "next";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { countMembers } from "@/features/team/queries";
import { requireMembership } from "@/lib/auth/session";

export async function generateMetadata({
  params,
}: PageProps<"/w/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const { membership } = await requireMembership(slug);
  return { title: membership.workspace.name };
}

export default async function WorkspaceOverviewPage({
  params,
}: PageProps<"/w/[slug]">) {
  const { slug } = await params;
  const { claims, membership } = await requireMembership(slug);
  const { workspace, role } = membership;
  const members = await countMembers(claims, workspace.id);
  const canEdit = role === "owner" || role === "admin";

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 md:py-10">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Welcome to {workspace.name}
      </h1>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Business details</CardTitle>
            <CardDescription>
              What your receptionist knows about the business.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Website</dt>
              <dd className="truncate">
                {workspace.website ?? "No website yet"}
              </dd>
              <dt className="text-muted-foreground">Time zone</dt>
              <dd>{workspace.timezone.replaceAll("_", " ")}</dd>
              <dt className="text-muted-foreground">Currency</dt>
              <dd>{workspace.currency}</dd>
            </dl>
          </CardContent>
          {canEdit ? (
            <CardFooter>
              <Link
                href={`/w/${workspace.slug}/settings`}
                className="text-sm font-medium text-primary"
              >
                Edit details
              </Link>
            </CardFooter>
          ) : null}
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Team</CardTitle>
            <CardDescription>
              {members === 1 ? "1 member" : `${members} members`}
            </CardDescription>
          </CardHeader>
          <CardFooter className="mt-auto">
            <Link
              href={`/w/${workspace.slug}/team`}
              className="text-sm font-medium text-primary"
            >
              Manage team
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
