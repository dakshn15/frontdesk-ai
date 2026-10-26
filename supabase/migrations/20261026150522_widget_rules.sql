-- Owners and admins can style the website chat and choose the sites it may load on.
grant update (widget_color, widget_greeting, widget_suggestions, widget_position,
  allowed_domains) on public.workspaces to authenticated;
