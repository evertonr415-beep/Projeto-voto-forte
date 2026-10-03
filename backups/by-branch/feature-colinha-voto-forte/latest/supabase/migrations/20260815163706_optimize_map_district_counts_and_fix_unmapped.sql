create or replace function public.vf_map_district_counts(
  p_owner_emails text[] default null::text[],
  p_profile text default null::text
)
returns table(
  district text,
  total bigint,
  voters bigint,
  leaders bigint
)
language sql
stable
security invoker
set search_path to 'public', 'extensions'
as $function$
with contacts as (
  select
    coalesce(nullif(trim(r.payload ->> 'kind'), ''), 'Eleitor') as profile,
    case
      when upper(unaccent(coalesce(r.payload ->> 'district', ''))) ~ '(RURAL|RODOVIA|ESTRADA|^EST |^GL |GLEBA|SITIO|SÍTIO|CHACARA|CHÁCARA|FAZENDA|^FAZ |^PR [0-9]|KM [0-9]|AGUA |ÁGUA )'
        then 'Zona rural'::text
      else a.canonical_name
    end as canonical_district
  from public.vf_owned_records r
  left join public.vf_arapongas_district_aliases a
    on a.alias_key = public.vf_normalize_arapongas_district(r.payload ->> 'district')
   and a.active = true
  where r.kind = 'contact'
    and (p_owner_emails is null or r.owner_email = any(p_owner_emails))
    and (
      p_profile is null
      or trim(p_profile) = ''
      or lower(coalesce(nullif(trim(r.payload ->> 'kind'), ''), 'Eleitor')) = lower(trim(p_profile))
    )
)
select
  canonical_district as district,
  count(*)::bigint as total,
  count(*) filter (where profile = 'Eleitor')::bigint as voters,
  count(*) filter (where profile = 'Liderança')::bigint as leaders
from contacts
where canonical_district is not null
  and canonical_district <> ''
group by canonical_district
order by count(*) desc, canonical_district asc;
$function$;

create or replace function public.vf_map_unmapped_district_counts(
  p_owner_emails text[] default null::text[],
  p_profile text default null::text
)
returns table(
  district text,
  total bigint,
  voters bigint,
  leaders bigint
)
language sql
stable
security invoker
set search_path to 'public'
as $function$
  select
    c.district,
    c.total,
    c.voters,
    c.leaders
  from public.vf_map_district_counts(p_owner_emails, p_profile) c
  left join public.vf_arapongas_district_geocodes g
    on g.canonical_name = c.district
  where g.latitude is null
     or g.longitude is null
  order by c.total desc, c.district asc;
$function$;
