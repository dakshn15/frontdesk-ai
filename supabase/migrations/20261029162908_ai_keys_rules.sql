-- AI keys are read and written only by server code (the admin connection). Browser
-- sessions get no access at all, even though the table has row level security.
revoke all on public.workspace_ai_keys from authenticated, anon;
