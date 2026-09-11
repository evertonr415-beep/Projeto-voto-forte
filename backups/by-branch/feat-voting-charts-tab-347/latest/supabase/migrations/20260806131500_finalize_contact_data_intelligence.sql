begin;

alter table public.vf_contact_quality
  add column if not exists severity_rank smallint
  generated always as (
    case severity
      when 'critical' then 1
      when 'warning' then 2
      when 'info' then 3
      else 4
    end
  ) stored;

create index if not exists vf_contact_quality_owner_severity_rank_idx
  on public.vf_contact_quality(owner_email, severity_rank, updated_at desc, record_id desc);

create or replace function private.vf_release_contact_phone(
  p_record_id bigint,
  p_phone_normalized text
)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  promoted_record_id bigint;
begin
  if coalesce(p_phone_normalized, '') = '' then
    return;
  end if;

  delete from private.vf_contact_duplicate_exceptions
  where record_id = p_record_id;

  delete from private.vf_contact_phone_registry
  where record_id = p_record_id
    and phone_normalized = p_phone_normalized;

  if found then
    select e.record_id
      into promoted_record_id
    from private.vf_contact_duplicate_exceptions e
    where e.phone_normalized = p_phone_normalized
    order by e.record_id
    limit 1
    for update;

    if promoted_record_id is not null then
      delete from private.vf_contact_duplicate_exceptions
      where record_id = promoted_record_id;

      insert into private.vf_contact_phone_registry(phone_normalized, record_id)
      values (p_phone_normalized, promoted_record_id)
      on conflict (phone_normalized) do update
        set record_id = excluded.record_id;

      update public.vf_owned_records promoted
      set payload = promoted.payload - 'duplicateStatus',
          updated_at = now()
      where promoted.id = promoted_record_id
        and promoted.kind = 'contact';

      perform public.vf_sync_contact_quality_row(promoted_record_id);
    end if;
  end if;
end;
$$;

revoke all on function private.vf_release_contact_phone(bigint, text)
from public, anon, authenticated;
grant execute on function private.vf_release_contact_phone(bigint, text)
to service_role;

create or replace function private.vf_enforce_contact_phone_uniqueness()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  old_phone text := '';
  new_phone text := '';
  reserved_record_id bigint;
  is_legacy_exception boolean := false;
begin
  if tg_op in ('UPDATE', 'DELETE') and old.kind = 'contact' then
    old_phone := public.vf_normalize_contact_phone(
      coalesce(old.payload->>'phoneNormalized', old.payload->>'phone', '')
    );
  end if;

  if tg_op in ('INSERT', 'UPDATE') and new.kind = 'contact' then
    new_phone := public.vf_normalize_contact_phone(
      coalesce(new.payload->>'phoneNormalized', new.payload->>'phone', '')
    );
  end if;

  if old_phone <> '' and new_phone <> '' and old_phone <> new_phone then
    perform pg_catalog.pg_advisory_xact_lock(
      least(
        pg_catalog.hashtextextended(old_phone, 0),
        pg_catalog.hashtextextended(new_phone, 0)
      )
    );
    perform pg_catalog.pg_advisory_xact_lock(
      greatest(
        pg_catalog.hashtextextended(old_phone, 0),
        pg_catalog.hashtextextended(new_phone, 0)
      )
    );
  elsif coalesce(nullif(old_phone, ''), nullif(new_phone, '')) is not null then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(coalesce(nullif(old_phone, ''), new_phone), 0)
    );
  end if;

  if tg_op = 'DELETE' then
    perform private.vf_release_contact_phone(old.id, old_phone);
    return old;
  end if;

  if tg_op = 'UPDATE' and (old.kind <> new.kind or old_phone <> new_phone) then
    perform private.vf_release_contact_phone(old.id, old_phone);
  end if;

  if new.kind <> 'contact' or new_phone = '' then
    new.payload := new.payload - 'duplicateStatus';
    return new;
  end if;

  select exists (
    select 1
    from private.vf_contact_duplicate_exceptions exception_row
    where exception_row.record_id = new.id
      and exception_row.phone_normalized = new_phone
  ) into is_legacy_exception;

  if is_legacy_exception and tg_op = 'UPDATE' and old_phone = new_phone then
    new.payload := jsonb_set(
      new.payload,
      '{duplicateStatus}',
      '"existing_duplicate"'::jsonb,
      true
    );
    new.payload := jsonb_set(
      new.payload,
      '{phoneNormalized}',
      to_jsonb(new_phone),
      true
    );
    return new;
  end if;

  delete from private.vf_contact_duplicate_exceptions
  where record_id = new.id;

  insert into private.vf_contact_phone_registry(phone_normalized, record_id)
  values (new_phone, new.id)
  on conflict (phone_normalized) do nothing;

  select registry.record_id
    into reserved_record_id
  from private.vf_contact_phone_registry registry
  where registry.phone_normalized = new_phone;

  if reserved_record_id is distinct from new.id then
    raise exception 'Telefone já cadastrado em outro contato.'
      using errcode = '23505',
            constraint = 'vf_contact_phone_global_unique';
  end if;

  new.payload := jsonb_set(
    new.payload - 'duplicateStatus',
    '{phoneNormalized}',
    to_jsonb(new_phone),
    true
  );
  return new;
end;
$$;

revoke all on function private.vf_enforce_contact_phone_uniqueness()
from public, anon, authenticated;
grant execute on function private.vf_enforce_contact_phone_uniqueness()
to service_role;

update public.vf_owned_records contact
set payload = case
      when exists (
        select 1
        from private.vf_contact_duplicate_exceptions exception_row
        where exception_row.record_id = contact.id
      ) then jsonb_set(
        contact.payload,
        '{duplicateStatus}',
        '"existing_duplicate"'::jsonb,
        true
      )
      else contact.payload - 'duplicateStatus'
    end,
    updated_at = now()
where contact.kind = 'contact'
  and (
    contact.payload ? 'duplicateStatus'
    or exists (
      select 1
      from private.vf_contact_duplicate_exceptions exception_row
      where exception_row.record_id = contact.id
    )
  );

update public.vf_contact_quality quality
set has_duplicate_phone = false,
    issue_codes = array_remove(quality.issue_codes, 'duplicate_phone'),
    severity = case
      when quality.has_invalid_phone or quality.has_missing_location then 'critical'
      when quality.has_incomplete_location or quality.has_location_divergence then 'warning'
      when quality.is_rural then 'info'
      else 'ok'
    end,
    updated_at = now()
where quality.has_duplicate_phone
  and quality.phone_normalized = '';

create or replace function public.vf_import_contacts_deduplicated(
  p_owner_email text,
  p_contacts jsonb,
  p_import_session_id text default null,
  p_import_batch_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  caller_id bigint;
  caller_role text;
  target_owner public.vf_users%rowtype;
  contact jsonb;
  normalized_phone text;
  sanitized_payload jsonb;
  inserted_count integer := 0;
  duplicate_count integer := 0;
  invalid_count integer := 0;
  affected_rows integer := 0;
  previous_batch_count integer := 0;
  allowed boolean := false;
  recovered boolean := false;
begin
  if coalesce(jsonb_typeof(p_contacts), '') <> 'array' then
    raise exception 'Lista de contatos inválida.' using errcode = '22023';
  end if;

  if jsonb_array_length(p_contacts) > 500 then
    raise exception 'O lote excede 500 contatos.' using errcode = '22023';
  end if;

  select user_row.id, user_row.role
    into caller_id, caller_role
  from public.vf_users user_row
  where user_row.auth_user_id = (select auth.uid())
    and user_row.status = 'active'
  limit 1;

  if caller_id is null
     and coalesce((select auth.jwt()->>'role'), '') <> 'service_role' then
    raise exception 'Usuário sem acesso ativo.' using errcode = '42501';
  end if;

  select *
    into target_owner
  from public.vf_users user_row
  where lower(trim(user_row.email)) = lower(trim(p_owner_email))
    and user_row.status = 'active'
  limit 1;

  if target_owner.id is null then
    raise exception 'Responsável inválido.' using errcode = '22023';
  end if;

  if coalesce((select auth.jwt()->>'role'), '') = 'service_role'
     or caller_role = 'master' then
    allowed := true;
  elsif target_owner.id = caller_id then
    allowed := true;
  else
    with recursive descendants as (
      select user_row.id, array[user_row.id]::bigint[] as visited_ids
      from public.vf_users user_row
      where user_row.id = caller_id
        and user_row.status = 'active'

      union all

      select child.id, parent.visited_ids || child.id
      from public.vf_users child
      join descendants parent on child.parent_user_id = parent.id
      where child.status = 'active'
        and not child.id = any(parent.visited_ids)
    )
    select exists(select 1 from descendants where id = target_owner.id)
      into allowed;
  end if;

  if not allowed then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;

  if coalesce(trim(p_import_batch_id), '') <> '' then
    select count(*)
      into previous_batch_count
    from public.vf_owned_records existing
    where existing.kind = 'contact'
      and lower(trim(existing.owner_email)) = lower(trim(target_owner.email))
      and existing.payload->>'importBatchId' = trim(p_import_batch_id);
    recovered := previous_batch_count > 0;
  end if;

  for contact in select value from jsonb_array_elements(p_contacts)
  loop
    normalized_phone := public.vf_normalize_contact_phone(
      coalesce(contact->>'phoneNormalized', contact->>'phone', '')
    );

    if trim(coalesce(contact->>'name', '')) = ''
       or normalized_phone !~ '^[1-9][0-9]{9,10}$'
       or normalized_phone ~ '^([0-9])\1+$' then
      invalid_count := invalid_count + 1;
      continue;
    end if;

    sanitized_payload := jsonb_build_object(
      'name', trim(coalesce(contact->>'name', '')),
      'phone', trim(coalesce(contact->>'phone', '')),
      'phoneNormalized', normalized_phone,
      'district', trim(coalesce(contact->>'district', '')),
      'leader', trim(coalesce(contact->>'leader', '')),
      'kind', case
        when contact->>'kind' = 'Liderança' then 'Liderança'
        else 'Eleitor'
      end,
      'cep', trim(coalesce(contact->>'cep', '')),
      'street', trim(coalesce(contact->>'street', '')),
      'number', trim(coalesce(contact->>'number', '')),
      'city', trim(coalesce(contact->>'city', '')),
      'state', trim(coalesce(contact->>'state', ''))
    );

    if coalesce(trim(p_import_session_id), '') <> '' then
      sanitized_payload := sanitized_payload || jsonb_build_object(
        'importSessionId', trim(p_import_session_id)
      );
    end if;

    if coalesce(trim(p_import_batch_id), '') <> '' then
      sanitized_payload := sanitized_payload || jsonb_build_object(
        'importBatchId', trim(p_import_batch_id)
      );
    end if;

    begin
      insert into public.vf_owned_records(
        owner_id,
        owner_email,
        kind,
        payload,
        updated_at
      ) values (
        target_owner.auth_user_id,
        target_owner.email,
        'contact',
        sanitized_payload,
        now()
      )
      on conflict do nothing;

      get diagnostics affected_rows = row_count;
    exception
      when unique_violation then
        affected_rows := 0;
    end;

    if affected_rows = 1 then
      inserted_count := inserted_count + 1;
    else
      duplicate_count := duplicate_count + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'inserted', inserted_count,
    'duplicates', duplicate_count,
    'invalid', invalid_count,
    'recovered', recovered
  );
end;
$$;

revoke all on function public.vf_import_contacts_deduplicated(text, jsonb, text, text)
from public, anon;
grant execute on function public.vf_import_contacts_deduplicated(text, jsonb, text, text)
to authenticated, service_role;

create or replace function public.vf_delete_contact_quality_batch(
  p_record_ids bigint[],
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  caller_id bigint;
  caller_role text;
  requested_ids bigint[];
  requested_count integer;
  visible_count integer;
  deleted_count integer;
  is_service boolean := coalesce((select auth.jwt()->>'role'), '') = 'service_role';
begin
  select coalesce(array_agg(distinct requested_id), '{}'::bigint[])
    into requested_ids
  from unnest(coalesce(p_record_ids, '{}'::bigint[])) as requested(requested_id)
  where requested_id > 0;

  requested_count := cardinality(requested_ids);

  if p_confirmation <> 'EXCLUIR CONTATOS' then
    raise exception 'Confirmação inválida.' using errcode = '22023';
  end if;

  if requested_count = 0 or requested_count > 500 then
    raise exception 'Seleção inválida.' using errcode = '22023';
  end if;

  if not is_service then
    select user_row.id, user_row.role
      into caller_id, caller_role
    from public.vf_users user_row
    where user_row.auth_user_id = (select auth.uid())
      and user_row.status = 'active'
    limit 1;

    if caller_id is null then
      raise exception 'Usuário sem acesso ativo.' using errcode = '42501';
    end if;
  end if;

  if is_service or caller_role = 'master' then
    select count(*)
      into visible_count
    from public.vf_owned_records record
    where record.id = any(requested_ids)
      and record.kind = 'contact';
  else
    with recursive visible_users as (
      select user_row.id, lower(trim(user_row.email)) as email,
             array[user_row.id]::bigint[] as visited_ids
      from public.vf_users user_row
      where user_row.id = caller_id
        and user_row.status = 'active'

      union all

      select child.id, lower(trim(child.email)), parent.visited_ids || child.id
      from public.vf_users child
      join visible_users parent on child.parent_user_id = parent.id
      where child.status = 'active'
        and not child.id = any(parent.visited_ids)
    )
    select count(*)
      into visible_count
    from public.vf_owned_records record
    where record.id = any(requested_ids)
      and record.kind = 'contact'
      and lower(trim(record.owner_email)) in (
        select visible_user.email from visible_users visible_user
      );
  end if;

  if visible_count <> requested_count then
    raise exception 'A seleção contém contatos inexistentes ou sem acesso.'
      using errcode = '42501';
  end if;

  if is_service or caller_role = 'master' then
    delete from public.vf_owned_records record
    where record.id = any(requested_ids)
      and record.kind = 'contact';
  else
    with recursive visible_users as (
      select user_row.id, lower(trim(user_row.email)) as email,
             array[user_row.id]::bigint[] as visited_ids
      from public.vf_users user_row
      where user_row.id = caller_id
        and user_row.status = 'active'

      union all

      select child.id, lower(trim(child.email)), parent.visited_ids || child.id
      from public.vf_users child
      join visible_users parent on child.parent_user_id = parent.id
      where child.status = 'active'
        and not child.id = any(parent.visited_ids)
    )
    delete from public.vf_owned_records record
    where record.id = any(requested_ids)
      and record.kind = 'contact'
      and lower(trim(record.owner_email)) in (
        select visible_user.email from visible_users visible_user
      );
  end if;

  get diagnostics deleted_count = row_count;

  if deleted_count <> requested_count then
    raise exception 'A seleção mudou durante a exclusão.' using errcode = '40001';
  end if;

  insert into public.vf_audit_logs(
    actor_id,
    actor_email,
    action,
    detail
  ) values (
    (select auth.uid()),
    case when is_service then 'service_role' else (select auth.jwt()->>'email') end,
    'Exclusão em massa de contatos',
    deleted_count || ' contatos excluídos após confirmação explícita'
  );

  return jsonb_build_object('deleted', deleted_count);
end;
$$;

revoke all on function public.vf_delete_contact_quality_batch(bigint[], text)
from public, anon;
grant execute on function public.vf_delete_contact_quality_batch(bigint[], text)
to authenticated, service_role;

commit;
