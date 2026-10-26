-- Owners and admins can rename the receptionist and choose its AI provider.
grant update (assistant_name, ai_provider) on public.workspaces to authenticated;

-- Conversations, messages, tool calls, leads, usage and sessions are written only by the
-- server's privileged connection; users can read some of them and change none.
revoke insert, update, delete on public.visitor_sessions, public.conversations,
  public.messages, public.tool_calls, public.leads, public.usage_events,
  public.rate_limit_windows from authenticated, anon;
