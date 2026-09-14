create or replace function public.vf_map_scope_stats(
  p_owner_emails text[],
  p_profile text default null::text
)
returns table(total_contacts bigint, mapped_contacts bigint)
language sql
as $function$
  select
    case
      when p_profile is null or p_profile = '' then (
        select count(*)::bigint
        from public.vf_owned_records r
        where r.kind = 'contact'
          and r.owner_email = any(p_owner_emails)
      )
      else (
        select count(*)::bigint
        from public.vf_owned_records r
        where r.kind = 'contact'
          and r.owner_email = any(p_owner_emails)
          and r.payload ->> 'kind' = p_profile
      )
    end as total_contacts,
    case
      when p_profile is null or p_profile = '' then (
        select count(*)::bigint
        from public.vf_owned_records r
        where r.kind = 'contact'
          and r.owner_email = any(p_owner_emails)
          and public.vf_map_coordinate(r.payload ->> 'latitude') is not null
          and public.vf_map_coordinate(r.payload ->> 'longitude') is not null
      )
      else (
        select count(*)::bigint
        from public.vf_owned_records r
        where r.kind = 'contact'
          and r.owner_email = any(p_owner_emails)
          and public.vf_map_coordinate(r.payload ->> 'latitude') is not null
          and public.vf_map_coordinate(r.payload ->> 'longitude') is not null
          and r.payload ->> 'kind' = p_profile
      )
    end as mapped_contacts;
$function$;
