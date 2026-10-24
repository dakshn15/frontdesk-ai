-- Accepting and previewing invites. Both find the invite by the SHA-256 of the raw token,
-- computed the same way as hashInviteToken in src/features/team/invite-token.ts.

create function private.accept_invitation(p_token text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_email text;
  v_inv public.invitations%rowtype;
  v_slug text;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;

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

-- What the invite page shows before anyone signs in. Status precedence matches
-- inviteStatus in TypeScript: accepted, revoked, expired, then pending.
create function private.invitation_preview(p_token text)
returns table (
  workspace_name text,
  workspace_slug text,
  role public.workspace_role,
  email text,
  inviter_name text,
  status text
)
language sql stable security definer set search_path = '' as $$
  select
    w.name,
    w.slug,
    i.role,
    i.email,
    coalesce(p.full_name, ''),
    case
      when i.accepted_at is not null then 'accepted'
      when i.revoked_at is not null then 'revoked'
      when i.expires_at <= now() then 'expired'
      else 'pending'
    end
  from public.invitations i
  join public.workspaces w on w.id = i.workspace_id
  left join public.profiles p on p.id = i.invited_by
  where i.token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
$$;

revoke execute on function
  private.accept_invitation(text),
  private.invitation_preview(text)
from public;
grant execute on function private.accept_invitation(text) to authenticated;
grant execute on function private.invitation_preview(text) to anon, authenticated;
