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
    where exists (select 1 from current_profile)
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