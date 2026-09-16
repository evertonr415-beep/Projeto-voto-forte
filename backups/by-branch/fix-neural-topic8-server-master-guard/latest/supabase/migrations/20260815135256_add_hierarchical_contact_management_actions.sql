create or replace function private.vf_can_assign_to_user(p_user_id bigint)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (
    select 1
    from public.vf_users me
    join public.vf_users target on target.id = p_user_id
    where me.auth_user_id = (select auth.uid())
      and me.status = 'active'
      and me.access_role <> 'eleitor'
      and target.status = 'active'
      and target.access_role <> 'eleitor'
      and (
        me.access_role = 'adm'
        or target.id in (select v.user_id from private.vf_visible_user_ids() v)
      )
  );
$function$;

create or replace function private.vf_import_selection_record_ids(
  p_creator_user_id bigint,
  p_import_batch_id text default null
)
returns table(record_id bigint)
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if p_creator_user_id is null then
    raise exception 'O importador é obrigatório.' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.vf_users me
    where me.auth_user_id = (select auth.uid())
      and me.status = 'active'
      and me.access_role in ('adm','master','lideranca','liderado')
  ) then
    raise exception 'Usuário sem permissão para gerenciar contatos.' using errcode = '42501';
  end if;

  if not private.vf_can_view_user(p_creator_user_id) then
    raise exception 'Importador fora da hierarquia visível.' using errcode = '42501';
  end if;

  return query
  select r.id
  from private.vf_record_provenance p
  join public.vf_owned_records r
    on r.id = p.record_id
   and r.kind = 'contact'
  where p.created_by_user_id = p_creator_user_id
    and private.vf_can_manage_record(r.id)
    and (
      (p_import_batch_id is null and nullif(btrim(coalesce(r.payload->>'importBatchId','')), '') is null)
      or
      (p_import_batch_id is not null and nullif(btrim(coalesce(r.payload->>'importBatchId','')), '') = btrim(p_import_batch_id))
    );
end;
$function$;

revoke execute on function private.vf_import_selection_record_ids(bigint, text) from public, anon;
grant execute on function private.vf_import_selection_record_ids(bigint, text) to authenticated, service_role;

create or replace function public.vf_contact_management_capabilities(p_record_id bigint)
returns table(
  record_id bigint,
  actor_role text,
  can_edit boolean,
  can_reassign boolean,
  can_delete boolean,
  can_message boolean,
  assigned_user_id bigint
)
language sql
stable
security invoker
set search_path to ''
as $function$
  select
    r.id,
    me.access_role,
    private.vf_can_manage_record(r.id),
    private.vf_can_manage_record(r.id) and me.access_role <> 'eleitor',
    private.vf_can_manage_record(r.id),
    private.vf_can_view_record(r.id),
    r.assigned_user_id
  from public.vf_owned_records r
  join public.vf_users me
    on me.auth_user_id = (select auth.uid())
   and me.status = 'active'
  where r.id = p_record_id
    and r.kind = 'contact';
$function$;

revoke execute on function public.vf_contact_management_capabilities(bigint) from public, anon;
grant execute on function public.vf_contact_management_capabilities(bigint) to authenticated, service_role;

create or replace function public.vf_contact_update_managed(
  p_record_id bigint,
  p_patch jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path to ''
as $function$
declare
  current_payload jsonb;
  updated_payload jsonb;
  actor_email text;
  changed_fields text;
  latitude_value double precision;
  longitude_value double precision;
  has_latitude boolean;
  has_longitude boolean;
  has_address_change boolean;
begin
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'A alteração do contato deve ser um objeto JSON.' using errcode = '22023';
  end if;

  if not private.vf_can_manage_record(p_record_id) then
    raise exception 'Sem permissão para editar este contato.' using errcode = '42501';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(p_patch) as k(key)
    where k.key not in (
      'name','phone','district','street','number','cep','city','state','kind',
      'latitude','longitude','locationLabel','locationPrecision'
    )
  ) then
    raise exception 'A alteração contém campos não permitidos.' using errcode = '22023';
  end if;

  select r.payload into current_payload
  from public.vf_owned_records r
  where r.id = p_record_id
    and r.kind = 'contact';

  if current_payload is null then
    raise exception 'Contato não encontrado.' using errcode = 'P0002';
  end if;

  if jsonb_exists(p_patch, 'kind')
     and coalesce(p_patch->>'kind','') not in ('Eleitor','Liderança') then
    raise exception 'O perfil deve ser Eleitor ou Liderança.' using errcode = '22023';
  end if;

  has_latitude := jsonb_exists(p_patch, 'latitude');
  has_longitude := jsonb_exists(p_patch, 'longitude');

  if has_latitude <> has_longitude then
    raise exception 'Latitude e longitude devem ser informadas juntas.' using errcode = '22023';
  end if;

  if has_latitude and nullif(btrim(coalesce(p_patch->>'latitude','')), '') is not null then
    latitude_value := public.vf_map_coordinate(p_patch->>'latitude');
    longitude_value := public.vf_map_coordinate(p_patch->>'longitude');
    if latitude_value is null or longitude_value is null
       or latitude_value < -90 or latitude_value > 90
       or longitude_value < -180 or longitude_value > 180 then
      raise exception 'Coordenadas inválidas.' using errcode = '22023';
    end if;
  end if;

  updated_payload := current_payload || p_patch;

  if jsonb_exists(p_patch, 'phone') then
    updated_payload := updated_payload - 'phoneNormalized' - 'duplicateStatus';
  end if;

  has_address_change :=
    jsonb_exists(p_patch, 'district')
    or jsonb_exists(p_patch, 'street')
    or jsonb_exists(p_patch, 'number')
    or jsonb_exists(p_patch, 'cep')
    or jsonb_exists(p_patch, 'city')
    or jsonb_exists(p_patch, 'state');

  if has_address_change and not (has_latitude and has_longitude) then
    updated_payload := updated_payload
      - 'latitude'
      - 'longitude'
      - 'locationLabel'
      - 'locationPrecision';
  elsif has_latitude and nullif(btrim(coalesce(p_patch->>'latitude','')), '') is null then
    updated_payload := updated_payload
      - 'latitude'
      - 'longitude'
      - 'locationLabel'
      - 'locationPrecision';
  end if;

  update public.vf_owned_records
  set payload = updated_payload,
      updated_at = now()
  where id = p_record_id
    and kind = 'contact';

  if not found then
    raise exception 'O contato não pôde ser atualizado pela hierarquia atual.' using errcode = '42501';
  end if;

  select u.email into actor_email
  from public.vf_users u
  where u.auth_user_id = (select auth.uid())
    and u.status = 'active'
  limit 1;

  select string_agg(k.key, ', ' order by k.key) into changed_fields
  from jsonb_object_keys(p_patch) as k(key);

  insert into public.vf_audit_logs(actor_id, actor_email, action, detail)
  values (
    (select auth.uid()),
    coalesce(actor_email, ''),
    'Contato atualizado',
    format('Registro %s; campos: %s', p_record_id, coalesce(changed_fields, ''))
  );

  return jsonb_build_object(
    'recordId', p_record_id,
    'updated', true,
    'fields', coalesce(changed_fields, '')
  );
end;
$function$;

revoke execute on function public.vf_contact_update_managed(bigint, jsonb) from public, anon;
grant execute on function public.vf_contact_update_managed(bigint, jsonb) to authenticated, service_role;

create or replace function public.vf_contact_reassign_managed(
  p_record_id bigint,
  p_target_user_id bigint
)
returns jsonb
language plpgsql
security invoker
set search_path to ''
as $function$
declare
  target public.vf_users%rowtype;
  old_assigned_user_id bigint;
  actor_email text;
begin
  if not private.vf_can_manage_record(p_record_id) then
    raise exception 'Sem permissão para reatribuir este contato.' using errcode = '42501';
  end if;

  if not private.vf_can_assign_to_user(p_target_user_id) then
    raise exception 'O novo responsável está fora da hierarquia permitida ou não pode receber contatos.' using errcode = '42501';
  end if;

  select * into target
  from public.vf_users u
  where u.id = p_target_user_id
    and u.status = 'active'
    and u.access_role <> 'eleitor';

  if target.id is null then
    raise exception 'Responsável de destino inválido.' using errcode = '22023';
  end if;

  select r.assigned_user_id into old_assigned_user_id
  from public.vf_owned_records r
  where r.id = p_record_id
    and r.kind = 'contact';

  if old_assigned_user_id is null then
    raise exception 'Contato não encontrado.' using errcode = 'P0002';
  end if;

  update public.vf_owned_records
  set owner_id = target.auth_user_id,
      assigned_user_id = target.id,
      updated_at = now()
  where id = p_record_id
    and kind = 'contact';

  if not found then
    raise exception 'O contato não pôde ser reatribuído pela hierarquia atual.' using errcode = '42501';
  end if;

  select u.email into actor_email
  from public.vf_users u
  where u.auth_user_id = (select auth.uid())
    and u.status = 'active'
  limit 1;

  insert into public.vf_audit_logs(actor_id, actor_email, action, detail)
  values (
    (select auth.uid()),
    coalesce(actor_email, ''),
    'Contato reatribuído',
    format('Registro %s; responsável anterior %s; novo responsável %s (%s)',
      p_record_id, old_assigned_user_id, target.id, target.name)
  );

  return jsonb_build_object(
    'recordId', p_record_id,
    'reassigned', true,
    'previousAssignedUserId', old_assigned_user_id,
    'assignedUserId', target.id,
    'assignedUserName', target.name
  );
end;
$function$;

revoke execute on function public.vf_contact_reassign_managed(bigint, bigint) from public, anon;
grant execute on function public.vf_contact_reassign_managed(bigint, bigint) to authenticated, service_role;

create or replace function public.vf_contact_delete_managed(
  p_record_id bigint,
  p_confirm_record_id bigint
)
returns jsonb
language plpgsql
security invoker
set search_path to ''
as $function$
declare
  contact_name text;
  actor_email text;
begin
  if p_confirm_record_id is distinct from p_record_id then
    raise exception 'Confirmação do contato inválida.' using errcode = '22023';
  end if;

  if not private.vf_can_manage_record(p_record_id) then
    raise exception 'Sem permissão para excluir este contato.' using errcode = '42501';
  end if;

  select coalesce(nullif(btrim(r.payload->>'name'), ''), 'Contato') into contact_name
  from public.vf_owned_records r
  where r.id = p_record_id
    and r.kind = 'contact';

  if contact_name is null then
    raise exception 'Contato não encontrado.' using errcode = 'P0002';
  end if;

  delete from public.vf_owned_records
  where id = p_record_id
    and kind = 'contact';

  if not found then
    raise exception 'O contato não pôde ser excluído pela hierarquia atual.' using errcode = '42501';
  end if;

  select u.email into actor_email
  from public.vf_users u
  where u.auth_user_id = (select auth.uid())
    and u.status = 'active'
  limit 1;

  insert into public.vf_audit_logs(actor_id, actor_email, action, detail)
  values (
    (select auth.uid()),
    coalesce(actor_email, ''),
    'Contato excluído',
    format('Registro %s; contato %s', p_record_id, contact_name)
  );

  return jsonb_build_object(
    'recordId', p_record_id,
    'deleted', true,
    'contactName', contact_name
  );
end;
$function$;

revoke execute on function public.vf_contact_delete_managed(bigint, bigint) from public, anon;
grant execute on function public.vf_contact_delete_managed(bigint, bigint) to authenticated, service_role;

create or replace function public.vf_import_selection_preview(
  p_creator_user_id bigint,
  p_import_batch_id text default null
)
returns table(
  total_contacts bigint,
  voters bigint,
  leaders bigint,
  current_assignees bigint,
  needs_review bigint,
  can_reassign boolean,
  can_delete boolean,
  actor_role text
)
language sql
stable
security invoker
set search_path to ''
as $function$
  with ids as (
    select s.record_id
    from private.vf_import_selection_record_ids(p_creator_user_id, p_import_batch_id) s
  ), me as (
    select u.access_role
    from public.vf_users u
    where u.auth_user_id = (select auth.uid())
      and u.status = 'active'
    limit 1
  ), base as (
    select r.*, q.severity
    from public.vf_owned_records r
    join ids on ids.record_id = r.id
    left join public.vf_contact_quality q on q.record_id = r.id
  )
  select
    count(*)::bigint,
    count(*) filter (where coalesce(base.payload->>'kind','') <> 'Liderança')::bigint,
    count(*) filter (where base.payload->>'kind' = 'Liderança')::bigint,
    count(distinct base.assigned_user_id)::bigint,
    count(*) filter (where base.severity in ('warning','critical'))::bigint,
    count(*) > 0 and exists (select 1 from me where access_role <> 'eleitor'),
    count(*) > 0 and exists (select 1 from me where access_role <> 'eleitor'),
    (select access_role from me)
  from base;
$function$;

revoke execute on function public.vf_import_selection_preview(bigint, text) from public, anon;
grant execute on function public.vf_import_selection_preview(bigint, text) to authenticated, service_role;

create or replace function public.vf_import_selection_reassign(
  p_creator_user_id bigint,
  p_import_batch_id text,
  p_target_user_id bigint,
  p_expected_count bigint
)
returns jsonb
language plpgsql
security invoker
set search_path to ''
as $function$
declare
  target public.vf_users%rowtype;
  selection_count bigint;
  changed_count bigint;
  actor_email text;
begin
  if p_expected_count is null or p_expected_count < 1 then
    raise exception 'A quantidade esperada deve ser maior que zero.' using errcode = '22023';
  end if;

  if not private.vf_can_assign_to_user(p_target_user_id) then
    raise exception 'O novo responsável está fora da hierarquia permitida ou não pode receber contatos.' using errcode = '42501';
  end if;

  select * into target
  from public.vf_users u
  where u.id = p_target_user_id
    and u.status = 'active'
    and u.access_role <> 'eleitor';

  if target.id is null then
    raise exception 'Responsável de destino inválido.' using errcode = '22023';
  end if;

  select count(*) into selection_count
  from private.vf_import_selection_record_ids(p_creator_user_id, p_import_batch_id);

  if selection_count <> p_expected_count then
    raise exception 'A seleção mudou: esperado %, encontrado %. Atualize a tela antes de confirmar.', p_expected_count, selection_count
      using errcode = '40001';
  end if;

  update public.vf_owned_records r
  set owner_id = target.auth_user_id,
      assigned_user_id = target.id,
      updated_at = now()
  where r.id in (
    select s.record_id
    from private.vf_import_selection_record_ids(p_creator_user_id, p_import_batch_id) s
  )
    and r.kind = 'contact';

  get diagnostics changed_count = row_count;

  if changed_count <> selection_count then
    raise exception 'Nem todos os contatos puderam ser reatribuídos. Nenhuma alteração foi concluída.' using errcode = '40001';
  end if;

  select u.email into actor_email
  from public.vf_users u
  where u.auth_user_id = (select auth.uid())
    and u.status = 'active'
  limit 1;

  insert into public.vf_audit_logs(actor_id, actor_email, action, detail)
  values (
    (select auth.uid()),
    coalesce(actor_email, ''),
    'Lote de contatos reatribuído',
    format('Importador %s; lote %s; %s contatos; novo responsável %s (%s)',
      p_creator_user_id, coalesce(p_import_batch_id, 'manual'), changed_count, target.id, target.name)
  );

  return jsonb_build_object(
    'reassigned', true,
    'count', changed_count,
    'creatorUserId', p_creator_user_id,
    'importBatchId', p_import_batch_id,
    'assignedUserId', target.id,
    'assignedUserName', target.name
  );
end;
$function$;

revoke execute on function public.vf_import_selection_reassign(bigint, text, bigint, bigint) from public, anon;
grant execute on function public.vf_import_selection_reassign(bigint, text, bigint, bigint) to authenticated, service_role;

create or replace function public.vf_import_selection_delete(
  p_creator_user_id bigint,
  p_import_batch_id text,
  p_expected_count bigint
)
returns jsonb
language plpgsql
security invoker
set search_path to ''
as $function$
declare
  selection_count bigint;
  deleted_count bigint;
  actor_email text;
begin
  if p_expected_count is null or p_expected_count < 1 then
    raise exception 'A quantidade esperada deve ser maior que zero.' using errcode = '22023';
  end if;

  select count(*) into selection_count
  from private.vf_import_selection_record_ids(p_creator_user_id, p_import_batch_id);

  if selection_count <> p_expected_count then
    raise exception 'A seleção mudou: esperado %, encontrado %. Atualize a tela antes de confirmar.', p_expected_count, selection_count
      using errcode = '40001';
  end if;

  delete from public.vf_owned_records r
  where r.id in (
    select s.record_id
    from private.vf_import_selection_record_ids(p_creator_user_id, p_import_batch_id) s
  )
    and r.kind = 'contact';

  get diagnostics deleted_count = row_count;

  if deleted_count <> selection_count then
    raise exception 'Nem todos os contatos puderam ser excluídos. Nenhuma exclusão foi concluída.' using errcode = '40001';
  end if;

  select u.email into actor_email
  from public.vf_users u
  where u.auth_user_id = (select auth.uid())
    and u.status = 'active'
  limit 1;

  insert into public.vf_audit_logs(actor_id, actor_email, action, detail)
  values (
    (select auth.uid()),
    coalesce(actor_email, ''),
    'Lote de contatos excluído',
    format('Importador %s; lote %s; %s contatos excluídos',
      p_creator_user_id, coalesce(p_import_batch_id, 'manual'), deleted_count)
  );

  return jsonb_build_object(
    'deleted', true,
    'count', deleted_count,
    'creatorUserId', p_creator_user_id,
    'importBatchId', p_import_batch_id
  );
end;
$function$;

revoke execute on function public.vf_import_selection_delete(bigint, text, bigint) from public, anon;
grant execute on function public.vf_import_selection_delete(bigint, text, bigint) to authenticated, service_role;

create or replace function public.vf_import_selection_communication(
  p_creator_user_id bigint,
  p_import_batch_id text default null,
  p_limit integer default 500,
  p_offset integer default 0
)
returns table(
  total_count bigint,
  record_id bigint,
  contact_name text,
  phone text,
  phone_normalized text,
  phone_status text,
  profile text,
  district text,
  assigned_user_id bigint,
  assigned_user_name text
)
language plpgsql
stable
security invoker
set search_path to ''
as $function$
begin
  if p_limit is null or p_limit < 1 or p_limit > 1000 then
    raise exception 'O limite deve estar entre 1 e 1000.' using errcode = '22023';
  end if;

  if p_offset is null or p_offset < 0 then
    raise exception 'O deslocamento não pode ser negativo.' using errcode = '22023';
  end if;

  return query
  with ids as (
    select s.record_id
    from private.vf_import_selection_record_ids(p_creator_user_id, p_import_batch_id) s
  ), base as (
    select
      r.id,
      coalesce(nullif(btrim(r.payload->>'name'), ''), 'Contato')::text as contact_name,
      coalesce(r.payload->>'phone','')::text as phone,
      public.vf_normalize_contact_phone(coalesce(r.payload->>'phoneNormalized', r.payload->>'phone', ''))::text as phone_normalized,
      case
        when q.has_invalid_phone then 'invalid'
        when q.has_duplicate_phone then 'duplicate'
        else 'valid'
      end::text as phone_status,
      case when r.payload->>'kind' = 'Liderança' then 'Liderança' else 'Eleitor' end::text as profile,
      coalesce(r.payload->>'district','')::text as district,
      r.assigned_user_id,
      u.name::text as assigned_user_name,
      r.updated_at
    from public.vf_owned_records r
    join ids on ids.record_id = r.id
    join public.vf_users u on u.id = r.assigned_user_id
    left join public.vf_contact_quality q on q.record_id = r.id
    where r.kind = 'contact'
  )
  select
    count(*) over()::bigint,
    b.id,
    b.contact_name,
    b.phone,
    b.phone_normalized,
    b.phone_status,
    b.profile,
    b.district,
    b.assigned_user_id,
    b.assigned_user_name
  from base b
  order by b.updated_at desc, b.id desc
  limit p_limit
  offset p_offset;
end;
$function$;

revoke execute on function public.vf_import_selection_communication(bigint, text, integer, integer) from public, anon;
grant execute on function public.vf_import_selection_communication(bigint, text, integer, integer) to authenticated, service_role;