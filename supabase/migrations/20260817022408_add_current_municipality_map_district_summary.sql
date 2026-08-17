begin;

create or replace function public.vf_current_municipality_map_district_summary(
  p_owner_emails text[]
)
returns table(district text, total bigint)
language sql
stable
set search_path=''
as $$
  select
    trim(r.payload->>'district') as district,
    count(*)::bigint as total
  from public.vf_owned_records r
  where r.kind='contact'
    and r.municipality_id=(select private.vf_current_municipality_id())
    and lower(trim(r.owner_email))=any(
      coalesce(
        (select array_agg(lower(trim(x))) from unnest(coalesce(p_owner_emails,'{}'::text[])) x where trim(x)<>''),
        '{}'::text[]
      )
    )
    and trim(coalesce(r.payload->>'district',''))<>''
  group by trim(r.payload->>'district')
  order by count(*) desc, trim(r.payload->>'district');
$$;

revoke all on function public.vf_current_municipality_map_district_summary(text[]) from public, anon;
grant execute on function public.vf_current_municipality_map_district_summary(text[]) to authenticated;

commit;
