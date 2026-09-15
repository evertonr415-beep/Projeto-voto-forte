create or replace function private.vf_create_manual_backup_internal()
returns public.vf_backup_snapshots
language plpgsql
security definer
set search_path to ''
as $function$
declare
  payload jsonb;
  total integer;
  result public.vf_backup_snapshots;
begin
  if not private.vf_is_adm() then
    raise exception 'Acesso negado: backup exclusivo do ADM' using errcode = '42501';
  end if;

  payload := private.vf_build_backup();
  total := jsonb_array_length(payload->'users')
         + jsonb_array_length(payload->'records')
         + jsonb_array_length(payload->'settings')
         + jsonb_array_length(payload->'auditLogs')
         + jsonb_array_length(payload->'invitations');

  insert into public.vf_backup_snapshots(created_by, backup_version, data, checksum, item_count)
  values (
    (select email from auth.users where id = (select auth.uid())),
    2,
    payload,
    md5(payload::text),
    total
  )
  returning * into result;

  return result;
end;
$function$;

revoke execute on function private.vf_create_manual_backup_internal() from public, anon;
grant execute on function private.vf_create_manual_backup_internal() to authenticated, service_role;

create or replace function public.vf_create_manual_backup()
returns public.vf_backup_snapshots
language plpgsql
security invoker
set search_path to ''
as $function$
declare
  result public.vf_backup_snapshots;
begin
  result := private.vf_create_manual_backup_internal();
  return result;
end;
$function$;

revoke execute on function public.vf_create_manual_backup() from public, anon;
grant execute on function public.vf_create_manual_backup() to authenticated, service_role;

create or replace function private.vf_restore_backup_internal(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  version_number integer;
begin
  if not private.vf_is_adm() then
    raise exception 'Acesso negado: restauração exclusiva do ADM' using errcode = '42501';
  end if;

  version_number := coalesce((payload->>'version')::integer, 0);

  if version_number = 1 then
    return private.vf_restore_backup_v1(payload);
  end if;

  if version_number = 2 then
    return private.vf_restore_backup_v2(payload);
  end if;

  raise exception 'Arquivo de backup inválido ou incompatível' using errcode = '22023';
end;
$function$;

revoke execute on function private.vf_restore_backup_internal(jsonb) from public, anon;
grant execute on function private.vf_restore_backup_internal(jsonb) to authenticated, service_role;

create or replace function public.vf_restore_backup(payload jsonb)
returns jsonb
language sql
security invoker
set search_path to ''
as $function$
  select private.vf_restore_backup_internal(payload);
$function$;

revoke execute on function public.vf_restore_backup(jsonb) from public, anon;
grant execute on function public.vf_restore_backup(jsonb) to authenticated, service_role;

revoke execute on function private.vf_restore_backup_v1(jsonb) from public, anon, authenticated, service_role;
revoke execute on function private.vf_restore_backup_v2(jsonb) from public, anon, authenticated, service_role;

alter default privileges for role postgres in schema private revoke execute on functions from public;