begin;

revoke execute on function public.vf_canonical_arapongas_district(text) from public, anon, authenticated;
grant execute on function public.vf_canonical_arapongas_district(text) to service_role;

revoke execute on function public.vf_contact_dashboard_summary_cached(text[]) from public, anon, authenticated;
grant execute on function public.vf_contact_dashboard_summary_cached(text[]) to service_role;

revoke execute on function public.vf_refresh_arapongas_district_summary() from public, anon, authenticated;
grant execute on function public.vf_refresh_arapongas_district_summary() to service_role;

revoke execute on function public.vf_refresh_contact_location_issues() from public, anon, authenticated;
grant execute on function public.vf_refresh_contact_location_issues() to service_role;

revoke execute on function public.vf_adjust_arapongas_district_summary(text, text, integer) from public, anon, authenticated;
grant execute on function public.vf_adjust_arapongas_district_summary(text, text, integer) to service_role;

commit;
