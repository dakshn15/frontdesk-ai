-- Managers edit the text of a policy or answer, never its kind, workspace or author.
revoke update on public.policies, public.verified_answers from authenticated, anon;
grant update (title, body, updated_at) on public.policies to authenticated;
grant update (question, answer, updated_by, updated_at)
  on public.verified_answers to authenticated;
