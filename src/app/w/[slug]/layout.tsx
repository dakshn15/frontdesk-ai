import { AppSidebar } from "@/components/app-shell/app-sidebar";
import { HandoffAlerts } from "@/components/app-shell/live-updates";
import { Logo } from "@/components/brand/logo";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { getMyProfile } from "@/features/account/queries";
import { countWaiting } from "@/features/inbox/queries";
import { listMyWorkspaces } from "@/features/workspaces/queries";
import { requireMembership } from "@/lib/auth/session";

export default async function WorkspaceLayout({
  params,
  children,
}: LayoutProps<"/w/[slug]">) {
  const { slug } = await params;
  const { claims, membership } = await requireMembership(slug);
  const [workspaces, profile, waiting] = await Promise.all([
    listMyWorkspaces(claims),
    getMyProfile(claims),
    countWaiting(claims, membership.workspace.id),
  ]);

  return (
    <SidebarProvider>
      <HandoffAlerts
        workspaceId={membership.workspace.id}
        slug={membership.workspace.slug}
      />
      <AppSidebar
        current={{
          slug: membership.workspace.slug,
          name: membership.workspace.name,
          role: membership.role,
        }}
        workspaces={workspaces}
        user={{ fullName: profile.fullName, email: profile.email }}
        waiting={waiting}
      />
      <SidebarInset>
        <header className="flex h-14 items-center gap-2 border-b px-4 md:hidden">
          <SidebarTrigger />
          <Logo />
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
