-- Members take chats over, hand them back and resolve them, and reply as themselves.
grant update (status, assigned_to, last_message_at) on public.conversations to authenticated;
grant insert (id, workspace_id, conversation_id, role, content, sources, author_id, created_at)
  on public.messages to authenticated;

-- The dashboard inbox updates live. Realtime applies each table's row level security, so
-- a member only receives their own workspace's rows.
alter publication supabase_realtime add table public.conversations, public.messages;
