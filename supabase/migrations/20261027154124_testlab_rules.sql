-- Managers edit a test's question, checks and must-pass flag; never its workspace or author.
revoke update on public.test_cases from authenticated, anon;
grant update (question, checks, must_pass, updated_at) on public.test_cases to authenticated;

-- Runs and results are written only by the server's privileged connection.
revoke insert, update, delete on public.test_runs, public.test_results from authenticated, anon;
