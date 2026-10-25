-- Links from a booking to its customer, staff member and service stay inside the workspace,
-- and deleting one of them clears only that column: the booking keeps its copied details.
alter table public.bookings add constraint bookings_customer_fk
  foreign key (customer_id, workspace_id) references public.customers (id, workspace_id)
  on delete set null (customer_id);
alter table public.bookings add constraint bookings_staff_fk
  foreign key (staff_id, workspace_id) references public.staff (id, workspace_id)
  on delete set null (staff_id);
alter table public.bookings add constraint bookings_service_fk
  foreign key (service_id, workspace_id) references public.services (id, workspace_id)
  on delete set null (service_id);

alter table public.booking_events add constraint booking_events_booking_fk
  foreign key (booking_id, workspace_id) references public.bookings (id, workspace_id)
  on delete cascade;

-- One person can't have two confirmed bookings whose busy time (start to end plus buffer)
-- overlaps. The database enforces it, so two requests at the same moment can't both win.
alter table public.bookings add constraint bookings_no_overlap
  exclude using gist (
    staff_id with =,
    tstzrange(starts_at, occupied_until) with &&
  ) where (status = 'confirmed');

-- Column rules. New workspace and staff columns join the existing grants.
grant update (slot_step_minutes, min_notice_minutes, max_days_ahead,
  cancellation_window_hours) on public.workspaces to authenticated;
grant update (calendar_token) on public.staff to authenticated;

revoke update on public.bookings, public.customers, public.booking_events,
  public.email_log from authenticated, anon;
grant update (staff_id, staff_name, starts_at, ends_at, occupied_until, status, notes,
  cancelled_at, updated_at) on public.bookings to authenticated;
grant update (name, phone, updated_at) on public.customers to authenticated;
