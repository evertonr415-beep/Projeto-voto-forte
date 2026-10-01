create or replace function public.vf_contact_dashboard_summary_cached(p_owner_emails text[])
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
  with context as (
    select
      private.vf_current_municipality_id() as municipality_id,
      exists (
        select 1
        from public.vf_municipalities m
        where m.id = private.vf_current_municipality_id()
          and lower(trim(m.name)) = 'arapongas'
      ) as is_arapongas
  ),
  contact_totals as (
    select
      count(*)::bigint as total,
      count(*) filter (
        where coalesce(r.payload->>'kind', 'Eleitor') = 'Eleitor'
      )::bigint as voters,
      count(*) filter (
        where coalesce(r.payload->>'kind', 'Eleitor') = 'Liderança'
      )::bigint as leaders
    from public.vf_owned_records r
    cross join context c
    where r.kind = 'contact'
      and r.municipality_id = c.municipality_id
      and r.owner_email = any(p_owner_emails)
  ),
  legacy_district_catalog as (
    select distinct a.canonical_name as district_name
    from public.vf_arapongas_district_aliases a
    cross join context c
    where c.is_arapongas
      and a.active = true
  ),
  legacy_cached_counts as (
    select s.district_name, sum(s.total)::bigint as total
    from public.vf_arapongas_district_summary s
    cross join context c
    where c.is_arapongas
      and s.owner_email = any(p_owner_emails)
    group by s.district_name
  ),
  legacy_district_counts as (
    select d.district_name, coalesce(s.total, 0)::bigint as total
    from legacy_district_catalog d
    left join legacy_cached_counts s using (district_name)
  ),
  municipal_district_counts as (
    select
      trim(r.payload->>'district')::text as district_name,
      count(*)::bigint as total
    from public.vf_owned_records r
    cross join context c
    where not c.is_arapongas
      and r.kind = 'contact'
      and r.municipality_id = c.municipality_id
      and r.owner_email = any(p_owner_emails)
      and nullif(trim(r.payload->>'district'), '') is not null
    group by trim(r.payload->>'district')
  ),
  district_counts as (
    select district_name, total from legacy_district_counts
    union all
    select district_name, total from municipal_district_counts
  ),
  rural_totals as (
    select
      case
        when c.is_arapongas then (
          select count(*)::bigint
          from public.vf_contact_location_issues i
          where i.owner_email = any(p_owner_emails)
            and i.category = 'rural_localidade'
        )
        else 0::bigint
      end as rural_contacts
    from context c
  ),
  display_district_counts as (
    select district_name, total from district_counts
    union all
    select 'Zona rural'::text, r.rural_contacts
    from rural_totals r
    cross join context c
    where c.is_arapongas
  ),
  district_totals as (
    select count(*) filter (where total > 0)::bigint as districts_reached
    from district_counts
  ),
  meeting_totals as (
    select count(*)::bigint as meetings
    from public.vf_owned_records r
    cross join context c
    where r.kind = 'meeting'
      and r.municipality_id = c.municipality_id
      and r.owner_email = any(p_owner_emails)
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
