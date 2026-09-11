begin;

create or replace function public.vf_contact_dashboard_summary_cached(
  p_owner_emails text[]
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with contacts_all as (
    select coalesce(payload->>'kind', 'Eleitor') as profile
    from public.vf_owned_records
    where kind = 'contact'
      and owner_email = any(p_owner_emails)
  ),
  district_catalog as (
    select distinct canonical_name as district_name
    from public.vf_arapongas_district_aliases
    where active = true
  ),
  cached_counts as (
    select
      district_name,
      sum(total)::bigint as total
    from public.vf_arapongas_district_summary
    where owner_email = any(p_owner_emails)
    group by district_name
  ),
  district_counts as (
    select
      c.district_name,
      coalesce(s.total, 0)::bigint as total
    from district_catalog c
    left join cached_counts s using (district_name)
  ),
  contact_totals as (
    select
      count(*)::bigint as total,
      count(*) filter (where profile = 'Eleitor')::bigint as voters,
      count(*) filter (where profile = 'Liderança')::bigint as leaders
    from contacts_all
  ),
  district_totals as (
    select count(*) filter (where total > 0)::bigint as districts_reached
    from district_counts
  ),
  meeting_totals as (
    select count(*)::bigint as meetings
    from public.vf_owned_records
    where kind = 'meeting'
      and owner_email = any(p_owner_emails)
  )
  select jsonb_build_object(
    'total', contact_totals.total,
    'voters', contact_totals.voters,
    'leaders', contact_totals.leaders,
    'meetings', meeting_totals.meetings,
    'districtsReached', district_totals.districts_reached,
    'districts', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'district', district_name,
            'total', total
          )
          order by (total > 0) desc, total desc, district_name asc
        )
        from district_counts
      ),
      '[]'::jsonb
    )
  )
  from contact_totals
  cross join district_totals
  cross join meeting_totals;
$$;

revoke execute on function public.vf_contact_dashboard_summary_cached(text[])
  from public;
grant execute on function public.vf_contact_dashboard_summary_cached(text[])
  to authenticated, anon, service_role;

commit;
