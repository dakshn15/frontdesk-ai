-- Moving a booking clears its reminder flag, so the new time gets its own reminder.
grant update (reminder_sent_at) on public.bookings to authenticated;

-- The daily reminder run looks for confirmed bookings starting soon that haven't had one.
create index bookings_reminder_due_idx on public.bookings (starts_at)
  where status = 'confirmed' and reminder_sent_at is null;
