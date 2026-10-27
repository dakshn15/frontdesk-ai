# Milestone 9: decisions log

Calls made while building milestone 9 that differ from or add to [the plan](2026-10-27-m9-test-lab.md) and the spec, each with what it costs if it turns out wrong.

## Rulings

- **Where tests run:** they use the live agent in dry mode, on a new `test` conversation channel, so analytics can exclude them. Bookings, leads, emails and handoffs aren't saved or sent; an integration test runs the whole demo suite and checks this.
- **"Says it isn't sure" is a phrase check:** "not sure", "don't know", "can't answer or confirm", "don't have that information", "I'm unable". It's explainable and has no AI cost.
  - Cost if wrong: an unusual phrasing of uncertainty fails the check. The owner then adds a "must not mention" check or an expected answer instead.
- **The AI grader** uses the same small models as the receptionist (gpt-5.4-mini, or gemini-3.5-flash). It answers "PASS: why" or "FAIL: why".
  - Without a key it's skipped with a note and doesn't count as a failure.
  - The scripted test model never grades, since it can't judge meaning.
- **Cost isn't shown yet.** The inspector and run results show the model, tokens and time; cost needs the price table that milestone 10 adds.
- **The inspector's data:** model, tokens and response time ride in the stream's final metadata, for the dashboard preview only, so website visitors never see them. Tools, passages and the verified answer come from the stream's tool parts.
- **Running tests:**
  - "Run all tests" starts a run and finishes it after the response with `after()`, one question at a time; the run page refreshes every 2 seconds.
  - One run at a time per workspace, 5 an hour, up to 50 tests.
  - A run still "running" after 15 minutes is marked as not finished and stops blocking.
- **Questions to review:** questions from website chats in the last 30 days where knowledge search came back with low or no confidence, without duplicates, leaving out questions already saved as tests.
- **Results copy the question,** so the run history still reads correctly after a test is edited or deleted.
- **The demo salon gets 8 saved tests,** 5 of them marked "must pass". With the scripted model, 4 of the 8 pass, and each failure says why. That makes the scripted run in CI a useful check of the checks themselves.
- **The two evaluation layers:**
  - CI (every push) runs the scripted demo suite as an integration test.
  - The nightly "Evaluation" workflow runs the `eval` vitest project against the real models, writes a table to the job summary, and fails if a must-pass test fails. It's skipped, not failed, without an `OPENAI_API_KEY` secret.
- **The nav item "Assistant" is now "Test lab",** with Playground and Tests tabs. The URL stays `/w/[slug]/assistant`.

## Self-review (inline)

Each review-focus item from the plan, and what covers it:

- **A crashed run:** it no longer blocks new runs after 15 minutes (integration test). A test that throws records a plain failure, and an error in the run itself marks it as not finished.
- **Tests causing real bookings or emails:** the scripted run on a demo sandbox adds no bookings or leads and sends no handoff email (integration test).
- **Staff or other workspaces editing tests:** refused by RLS (integration test).
- **The grader without a key:** skipped with a note, not failed (integration test).
- **Demo visitors running tests:** each run goes through the agent, so it counts against the shared daily demo AI cap.

## Deferred minors

- The cost per answer arrives in milestone 10.
- A test's checks can't be reordered, and there's no "run one test".
