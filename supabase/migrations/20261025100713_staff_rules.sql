-- btree_gist lets an exclusion constraint compare plain values (uuid, smallint) with =
-- alongside ranges with &&. The booking engine needs it too.
create extension if not exists btree_gist with schema extensions;

-- One person's time ranges on one weekday can't overlap. Back-to-back is fine: ranges
-- are half-open, [start, end).
alter table public.staff_hours add constraint staff_hours_no_overlap
  exclude using gist (
    staff_id with =,
    weekday with =,
    int4range(start_minute, end_minute) with &&
  );

-- A linked login must be a member of the same workspace. When the member leaves, only
-- user_id is cleared, so the staff profile (and later their bookings) stays.
alter table public.staff add constraint staff_member_fk
  foreign key (workspace_id, user_id)
  references public.memberships (workspace_id, user_id)
  on delete set null (user_id);

-- Managers may edit a profile, never move it to another workspace. Links, hours and time
-- off are replaced or deleted, never edited in place.
revoke update on public.staff, public.staff_services, public.staff_hours,
  public.staff_time_off from authenticated, anon;
grant update (name, title, bio, user_id, active, updated_at)
  on public.staff to authenticated;
