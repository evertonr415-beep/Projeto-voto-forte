begin;

revoke all on public.vf_arapongas_district_summary from public;
revoke all on public.vf_arapongas_district_summary from anon, authenticated;
grant select on public.vf_arapongas_district_summary to service_role;

revoke execute on function public.vf_adjust_arapongas_district_summary(text, text, integer)
  from public, anon, authenticated;

revoke execute on function public.vf_sync_arapongas_district_summary()
  from public, anon, authenticated;

revoke execute on function public.vf_refresh_arapongas_district_summary()
  from public, anon;
grant execute on function public.vf_refresh_arapongas_district_summary()
  to authenticated, service_role;

alter function public.vf_contact_dashboard_summary_cached(text[])
  security definer;

revoke execute on function public.vf_contact_dashboard_summary_cached(text[])
  from public;
grant execute on function public.vf_contact_dashboard_summary_cached(text[])
  to authenticated, anon, service_role;

commit;
