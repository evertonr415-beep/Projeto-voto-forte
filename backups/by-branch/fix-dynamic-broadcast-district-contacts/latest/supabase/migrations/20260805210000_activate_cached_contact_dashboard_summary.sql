begin;

create or replace function public.vf_contact_dashboard_summary(
  p_owner_emails text[]
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select public.vf_contact_dashboard_summary_cached(p_owner_emails);
$$;

revoke execute on function public.vf_contact_dashboard_summary(text[]) from public;
grant execute on function public.vf_contact_dashboard_summary(text[])
  to authenticated, anon, service_role;

commit;
