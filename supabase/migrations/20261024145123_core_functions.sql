-- Triggers, the workspace creation function and grants for the core tables.

-- Profiles follow auth.users.
create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture')
  );
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

create function private.sync_profile_email() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end $$;

create trigger on_auth_user_email_changed after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function private.sync_profile_email();

-- Users may edit only their own name and avatar; the email always comes from auth.users.
revoke update on public.profiles from authenticated, anon;
grant update (full_name, avatar_url, updated_at) on public.profiles to authenticated;

-- Time zones must be real. Postgres raises invalid_parameter_value (22023) for unknown zones.
create function private.validate_workspace() returns trigger
language plpgsql set search_path = '' as $$
begin
  perform now() at time zone new.timezone;
  return new;
end $$;

create trigger validate_workspace before insert or update of timezone on public.workspaces
  for each row execute function private.validate_workspace();

-- A workspace always keeps an owner. Locking the workspace row serialises owner changes,
-- so two owners can't step down at the same moment. `found` is false while the whole
-- workspace is being deleted, so its cascade isn't blocked.
create function private.ensure_workspace_has_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.role = 'owner' and (tg_op = 'DELETE' or new.role <> 'owner') then
    perform 1 from public.workspaces where id = old.workspace_id for update;
    if found and not exists (
      select 1 from public.memberships m
      where m.workspace_id = old.workspace_id and m.role = 'owner' and m.id <> old.id
    ) then
      raise exception 'last_owner';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

create trigger ensure_workspace_has_owner before update of role or delete on public.memberships
  for each row execute function private.ensure_workspace_has_owner();

-- The only way to create a workspace: it also makes the caller the owner and logs it.
create function private.create_workspace(
  p_name text, p_slug text, p_website text, p_timezone text, p_currency text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  insert into public.workspaces (name, slug, website, timezone, currency, created_by)
  values (p_name, p_slug, nullif(p_website, ''), p_timezone, p_currency, v_user)
  returning id into v_id;
  insert into public.memberships (workspace_id, user_id, role) values (v_id, v_user, 'owner');
  insert into public.audit_log (workspace_id, actor_id, action, target_type, target_id)
  values (v_id, v_user, 'workspace.created', 'workspace', v_id);
  return v_id;
end $$;

-- Grants: functions in `private` are callable only where granted.
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function
  private.is_member(uuid),
  private.shares_workspace(uuid),
  private.has_role(uuid, text[]),
  private.create_workspace(text, text, text, text, text)
to authenticated;
