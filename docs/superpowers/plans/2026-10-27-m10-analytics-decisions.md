# Milestone 10: decisions log

Calls made while building milestone 10 that differ from or add to [the plan](2026-10-27-m10-analytics.md) and the spec, each with what it costs if it turns out wrong.

## Rulings

- **Prices** live in `src/features/analytics/prices.ts`, in US dollars per million tokens:
  - gpt-5.4-mini: $0.75 in, $4.50 out;
  - gemini-3.5-flash: $1.50 in, $9.00 out.
  - Sources: the [GPT-5.4 mini](https://anotherwrapper.com/llm-pricing/gpt-5.4-mini) and [Gemini 3.5 Flash](https://anotherwrapper.com/llm-pricing/gemini-3.5-flash) price trackers, both citing the providers' pages, on 2026-10-27.
  - Costs are labelled "estimated". The scripted test model and unknown models cost nothing.
  - Cost if wrong: estimates drift until the table is updated; it's two numbers per model.
- **Tagging is by rules, not an AI call:**
  - the topic comes from a fixed list of 9, first from the tools used, then from the visitor's words;
  - the outcome is booked, lead, handed off, unanswered (a "not sure" reply, or a knowledge search that found nothing) or answered.
  - It's explainable, repeatable and costs nothing.
  - Cost if wrong: an odd question lands in "Other". An AI tagger can replace `topicFor` later without touching the rest.
- **When chats get tagged:** a chat is tagged once it's been quiet for 30 minutes, and again if it gets new messages after being tagged. Tagging runs on each Analytics page load (up to 200 chats) and in the daily cron (up to 5,000).
  - The demo clean-up cron became `/api/cron/daily`, because Vercel's Hobby plan allows only two cron jobs.
- **What's counted:**
  - website chats only: the dashboard preview and Test lab chats are left out;
  - AI cost counts every model call, since each one is billed;
  - "Booked by the AI" counts bookings whose source is the website chat;
  - "Resolved without a person" counts tagged chats that were answered, booked or left details, with no handoff.
- **Bookings from a confirmed widget card store their conversation,** so the "booked" outcome is exact.
- **Recharts 3.10.1** was added for the two bar charts.
  - Colours follow the dataviz guidance: the app's primary colour for the single series, and the first two validated categorical slots (blue and orange, stepped separately for dark mode) for the providers.
  - Topics are plain bars with their counts as text, and the model table is the charts' table view.
- **The demo sandbox gets a month of history:** about 75 tagged chats, with usage, leads and completed bookings, generated from a fixed seed so every copy shows the same picture.
- **Cost per answer** now also shows in the Test lab inspector and on run results.

## Deferred minors

- There's no custom date picker: 7, 30 or 90 days only.
- Charts have no "show as table" toggle beyond the model table.
