-- Subscriptions and Stripe events are written only by the Stripe webhook (privileged).
revoke insert, update, delete on public.subscriptions, public.stripe_events
  from authenticated, anon;
