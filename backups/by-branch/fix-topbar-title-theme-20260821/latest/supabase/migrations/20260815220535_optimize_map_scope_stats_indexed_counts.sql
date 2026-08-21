create or replace function public.vf_map_scope_stats(
  p_owner_emails text[],
  p_profile text default null::text
)
returns table(total_contacts bigint, mapped_contacts bigint)
language sql
as $function$
  select
    (
      select count(*)::bigint
      from public.vf_owned_records r
      where r.kind = 'contact'
        and r.owner_email = any(p_owner_emails)
        and (
          p_profile is null
          or p_profile = ''
          or r.payload ->> 'kind' = p_profile
        )
    ) as total_contacts,
    (
      select count(*)::bigint
      from public.vf_owned_records r
      where r.kind = 'contact'
        and r.owner_email = any(p_owner_emails)
        and public.vf_map_coordinate(r.payload ->> 'latitude') is not null
        and public.vf_map_coordinate(r.payload ->> 'longitude') is not null
        and (
          p_profile is null
          or p_profile = ''
          or r.payload ->> 'kind' = p_profile
        )
    ) as mapped_contacts;
$function$;

revoke all on function public.vf_map_scope_stats(text[], text) from public, anon;
grant execute on function public.vf_map_scope_stats(text[], text) to authenticated, service_role;
