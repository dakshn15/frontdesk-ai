-- Managers may change a service's details, never which workspace it belongs to.
revoke update on public.services from authenticated, anon;
grant update (name, description, category, duration_minutes, buffer_minutes,
  price_cents, price_is_from, bookable_online, updated_at)
  on public.services to authenticated;
