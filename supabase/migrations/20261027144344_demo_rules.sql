-- Demo visitors sign in as Supabase anonymous users. They have no email, and they may only
-- use the sandbox the server made for them: no new workspaces, no joining others.

create index workspaces_demo_expires_idx on public.workspaces (demo_expires_at)
  where demo_expires_at is not null;

create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture')
  );
  return new;
end $$;

create or replace function private.sync_profile_email() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set email = coalesce(new.email, '') where id = new.id;
  return new;
end $$;

-- True for a signed-in anonymous (demo) user. Reads auth.users, not the token's claims.
create function private.is_anonymous_user() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select is_anonymous from auth.users where id = auth.uid()), false)
$$;
revoke execute on function private.is_anonymous_user() from public, anon, authenticated;

create or replace function private.create_workspace(
  p_name text, p_slug text, p_website text, p_timezone text, p_currency text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if private.is_anonymous_user() then raise exception 'anonymous_user'; end if;
  insert into public.workspaces (name, slug, website, timezone, currency, created_by)
  values (p_name, p_slug, nullif(p_website, ''), p_timezone, p_currency, v_user)
  returning id into v_id;
  insert into public.memberships (workspace_id, user_id, role) values (v_id, v_user, 'owner');
  insert into public.audit_log (workspace_id, actor_id, action, target_type, target_id)
  values (v_id, v_user, 'workspace.created', 'workspace', v_id);
  return v_id;
end $$;

create or replace function private.accept_invitation(p_token text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_email text;
  v_inv public.invitations%rowtype;
  v_slug text;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if private.is_anonymous_user() then raise exception 'anonymous_user'; end if;

  select * into v_inv from public.invitations
  where token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
  for update;

  if not found then raise exception 'invite_not_found'; end if;
  if v_inv.accepted_at is not null then raise exception 'invite_used'; end if;
  if v_inv.revoked_at is not null then raise exception 'invite_revoked'; end if;
  if v_inv.expires_at <= now() then raise exception 'invite_expired'; end if;

  -- Sign-up requires a confirmed email, so this proves the invitee owns the invited address.
  select email into v_email from auth.users where id = v_user;
  if lower(v_email) <> v_inv.email then raise exception 'invite_email_mismatch'; end if;

  -- An existing member keeps their current role.
  insert into public.memberships (workspace_id, user_id, role)
  values (v_inv.workspace_id, v_user, v_inv.role)
  on conflict (workspace_id, user_id) do nothing;

  update public.invitations set accepted_at = now(), accepted_by = v_user where id = v_inv.id;

  insert into public.audit_log (workspace_id, actor_id, action, target_type, target_id, metadata)
  values (v_inv.workspace_id, v_user, 'member.joined', 'invitation', v_inv.id,
          jsonb_build_object('role', v_inv.role));

  select slug into v_slug from public.workspaces where id = v_inv.workspace_id;
  return v_slug;
end $$;

-- A demo sandbox can't invite anyone.
create function private.refuse_demo_invitations() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from public.workspaces
    where id = new.workspace_id and demo_expires_at is not null
  ) then
    raise exception 'demo_workspace';
  end if;
  return new;
end $$;

create trigger refuse_demo_invitations before insert on public.invitations
  for each row execute function private.refuse_demo_invitations();
