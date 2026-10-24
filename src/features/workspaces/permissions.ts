import type { WorkspaceRole } from "@/db/schema/enums";

// These mirror the row level security policies in the core_tables migration. They decide
// what the UI offers and let actions fail early with a clear message; the database still
// enforces every rule. "A workspace keeps at least one owner" lives only in the database.

const isManager = (role: WorkspaceRole) => role === "owner" || role === "admin";

export function canEditWorkspace(role: WorkspaceRole): boolean {
  return isManager(role);
}

export function canDeleteWorkspace(role: WorkspaceRole): boolean {
  return role === "owner";
}

export function canManageTeam(role: WorkspaceRole): boolean {
  return isManager(role);
}

/** Owners change anyone's role; admins change everyone except owners and can't make owners. */
export function canChangeRole(
  actor: WorkspaceRole,
  target: WorkspaceRole,
  next: WorkspaceRole,
): boolean {
  if (actor === "owner") return true;
  if (actor === "admin") return target !== "owner" && next !== "owner";
  return false;
}

/** Anyone can leave; owners remove anyone; admins remove everyone except owners. */
export function canRemoveMember(
  actor: WorkspaceRole,
  target: WorkspaceRole,
  isSelf: boolean,
): boolean {
  if (isSelf) return true;
  if (actor === "owner") return true;
  if (actor === "admin") return target !== "owner";
  return false;
}
