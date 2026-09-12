-- Optimize the electoral map read path without changing operational data.
-- The existing RLS policies remain the source of truth for municipality/user scope.

create or replace function public.vf_map_scope_stats(
  p_owner_emails text[],
  p_profile text default null
)
returns table(total_contacts bigint, mapped_contacts bigint)
language sql
stable
set search_path = ''
as $function$
  select
    count(*)::bigint as total_contacts,
    count(*) filter (
      where public.vf_map_coordinate(r.payload ->> 'latitude') is not null
        and public.vf_map_coordinate(r.payload ->> 'longitude') is not null
    )::bigint as mapped_contacts
  from public.vf_owned_records r
  where r.kind = 'contact'
    and r.municipality_id = (select private.vf_current_municipality_id())
    and r.owner_email = any(p_owner_emails)
    and (
      p_profile is null
      or btrim(p_profile) = ''
      or r.payload ->> 'kind' = p_profile
    );
$function$;

revoke all on function public.vf_map_scope_stats(text[], text) from public;
revoke all on function public.vf_map_scope_stats(text[], text) from anon;
grant execute on function public.vf_map_scope_stats(text[], text) to authenticated, service_role;

create or replace function public.vf_map_cached_district_markers(
  p_owner_emails text[]
)
returns table(
  district text,
  total bigint,
  latitude double precision,
  longitude double precision
)
language sql
stable
set search_path = ''
as $function$
  with requested_owners as materialized (
    select distinct lower(btrim(value)) as owner_email
    from unnest(coalesce(p_owner_emails, '{}'::text[])) as requested(value)
    where btrim(value) <> ''
  ),
  counts as materialized (
    select
      s.district_name as district,
      sum(s.total)::bigint as total
    from public.vf_arapongas_district_summary s
    join requested_owners requested
      on requested.owner_email = lower(btrim(s.owner_email))
    group by s.district_name
  )
  select
    c.district,
    c.total,
    g.latitude,
    g.longitude
  from counts c
  left join public.vf_arapongas_district_geocodes g
    on g.canonical_name = c.district
  where c.total > 0
  order by c.total desc, c.district asc;
$function$;

revoke all on function public.vf_map_cached_district_markers(text[]) from public;
revoke all on function public.vf_map_cached_district_markers(text[]) from anon;
grant execute on function public.vf_map_cached_district_markers(text[]) to authenticated, service_role;
