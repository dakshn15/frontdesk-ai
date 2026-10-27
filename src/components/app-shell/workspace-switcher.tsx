"use client";

import { Check, ChevronsUpDown, Plus } from "lucide-react";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import type { WorkspaceRole } from "@/db/schema/enums";

const roleLabel: Record<WorkspaceRole, string> = {
  owner: "Owner",
  admin: "Admin",
  staff: "Staff",
};

export function WorkspaceSwitcher({
  current,
  workspaces,
}: {
  current: { slug: string; name: string; role: WorkspaceRole };
  workspaces: { slug: string; name: string; role: WorkspaceRole }[];
}) {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                aria-label={`Switch workspace, current: ${current.name}`}
              />
            }
          >
            <span
              aria-hidden
              className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground"
            >
              {current.name.charAt(0).toUpperCase()}
            </span>
            <span className="grid flex-1 text-left leading-tight">
              <span className="truncate font-medium">{current.name}</span>
              <span className="truncate text-xs text-muted-foreground">
                {roleLabel[current.role]}
              </span>
            </span>
            <ChevronsUpDown className="ml-auto" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-60">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
              {workspaces.map((workspace) => (
                <DropdownMenuItem
                  key={workspace.slug}
                  // A real request on every switch, so the proxy remembers the choice.
                  render={
                    <Link href={`/w/${workspace.slug}`} prefetch={false} />
                  }
                >
                  <span className="truncate">{workspace.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {roleLabel[workspace.role]}
                  </span>
                  <Check
                    className={
                      workspace.slug === current.slug ? "" : "invisible"
                    }
                  />
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/onboarding" />}>
              <Plus />
              New workspace
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
