import {
  BookOpen,
  FlaskConical,
  CalendarDays,
  Clock,
  Inbox,
  LayoutDashboard,
  Mail,
  MessageCircle,
  type LucideIcon,
  MessageSquareText,
  ScrollText,
  Settings,
  Tags,
  UserRound,
  Users,
} from "lucide-react";
import type { WorkspaceRole } from "@/db/schema/enums";
import { canEditWorkspace } from "@/features/workspaces/permissions";

export type NavItem = { label: string; href: string; icon: LucideIcon };

export function navItems(slug: string, role: WorkspaceRole): NavItem[] {
  const base = `/w/${slug}`;
  const overview = { label: "Overview", href: base, icon: LayoutDashboard };
  const calendar = {
    label: "Calendar",
    href: `${base}/calendar`,
    icon: CalendarDays,
  };
  const inbox = { label: "Inbox", href: `${base}/inbox`, icon: Inbox };
  const team = { label: "Team", href: `${base}/team`, icon: Users };
  if (!canEditWorkspace(role)) return [overview, calendar, inbox, team];
  return [
    overview,
    calendar,
    inbox,
    { label: "Services", href: `${base}/services`, icon: Tags },
    { label: "Staff", href: `${base}/staff`, icon: UserRound },
    { label: "Opening hours", href: `${base}/hours`, icon: Clock },
    { label: "Policies", href: `${base}/policies`, icon: ScrollText },
    { label: "Answers", href: `${base}/answers`, icon: MessageSquareText },
    { label: "Knowledge", href: `${base}/knowledge`, icon: BookOpen },
    { label: "Test lab", href: `${base}/assistant`, icon: FlaskConical },
    { label: "Widget", href: `${base}/widget`, icon: MessageCircle },
    { label: "Emails", href: `${base}/emails`, icon: Mail },
    team,
    { label: "Settings", href: `${base}/settings`, icon: Settings },
  ];
}
