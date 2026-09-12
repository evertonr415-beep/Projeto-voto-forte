create or replace function private.vf_import_creator_summary_internal()
returns table(
  creator_user_id bigint,
  creator_name text,
  creator_email text,
  creator_access_role text,
  imported_contacts bigint,
  import_batches bigint,
  manual_contacts bigint,
  last_imported_at timestamptz
)
language sql
stable
security definer
set search_path to ''
as $function$
  with me as (
    select u.id, u.access_role
    from public.vf_users u
    where u.auth_user_id = (select auth.uid())
      and u.status = 'active'
      and u.access_role in ('adm','master','lideranca','liderado')
    limit 1
  ),
  visible as (
    select v.user_id
    from private.vf_visible_user_ids() v
  ),
  visible_records as (
    select
      p.created_by_user_id,
      r.id,
      r.payload,
      r.created_at
    from private.vf_record_provenance p
    join public.vf_owned_records r
      on r.id = p.record_id
     and r.kind = 'contact'
    where exists (select 1 from me)
      and r.assigned_user_id in (select user_id from visible)
  )
  select
    u.id as creator_user_id,
    u.name as creator_name,
    u.email as creator_email,
    u.access_role as creator_access_role,
    count(vr.id) filter (
      where nullif(btrim(coalesce(vr.payload->>'importBatchId','')), '') is not null
    )::bigint as imported_contacts,
    count(distinct nullif(btrim(coalesce(vr.payload->>'importBatchId','')), ''))::bigint as import_batches,
    count(vr.id) filter (
      where nullif(btrim(coalesce(vr.payload->>'importBatchId','')), '') is null
    )::bigint as manual_contacts,
    max(vr.created_at) filter (
      where nullif(btrim(coalesce(vr.payload->>'importBatchId','')), '') is not null
    ) as last_imported_at
  from public.vf_users u
  join visible on visible.user_id = u.id
  left join visible_records vr on vr.created_by_user_id = u.id
  where exists (select 1 from me)
  group by u.id, u.name, u.email, u.access_role
  having count(vr.id) > 0
  order by imported_contacts desc, manual_contacts desc, u.name;
$function$;

revoke execute on function private.vf_import_creator_summary_internal() from public, anon;
grant execute on function private.vf_import_creator_summary_internal() to authenticated, service_role;

create or replace function public.vf_import_creator_summary()
returns table(
  creator_user_id bigint,
  creator_name text,
  creator_email text,
  creator_access_role text,
  imported_contacts bigint,
  import_batches bigint,
  manual_contacts bigint,
  last_imported_at timestamptz
)
language sql
stable
security invoker
set search_path to ''
as $function$
  select * from private.vf_import_creator_summary_internal();
$function$;

revoke execute on function public.vf_import_creator_summary() from public, anon;
grant execute on function public.vf_import_creator_summary() to authenticated, service_role;

create or replace function private.vf_import_batch_summary_internal(
  p_creator_user_id bigint default null
)
returns table(
  creator_user_id bigint,
  creator_name text,
  creator_access_role text,
  import_batch_id text,
  imported_contacts bigint,
  voters bigint,
  leaders bigint,
  districts bigint,
  current_assignees bigint,
  needs_review bigint,
  first_imported_at timestamptz,
  last_imported_at timestamptz
)
language sql
stable
security definer
set search_path to ''
as $function$
  with me as (
    select u.id, u.access_role
    from public.vf_users u
    where u.auth_user_id = (select auth.uid())
      and u.status = 'active'
      and u.access_role in ('adm','master','lideranca','liderado')
    limit 1
  ),
  visible as (
    select v.user_id
    from private.vf_visible_user_ids() v
  ),
  base as (
    select
      p.created_by_user_id,
      r.id as record_id,
      r.payload,
      r.created_at,
      r.assigned_user_id,
      nullif(btrim(coalesce(r.payload->>'importBatchId','')), '') as import_batch_id,
      q.severity
    from private.vf_record_provenance p
    join public.vf_owned_records r
      on r.id = p.record_id
     and r.kind = 'contact'
    left join public.vf_contact_quality q on q.record_id = r.id
    where exists (select 1 from me)
      and p.created_by_user_id in (select user_id from visible)
      and r.assigned_user_id in (select user_id from visible)
      and (p_creator_user_id is null or p.created_by_user_id = p_creator_user_id)
      and nullif(btrim(coalesce(r.payload->>'importBatchId','')), '') is not null
  )
  select
    b.created_by_user_id as creator_user_id,
    u.name as creator_name,
    u.access_role as creator_access_role,
    b.import_batch_id,
    count(*)::bigint as imported_contacts,
    count(*) filter (where coalesce(b.payload->>'kind','') <> 'Liderança')::bigint as voters,
    count(*) filter (where b.payload->>'kind' = 'Liderança')::bigint as leaders,
    count(distinct nullif(lower(btrim(coalesce(b.payload->>'district',''))), ''))::bigint as districts,
    count(distinct b.assigned_user_id)::bigint as current_assignees,
    count(*) filter (where b.severity in ('warning','critical'))::bigint as needs_review,
    min(b.created_at) as first_imported_at,
    max(b.created_at) as last_imported_at
  from base b
  join public.vf_users u on u.id = b.created_by_user_id
  group by b.created_by_user_id, u.name, u.access_role, b.import_batch_id
  order by last_imported_at desc, b.import_batch_id;
$function$;

revoke execute on function private.vf_import_batch_summary_internal(bigint) from public, anon;
grant execute on function private.vf_import_batch_summary_internal(bigint) to authenticated, service_role;

create or replace function public.vf_import_batch_summary(
  p_creator_user_id bigint default null
)
returns table(
  creator_user_id bigint,
  creator_name text,
  creator_access_role text,
  import_batch_id text,
  imported_contacts bigint,
  voters bigint,
  leaders bigint,
  districts bigint,
  current_assignees bigint,
  needs_review bigint,
  first_imported_at timestamptz,
  last_imported_at timestamptz
)
language sql
stable
security invoker
set search_path to ''
as $function$
  select * from private.vf_import_batch_summary_internal(p_creator_user_id);
$function$;

revoke execute on function public.vf_import_batch_summary(bigint) from public, anon;
grant execute on function public.vf_import_batch_summary(bigint) to authenticated, service_role;

create or replace function private.vf_import_batch_contacts_internal(
  p_creator_user_id bigint,
  p_import_batch_id text default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns table(
  total_count bigint,
  record_id bigint,
  contact_name text,
  phone text,
  profile text,
  district text,
  street text,
  street_number text,
  cep text,
  source_type text,
  import_batch_id text,
  creator_user_id bigint,
  creator_name text,
  assigned_user_id bigint,
  assigned_user_name text,
  assigned_user_role text,
  severity text,
  issue_codes text[],
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if p_creator_user_id is null then
    raise exception 'O importador é obrigatório.' using errcode = '22023';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 500 then
    raise exception 'O limite deve estar entre 1 e 500.' using errcode = '22023';
  end if;

  if p_offset is null or p_offset < 0 then
    raise exception 'O deslocamento não pode ser negativo.' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.vf_users me
    where me.auth_user_id = (select auth.uid())
      and me.status = 'active'
      and me.access_role in ('adm','master','lideranca','liderado')
  ) then
    raise exception 'Usuário sem permissão para consultar importações.' using errcode = '42501';
  end if;

  if not private.vf_can_view_user(p_creator_user_id) then
    raise exception 'Importador fora da hierarquia visível.' using errcode = '42501';
  end if;

  return query
  with visible as (
    select v.user_id
    from private.vf_visible_user_ids() v
  ),
  base as (
    select
      r.id as record_id,
      coalesce(nullif(btrim(r.payload->>'name'), ''), 'Contato')::text as contact_name,
      coalesce(r.payload->>'phone','')::text as phone,
      case when r.payload->>'kind' = 'Liderança' then 'Liderança' else 'Eleitor' end::text as profile,
      coalesce(r.payload->>'district','')::text as district,
      coalesce(r.payload->>'street','')::text as street,
      coalesce(r.payload->>'number','')::text as street_number,
      coalesce(r.payload->>'cep','')::text as cep,
      case when nullif(btrim(coalesce(r.payload->>'importBatchId','')), '') is null then 'manual' else 'imported' end::text as source_type,
      nullif(btrim(coalesce(r.payload->>'importBatchId','')), '')::text as import_batch_id,
      p.created_by_user_id,
      cu.name::text as creator_name,
      r.assigned_user_id,
      au.name::text as assigned_user_name,
      au.access_role::text as assigned_user_role,
      coalesce(q.severity, 'ok')::text as severity,
      coalesce(q.issue_codes, '{}'::text[]) as issue_codes,
      r.created_at,
      r.updated_at
    from private.vf_record_provenance p
    join public.vf_owned_records r
      on r.id = p.record_id
     and r.kind = 'contact'
    join public.vf_users cu on cu.id = p.created_by_user_id
    join public.vf_users au on au.id = r.assigned_user_id
    left join public.vf_contact_quality q on q.record_id = r.id
    where p.created_by_user_id = p_creator_user_id
      and r.assigned_user_id in (select user_id from visible)
      and (
        (p_import_batch_id is null and nullif(btrim(coalesce(r.payload->>'importBatchId','')), '') is null)
        or
        (p_import_batch_id is not null and nullif(btrim(coalesce(r.payload->>'importBatchId','')), '') = btrim(p_import_batch_id))
      )
  )
  select
    count(*) over()::bigint as total_count,
    b.record_id,
    b.contact_name,
    b.phone,
    b.profile,
    b.district,
    b.street,
    b.street_number,
    b.cep,
    b.source_type,
    b.import_batch_id,
    b.created_by_user_id as creator_user_id,
    b.creator_name,
    b.assigned_user_id,
    b.assigned_user_name,
    b.assigned_user_role,
    b.severity,
    b.issue_codes,
    b.created_at,
    b.updated_at
  from base b
  order by b.created_at desc, b.record_id desc
  limit p_limit
  offset p_offset;
end;
$function$;

revoke execute on function private.vf_import_batch_contacts_internal(bigint, text, integer, integer) from public, anon;
grant execute on function private.vf_import_batch_contacts_internal(bigint, text, integer, integer) to authenticated, service_role;

create or replace function public.vf_import_batch_contacts(
  p_creator_user_id bigint,
  p_import_batch_id text default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns table(
  total_count bigint,
  record_id bigint,
  contact_name text,
  phone text,
  profile text,
  district text,
  street text,
  street_number text,
  cep text,
  source_type text,
  import_batch_id text,
  creator_user_id bigint,
  creator_name text,
  assigned_user_id bigint,
  assigned_user_name text,
  assigned_user_role text,
  severity text,
  issue_codes text[],
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security invoker
set search_path to ''
as $function$
  select *
  from private.vf_import_batch_contacts_internal(
    p_creator_user_id,
    p_import_batch_id,
    p_limit,
    p_offset
  );
$function$;

revoke execute on function public.vf_import_batch_contacts(bigint, text, integer, integer) from public, anon;
grant execute on function public.vf_import_batch_contacts(bigint, text, integer, integer) to authenticated, service_role;