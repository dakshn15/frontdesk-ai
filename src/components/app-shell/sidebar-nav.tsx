"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import type { WorkspaceRole } from "@/db/schema/enums";
import { navItems } from "./nav-items";

export function SidebarNav({
  slug,
  role,
  badges = {},
}: {
  slug: string;
  role: WorkspaceRole;
  badges?: Record<string, number>;
}) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const items = navItems(slug, role);
  // The overview is active only on its own page; other items also cover their sub-pages.
  const isActive = (href: string) =>
    href === `/w/${slug}`
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`);

  // One labelled section per group, in the order the items come.
  const groups = [...new Set(items.map((item) => item.group))];

  return (
    <>
      {groups.map((group) => (
        <SidebarGroup key={group} className="py-1">
          {groups.length > 1 ? (
            <SidebarGroupLabel className="text-[11px] font-medium tracking-wide text-muted-foreground">
              {group}
            </SidebarGroupLabel>
          ) : null}
          <SidebarGroupContent>
            <SidebarMenu>
              {items
                .filter((item) => item.group === group)
                .map(({ label, href, icon: Icon }) => (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton
                      isActive={isActive(href)}
                      className="data-active:bg-sidebar-accent data-active:font-medium data-active:text-sidebar-accent-foreground [&>svg]:text-sidebar-foreground/60 data-active:[&>svg]:text-primary"
                      render={
                        <Link
                          href={href}
                          onClick={() => setOpenMobile(false)}
                        />
                      }
                    >
                      <Icon />
                      <span>{label}</span>
                    </SidebarMenuButton>
                    {badges[href] ? (
                      <SidebarMenuBadge aria-label={`${badges[href]} waiting`}>
                        {badges[href]}
                      </SidebarMenuBadge>
                    ) : null}
                  </SidebarMenuItem>
                ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  );
}
