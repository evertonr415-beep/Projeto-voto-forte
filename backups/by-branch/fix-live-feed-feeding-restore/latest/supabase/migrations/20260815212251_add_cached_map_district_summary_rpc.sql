create or replace function private.vf_map_district_summary_internal(p_owner_emails text[])
returns table(district text, total bigint)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_requested text[];
  v_forbidden boolean;
begin
  select coalesce(array_agg(distinct lower(trim(x))), '{}'::text[])
    into v_requested
  from unnest(coalesce(p_owner_emails, '{}'::text[])) x
  where trim(x) <> '';

  if cardinality(v_requested) = 0 then
    raise exception 'Nenhum responsável foi informado.' using errcode = '22023';
  end if;

  if coalesce((select auth.jwt()->>'role'), '') <> 'service_role' then
    if (select auth.uid()) is null then
      raise exception 'Usuário não autenticado.' using errcode = '42501';
    end if;

    select exists(
      select 1
      from unnest(v_requested) e
      where not private.vf_can_view_owner_email(e)
    ) into v_forbidden;

    if v_forbidden then
      raise exception 'Você não possui acesso a um ou mais responsáveis informados.' using errcode = '42501';
    end if;
  end if;

  return query
  with district_catalog as (
    select distinct a.canonical_name as district_name
    from public.vf_arapongas_district_aliases a
    where a.active = true
  ),
  cached_counts as (
    select s.district_name, sum(s.total)::bigint as total
    from public.vf_arapongas_district_summary s
    where s.owner_email = any(v_requested)
    group by s.district_name
  ),
  urban_district_counts as (
    select c.district_name, coalesce(s.total, 0)::bigint as total
    from district_catalog c
    left join cached_counts s using (district_name)
  ),
  rural_totals as (
    select count(*)::bigint as total
    from public.vf_contact_location_issues i
    where i.owner_email = any(v_requested)
      and i.category = 'rural_localidade'
  )
  select u.district_name, u.total
  from urban_district_counts u
  union all
  select 'Zona rural'::text, r.total
  from rural_totals r;
end;
$function$;

create or replace function public.vf_map_district_summary(p_owner_emails text[])
returns table(district text, total bigint)
language sql
stable
security invoker
set search_path = ''
as $function$
  select *
  from private.vf_map_district_summary_internal(p_owner_emails);
$function$;

revoke all on function private.vf_map_district_summary_internal(text[]) from public, anon;
grant execute on function private.vf_map_district_summary_internal(text[]) to authenticated, service_role;

revoke all on function public.vf_map_district_summary(text[]) from public, anon;
grant execute on function public.vf_map_district_summary(text[]) to authenticated, service_role;
