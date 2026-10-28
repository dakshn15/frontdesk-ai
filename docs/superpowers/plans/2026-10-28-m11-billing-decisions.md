# Milestone 11: decisions log

Calls made while building milestone 11 that differ from or add to [the plan](2026-10-28-m11-billing.md) and the spec, each with what it costs if it turns out wrong.

## Rulings

- **Stripe through REST, with no SDK:** `fetch` with form encoding, the same way as Resend. The webhook signature check is written out and unit tested: HMAC-SHA256 of `t.body`, timing-safe comparison, 5-minute tolerance.
  - Cost if wrong: a new Stripe API version may change a field. Only `customer.subscription.*` objects are read.
- **The plan comes only from subscription events.** `customer.subscription.created`, `updated` and `deleted` carry the workspace id (set as subscription metadata at checkout), the price, the status and the period end, which is all the app needs. Every event id is stored in `stripe_events` in the same transaction as the change, so repeats are ignored and a failed change is retried by Stripe.
- **Plans and limits** (placeholders, in Stripe test mode):
  - Trial: 14 days from the workspace's creation; 100 chats a month, 20 knowledge sources, 2 seats.
  - Starter ($29): 500 chats, 50 sources, 3 seats.
  - Pro ($99): 3,000 chats, 200 sources, 10 seats.
  - "Seats" count members plus pending invites. Chat limits reset on the 1st of each month, UTC.
- **A paid plan stays live while Stripe keeps billing it:** `active`, `trialing` or `past_due` (Stripe retries a failed payment). Canceled or unpaid drops back to the trial rules, which have usually expired by then.
- **What a limit does:**
  - An ended trial, or a month over its chat limit, means website chats get the "leave your details" reply and the widget shows the contact form from the start.
  - The owners get one email a month when the chat limit is reached.
  - The dashboard preview and the Test lab keep working, so owners can still check their setup.
  - Nothing is deleted.
- **Demo sandboxes have no plan.** They keep their own shared daily AI cap.
- **A bug fixed on the way:** `allowRequest`'s occasional clean-up deleted every window that started more than a day ago, which could reset the new 40-day "one limit email a month" window. It now keeps windows for 45 days, longer than any window in use, and an integration test covers it.
- **Stripe setup is Daksh's,** in test mode:
  - two monthly prices;
  - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_STARTER` and `STRIPE_PRICE_PRO` in Vercel;
  - a webhook endpoint at `/api/webhooks/stripe` for the three subscription events.
  - Without them, the Billing page shows the plans with the buttons switched off.
- **The Playwright GitHub reporter** was added: milestone 10's CI run failed in e2e, and GitHub only shows logs to signed-in users. Failures now appear as annotations on the public run page.

## Deferred minors

- There's no proration preview or invoice history in the app: Stripe's Customer Portal shows both.
- Seats aren't removed when a plan is downgraded: new invites are refused until the team is within the limit.
