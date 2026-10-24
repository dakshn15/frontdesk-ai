import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar";
import type { WorkspaceRole } from "@/db/schema/enums";
import { SidebarNav } from "./sidebar-nav";
import { UserMenu } from "./user-menu";
import { WorkspaceSwitcher } from "./workspace-switcher";

type WorkspaceSummary = { slug: string; name: string; role: WorkspaceRole };

export function AppSidebar({
  current,
  workspaces,
  user,
}: {
  current: WorkspaceSummary;
  workspaces: WorkspaceSummary[];
  user: { fullName: string; email: string };
}) {
  return (
    <Sidebar>
      <SidebarHeader>
        <WorkspaceSwitcher current={current} workspaces={workspaces} />
      </SidebarHeader>
      <SidebarContent>
        <SidebarNav slug={current.slug} role={current.role} />
      </SidebarContent>
      <SidebarFooter>
        <UserMenu fullName={user.fullName} email={user.email} />
      </SidebarFooter>
    </Sidebar>
  );
}
