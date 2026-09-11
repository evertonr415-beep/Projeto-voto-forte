create or replace function private.vf_intelligence_contact_metrics_internal()
returns table(
  owner_email text,
  total_contacts bigint,
  voter_contacts bigint,
  contacts_last_7_days bigint,
  contacts_last_30_days bigint,
  voters_last_7_days bigint,
  last_voter_created_at timestamptz
)
language sql
stable
security definer
set search_path to ''
as $function$
  with current_profile as (
    select p.id
    from private.vf_current_profile() p
  ),
  visible_users as (
    select u.id as user_id, lower(trim(u.email)) as owner_email
    from public.vf_users u
    where u.status = 'active'
      and exists (select 1 from current_profile)
      and u.id in (select v.user_id from private.vf_visible_user_ids() v)
  )
  select
    lower(trim(r.owner_email)) as owner_email,
    count(*)::bigint as total_contacts,
    count(*) filter (where r.payload->>'kind' = 'Eleitor')::bigint as voter_contacts,
    count(*) filter (
      where nullif(btrim(coalesce(r.payload->>'importBatchId','')), '') is null
        and r.created_at >= now() - interval '7 days'
    )::bigint as contacts_last_7_days,
    count(*) filter (
      where nullif(btrim(coalesce(r.payload->>'importBatchId','')), '') is null
        and r.created_at >= now() - interval '30 days'
    )::bigint as contacts_last_30_days,
    count(*) filter (
      where r.payload->>'kind' = 'Eleitor'
        and nullif(btrim(coalesce(r.payload->>'importBatchId','')), '') is null
        and r.created_at >= now() - interval '7 days'
    )::bigint as voters_last_7_days,
    max(r.created_at) filter (
      where r.payload->>'kind' = 'Eleitor'
        and nullif(btrim(coalesce(r.payload->>'importBatchId','')), '') is null
    ) as last_voter_created_at
  from public.vf_owned_records r
  join visible_users vu on vu.user_id = r.assigned_user_id
  where r.kind = 'contact'
  group by lower(trim(r.owner_email));
$function$;

revoke execute on function private.vf_intelligence_contact_metrics_internal() from public, anon;
grant execute on function private.vf_intelligence_contact_metrics_internal() to authenticated, service_role;

create or replace function public.vf_intelligence_contact_metrics()
returns table(
  owner_email text,
  total_contacts bigint,
  voter_contacts bigint,
  contacts_last_7_days bigint,
  contacts_last_30_days bigint,
  voters_last_7_days bigint,
  last_voter_created_at timestamptz
)
language sql
stable
security invoker
set search_path to ''
as $function$
  select * from private.vf_intelligence_contact_metrics_internal();
$function$;

revoke execute on function public.vf_intelligence_contact_metrics() from public, anon;
grant execute on function public.vf_intelligence_contact_metrics() to authenticated, service_role;

create or replace function public.vf_intelligence_growth_summary()
returns table(
  total_contacts bigint,
  imported_contacts bigint,
  manual_contacts bigint,
  known_acquisition_contacts bigint,
  unknown_acquisition_contacts bigint,
  manual_last_7_days bigint,
  manual_last_30_days bigint,
  imported_last_7_days bigint,
  imported_last_30_days bigint,
  first_manual_entry_at timestamptz,
  last_manual_entry_at timestamptz,
  first_import_entry_at timestamptz,
  last_import_entry_at timestamptz
)
language sql
stable
security invoker
set search_path to ''
as $function$
  select
    count(*)::bigint as total_contacts,
    count(*) filter (
      where nullif(btrim(coalesce(r.payload->>'importBatchId','')), '') is not null
    )::bigint as imported_contacts,
    count(*) filter (
      where nullif(btrim(coalesce(r.payload->>'importBatchId','')), '') is null
    )::bigint as manual_contacts,
    count(*) filter (
      where nullif(btrim(coalesce(r.payload->>'importBatchId','')), '') is null
    )::bigint as known_acquisition_contacts,
    count(*) filter (
      where nullif(btrim(coalesce(r.payload->>'importBatchId','')), '') is not null
    )::bigint as unknown_acquisition_contacts,
    count(*) filter (
      where nullif(btrim(coalesce(r.payload->>'importBatchId','')), '') is null
        and r.created_at >= now() - interval '7 days'
    )::bigint as manual_last_7_days,
    count(*) filter (
      where nullif(btrim(coalesce(r.payload->>'importBatchId','')), '') is null
        and r.created_at >= now() - interval '30 days'
    )::bigint as manual_last_30_days,
    count(*) filter (
      where nullif(btrim(coalesce(r.payload->>'importBatchId','')), '') is not null
        and r.created_at >= now() - interval '7 days'
    )::bigint as imported_last_7_days,
    count(*) filter (
      where nullif(btrim(coalesce(r.payload->>'importBatchId','')), '') is not null
        and r.created_at >= now() - interval '30 days'
    )::bigint as imported_last_30_days,
    min(r.created_at) filter (
      where nullif(btrim(coalesce(r.payload->>'importBatchId','')), '') is null
    ) as first_manual_entry_at,
    max(r.created_at) filter (
      where nullif(btrim(coalesce(r.payload->>'importBatchId','')), '') is null
    ) as last_manual_entry_at,
    min(r.created_at) filter (
      where nullif(btrim(coalesce(r.payload->>'importBatchId','')), '') is not null
    ) as first_import_entry_at,
    max(r.created_at) filter (
      where nullif(btrim(coalesce(r.payload->>'importBatchId','')), '') is not null
    ) as last_import_entry_at
  from public.vf_owned_records r
  where r.kind = 'contact';
$function$;

revoke execute on function public.vf_intelligence_growth_summary() from public, anon;
grant execute on function public.vf_intelligence_growth_summary() to authenticated, service_role;

create or replace function public.vf_intelligence_growth_timeline(
  p_days integer default 90
)
returns table(
  day date,
  manual_contacts bigint,
  imported_contacts bigint,
  total_system_entries bigint,
  manual_voters bigint,
  imported_voters bigint
)
language plpgsql
stable
security invoker
set search_path to ''
as $function$
begin
  if p_days is null or p_days < 1 or p_days > 730 then
    raise exception 'O período deve estar entre 1 e 730 dias.' using errcode = '22023';
  end if;

  return query
  with days as (
    select generate_series(
      (now() at time zone 'America/Sao_Paulo')::date - (p_days - 1),
      (now() at time zone 'America/Sao_Paulo')::date,
      interval '1 day'
    )::date as day
  ), entries as (
    select
      (r.created_at at time zone 'America/Sao_Paulo')::date as day,
      count(*) filter (
        where nullif(btrim(coalesce(r.payload->>'importBatchId','')), '') is null
      )::bigint as manual_contacts,
      count(*) filter (
        where nullif(btrim(coalesce(r.payload->>'importBatchId','')), '') is not null
      )::bigint as imported_contacts,
      count(*)::bigint as total_system_entries,
      count(*) filter (
        where nullif(btrim(coalesce(r.payload->>'importBatchId','')), '') is null
          and r.payload->>'kind' = 'Eleitor'
      )::bigint as manual_voters,
      count(*) filter (
        where nullif(btrim(coalesce(r.payload->>'importBatchId','')), '') is not null
          and r.payload->>'kind' = 'Eleitor'
      )::bigint as imported_voters
    from public.vf_owned_records r
    where r.kind = 'contact'
      and r.created_at >= ((now() at time zone 'America/Sao_Paulo')::date - (p_days - 1))::timestamp at time zone 'America/Sao_Paulo'
    group by 1
  )
  select
    d.day,
    coalesce(e.manual_contacts, 0)::bigint,
    coalesce(e.imported_contacts, 0)::bigint,
    coalesce(e.total_system_entries, 0)::bigint,
    coalesce(e.manual_voters, 0)::bigint,
    coalesce(e.imported_voters, 0)::bigint
  from days d
  left join entries e using(day)
  order by d.day;
end;
$function$;

revoke execute on function public.vf_intelligence_growth_timeline(integer) from public, anon;
grant execute on function public.vf_intelligence_growth_timeline(integer) to authenticated, service_role;