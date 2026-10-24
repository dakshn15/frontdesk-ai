-- Helper functions for row level security policies. They live in `private`, which the
-- Supabase Data API doesn't expose. They're `security definer` so a policy on
-- memberships can read memberships without recursing into its own policy.
-- plpgsql bodies aren't checked at creation, so these can come before the tables.

create schema if not exists private;

create function private.is_member(ws uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  return exists (
    select 1 from public.memberships m
    where m.workspace_id = ws and m.user_id = (select auth.uid())
  );
end $$;

-- `roles` is text[] (not the enum) so this can be created before the enum exists.
create function private.has_role(ws uuid, roles text[]) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  return exists (
    select 1 from public.memberships m
    where m.workspace_id = ws
      and m.user_id = (select auth.uid())
      and m.role::text = any(roles)
  );
end $$;

create function private.shares_workspace(other uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  return exists (
    select 1
    from public.memberships mine
    join public.memberships theirs on theirs.workspace_id = mine.workspace_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = other
  );
end $$;
