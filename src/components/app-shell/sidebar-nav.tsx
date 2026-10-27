"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SidebarGroup,
  SidebarGroupContent,
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

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map(({ label, href, icon: Icon }) => (
            <SidebarMenuItem key={href}>
              <SidebarMenuButton
                isActive={isActive(href)}
                render={
                  <Link href={href} onClick={() => setOpenMobile(false)} />
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
  );
}
