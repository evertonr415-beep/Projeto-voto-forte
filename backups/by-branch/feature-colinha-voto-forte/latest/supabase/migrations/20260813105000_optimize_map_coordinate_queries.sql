create or replace function public.vf_map_exact_contact_points(
  p_owner_emails text[],
  p_profile text default null::text
)
returns table(
  feature_type text,
  latitude double precision,
  longitude double precision,
  total integer,
  voters integer,
  leaders integer,
  contact_name text,
  profile text,
  district text,
  street text,
  street_number text
)
language sql
set search_path to 'public'
as $function$
  select
    'point'::text as feature_type,
    public.vf_map_coordinate(r.payload->>'latitude') as latitude,
    public.vf_map_coordinate(r.payload->>'longitude') as longitude,
    1::integer as total,
    case when r.payload->>'kind' = 'Liderança' then 0 else 1 end::integer as voters,
    case when r.payload->>'kind' = 'Liderança' then 1 else 0 end::integer as leaders,
    coalesce(nullif(r.payload->>'name',''), 'Contato')::text as contact_name,
    case when r.payload->>'kind' = 'Liderança' then 'Liderança' else 'Eleitor' end::text as profile,
    coalesce(r.payload->>'district','')::text as district,
    coalesce(r.payload->>'street','')::text as street,
    coalesce(r.payload->>'number','')::text as street_number
  from public.vf_owned_records r
  where r.kind = 'contact'
    and r.owner_email = any(p_owner_emails)
    and public.vf_map_coordinate(r.payload->>'latitude') is not null
    and public.vf_map_coordinate(r.payload->>'longitude') is not null
    and (p_profile is null or p_profile = '' or r.payload->>'kind' = p_profile);
$function$;

create or replace function public.vf_map_scope_stats(
  p_owner_emails text[],
  p_profile text default null::text
)
returns table(total_contacts bigint, mapped_contacts bigint)
language sql
set search_path to 'public'
as $function$
  select
    count(*)::bigint as total_contacts,
    count(*) filter (
      where public.vf_map_coordinate(r.payload->>'latitude') is not null
        and public.vf_map_coordinate(r.payload->>'longitude') is not null
    )::bigint as mapped_contacts
  from public.vf_owned_records r
  where r.kind = 'contact'
    and r.owner_email = any(p_owner_emails)
    and (p_profile is null or p_profile = '' or r.payload->>'kind' = p_profile);
$function$;
