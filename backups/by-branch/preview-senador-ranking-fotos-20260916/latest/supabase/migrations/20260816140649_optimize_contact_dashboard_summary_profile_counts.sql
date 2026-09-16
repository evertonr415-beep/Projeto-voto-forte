create index if not exists vf_owned_records_contact_owner_profile_idx
  on public.vf_owned_records (owner_email, (coalesce(payload->>'kind','Eleitor')))
  where kind = 'contact';

create or replace function public.vf_contact_dashboard_summary_cached(p_owner_emails text[])
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
  with contact_totals as (
    select
      (
        select count(*)::bigint
        from public.vf_owned_records
        where kind = 'contact'
          and owner_email = any(p_owner_emails)
      ) as total,
      (
        select count(*)::bigint
        from public.vf_owned_records
        where kind = 'contact'
          and owner_email = any(p_owner_emails)
          and coalesce(payload->>'kind', 'Eleitor') = 'Eleitor'
      ) as voters,
      (
        select count(*)::bigint
        from public.vf_owned_records
        where kind = 'contact'
          and owner_email = any(p_owner_emails)
          and coalesce(payload->>'kind', 'Eleitor') = 'Liderança'
      ) as leaders
  ),
  district_catalog as (
    select distinct canonical_name as district_name
    from public.vf_arapongas_district_aliases
    where active = true
  ),
  cached_counts as (
    select district_name, sum(total)::bigint as total
    from public.vf_arapongas_district_summary
    where owner_email = any(p_owner_emails)
    group by district_name
  ),
  urban_district_counts as (
    select c.district_name, coalesce(s.total, 0)::bigint as total
    from district_catalog c
    left join cached_counts s using (district_name)
  ),
  rural_totals as (
    select count(*)::bigint as rural_contacts
    from public.vf_contact_location_issues
    where owner_email = any(p_owner_emails)
      and category = 'rural_localidade'
  ),
  display_district_counts as (
    select district_name, total from urban_district_counts
    union all
    select 'Zona rural'::text, rural_contacts from rural_totals
  ),
  district_totals as (
    select count(*) filter (where total > 0)::bigint as districts_reached
    from urban_district_counts
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
    'ruralContacts', rural_totals.rural_contacts,
    'districtsReached', district_totals.districts_reached,
    'districts', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object('district', district_name, 'total', total)
          order by case when district_name = 'Zona rural' then 0 else 1 end,
                   (total > 0) desc,
                   total desc,
                   district_name asc
        )
        from display_district_counts
      ),
      '[]'::jsonb
    )
  )
  from contact_totals
  cross join rural_totals
  cross join district_totals
  cross join meeting_totals;
$function$;
