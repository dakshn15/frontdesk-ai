-- Row level security policies decide who may update a row; these grants decide which
-- columns they may change. Supabase grants UPDATE on every column by default, which let an
-- owner hand a membership to another user, or an admin change a workspace's URL or creator
-- or rewrite an invite. Each table now allows only the columns the app actually edits.
-- A new column is read-only for users until a grant here adds it.

revoke update on public.workspaces from authenticated, anon;
grant update (name, website, timezone, currency, updated_at)
  on public.workspaces to authenticated;

-- Only the role changes; who the membership belongs to and where it lives never do.
revoke update on public.memberships from authenticated, anon;
grant update (role) on public.memberships to authenticated;

-- Managers can only revoke an invite. Accepting happens in private.accept_invitation.
revoke update on public.invitations from authenticated, anon;
grant update (revoked_at) on public.invitations to authenticated;

-- The audit log is append-only (it has no update policy either).
revoke update on public.audit_log from authenticated, anon;
