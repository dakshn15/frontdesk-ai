import { randomBytes, randomUUID } from "node:crypto";
import type { AuthClaims } from "@/db";
import type { WorkspaceRole } from "@/db/schema";
import {
  createInviteToken,
  inviteExpiresAt,
} from "@/features/team/invite-token";
import { adminAuth, asUser, testSql } from "./test-db";

export type TestUser = { id: string; email: string; password: string };

const createdUsers: string[] = [];
const createdWorkspaces: string[] = [];

export async function createTestUser(
  opts: { email?: string; fullName?: string; password?: string } = {},
): Promise<TestUser> {
  const email = opts.email ?? `test-${randomUUID()}@example.com`;
  const password = opts.password ?? "Password123!";
  const { data, error } = await adminAuth.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: opts.fullName ? { full_name: opts.fullName } : {},
  });
  if (error || !data.user) {
    throw new Error(`Could not create test user: ${error?.message}`);
  }
  createdUsers.push(data.user.id);
  return { id: data.user.id, email: data.user.email ?? email, password };
}

export function claimsFor(user: TestUser): AuthClaims {
  return { sub: user.id, email: user.email };
}

export async function createTestWorkspace(
  owner: TestUser,
  opts: { name?: string } = {},
): Promise<{ id: string; slug: string }> {
  const slug = `test-${randomBytes(4).toString("hex")}`;
  const name = opts.name ?? "Test Salon";
  const [row] = await asUser(
    owner.id,
    (tx) =>
      tx<
        { id: string }[]
      >`select private.create_workspace(${name}, ${slug}, null, 'America/Chicago', 'USD') as id`,
  );
  createdWorkspaces.push(row.id);
  return { id: row.id, slug };
}

export async function addTestMember(
  workspaceId: string,
  user: TestUser,
  role: WorkspaceRole,
): Promise<void> {
  await testSql`insert into public.memberships (workspace_id, user_id, role) values (${workspaceId}, ${user.id}, ${role})`;
}

/** Creates an invite as `invitedBy`, through row level security, and returns its raw token. */
export async function createTestInvite(
  workspaceId: string,
  invitedBy: TestUser,
  opts: { email: string; role: "admin" | "staff"; expiresAt?: Date },
): Promise<{ id: string; token: string }> {
  const { token, tokenHash } = createInviteToken();
  const expiresAt = opts.expiresAt ?? inviteExpiresAt(new Date());
  const [row] = await asUser(
    invitedBy.id,
    (tx) =>
      tx<{ id: string }[]>`
        insert into public.invitations (workspace_id, email, role, token_hash, invited_by, expires_at)
        values (${workspaceId}, ${opts.email.toLowerCase()}, ${opts.role}, ${tokenHash}, ${invitedBy.id}, ${expiresAt})
        returning id`,
  );
  return { id: row.id, token };
}

export function trackWorkspace(id: string): void {
  createdWorkspaces.push(id);
}

/** Deletes everything the helpers created. Workspaces go first, because a workspace's last owner can't be deleted. */
export async function cleanupTestData(): Promise<void> {
  const users = createdUsers.splice(0);
  const workspaces = createdWorkspaces.splice(0);
  if (workspaces.length || users.length) {
    await testSql`delete from public.workspaces where id = any(${workspaces}::uuid[]) or created_by = any(${users}::uuid[])`;
  }
  for (const id of users) await adminAuth.deleteUser(id);
}
