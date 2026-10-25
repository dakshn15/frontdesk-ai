-- Opening ranges on one weekday can't overlap. Back-to-back is fine: ranges are
-- half-open, [start, end).
alter table public.business_hours add constraint business_hours_no_overlap
  exclude using gist (
    workspace_id with =,
    weekday with =,
    int4range(start_minute, end_minute) with &&
  );

-- Opening hours and closed days are replaced or deleted, never edited in place.
revoke update on public.business_hours, public.closed_days from authenticated, anon;
