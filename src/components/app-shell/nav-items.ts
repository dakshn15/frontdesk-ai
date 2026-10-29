import {
  BookOpen,
  FlaskConical,
  CalendarDays,
  ChartColumn,
  CreditCard,
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

export type NavGroup =
  "Front desk" | "Your business" | "Receptionist" | "Workspace";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** The sidebar section it sits in; sections keep the order of the list. */
  group: NavGroup;
};

export function navItems(slug: string, role: WorkspaceRole): NavItem[] {
  const base = `/w/${slug}`;
  const desk = "Front desk" as const;
  const business = "Your business" as const;
  const receptionist = "Receptionist" as const;
  const workspace = "Workspace" as const;
  const overview = {
    label: "Overview",
    href: base,
    icon: LayoutDashboard,
    group: desk,
  };
  const calendar = {
    label: "Calendar",
    href: `${base}/calendar`,
    icon: CalendarDays,
    group: desk,
  };
  const inbox = {
    label: "Inbox",
    href: `${base}/inbox`,
    icon: Inbox,
    group: desk,
  };
  const team = {
    label: "Team",
    href: `${base}/team`,
    icon: Users,
    group: workspace,
  };
  if (!canEditWorkspace(role)) return [overview, calendar, inbox, team];
  return [
    overview,
    calendar,
    inbox,
    {
      label: "Analytics",
      href: `${base}/analytics`,
      icon: ChartColumn,
      group: desk,
    },
    {
      label: "Services",
      href: `${base}/services`,
      icon: Tags,
      group: business,
    },
    { label: "Staff", href: `${base}/staff`, icon: UserRound, group: business },
    {
      label: "Opening hours",
      href: `${base}/hours`,
      icon: Clock,
      group: business,
    },
    {
      label: "Policies",
      href: `${base}/policies`,
      icon: ScrollText,
      group: business,
    },
    {
      label: "Answers",
      href: `${base}/answers`,
      icon: MessageSquareText,
      group: business,
    },
    {
      label: "Knowledge",
      href: `${base}/knowledge`,
      icon: BookOpen,
      group: business,
    },
    {
      label: "Test lab",
      href: `${base}/assistant`,
      icon: FlaskConical,
      group: receptionist,
    },
    {
      label: "Widget",
      href: `${base}/widget`,
      icon: MessageCircle,
      group: receptionist,
    },
    { label: "Emails", href: `${base}/emails`, icon: Mail, group: workspace },
    team,
    {
      label: "Billing",
      href: `${base}/billing`,
      icon: CreditCard,
      group: workspace,
    },
    {
      label: "Settings",
      href: `${base}/settings`,
      icon: Settings,
      group: workspace,
    },
  ];
}
