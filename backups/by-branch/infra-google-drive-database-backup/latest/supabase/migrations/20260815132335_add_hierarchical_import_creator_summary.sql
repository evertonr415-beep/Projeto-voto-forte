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
  select
    u.id as creator_user_id,
    u.name as creator_name,
    u.email as creator_email,
    u.access_role as creator_access_role,
    count(*) filter (
      where r.kind = 'contact'
        and nullif(btrim(coalesce(r.payload->>'importBatchId','')), '') is not null
    )::bigint as imported_contacts,
    count(distinct nullif(btrim(coalesce(r.payload->>'importBatchId','')), '')) filter (
      where r.kind = 'contact'
    )::bigint as import_batches,
    count(*) filter (
      where r.kind = 'contact'
        and nullif(btrim(coalesce(r.payload->>'importBatchId','')), '') is null
    )::bigint as manual_contacts,
    max(r.created_at) filter (
      where r.kind = 'contact'
        and nullif(btrim(coalesce(r.payload->>'importBatchId','')), '') is not null
    ) as last_imported_at
  from public.vf_users u
  join private.vf_visible_user_ids() visible on visible.user_id = u.id
  left join private.vf_record_provenance p on p.created_by_user_id = u.id
  left join public.vf_owned_records r on r.id = p.record_id and r.kind = 'contact'
  where exists (
    select 1 from public.vf_users me
    where me.auth_user_id = (select auth.uid())
      and me.status = 'active'
      and me.access_role in ('adm','master','lideranca','liderado')
  )
  group by u.id, u.name, u.email, u.access_role
  having count(r.id) > 0
  order by imported_contacts desc, manual_contacts desc, u.name;
$function$;

revoke all on function private.vf_import_creator_summary_internal() from public;
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

revoke all on function public.vf_import_creator_summary() from public;
grant execute on function public.vf_import_creator_summary() to authenticated, service_role;