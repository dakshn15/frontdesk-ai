-- Owners and admins can only queue a source again; everything else about a source is
-- written by the pipeline, and chunks are written only by the pipeline.
revoke update on public.knowledge_sources, public.knowledge_chunks from authenticated, anon;
grant update (status, error, updated_at) on public.knowledge_sources to authenticated;
