import {
  LayoutDashboard,
  type LucideIcon,
  Settings,
  Users,
} from "lucide-react";
import type { WorkspaceRole } from "@/db/schema/enums";
import { canEditWorkspace } from "@/features/workspaces/permissions";

export type NavItem = { label: string; href: string; icon: LucideIcon };

export function navItems(slug: string, role: WorkspaceRole): NavItem[] {
  const base = `/w/${slug}`;
  const items: NavItem[] = [
    { label: "Overview", href: base, icon: LayoutDashboard },
    { label: "Team", href: `${base}/team`, icon: Users },
  ];
  if (canEditWorkspace(role)) {
    items.push({ label: "Settings", href: `${base}/settings`, icon: Settings });
  }
  return items;
}
