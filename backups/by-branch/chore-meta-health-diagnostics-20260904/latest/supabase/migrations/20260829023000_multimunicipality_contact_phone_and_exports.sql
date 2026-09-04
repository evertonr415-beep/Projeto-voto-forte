-- Multi-município: mantém a unicidade de telefone dentro de cada município,
-- sem impedir que o mesmo telefone exista legitimamente em cidades distintas.
-- Também torna explícito o filtro municipal na criação de lotes de exportação.

alter table private.vf_contact_phone_registry
  add column if not exists municipality_id bigint;

update private.vf_contact_phone_registry registry
set municipality_id = records.municipality_id
from public.vf_owned_records records
where records.id = registry.record_id
  and registry.municipality_id is null;

alter table private.vf_contact_phone_registry
  alter column municipality_id set not null;

alter table private.vf_contact_phone_registry
  drop constraint if exists vf_contact_phone_registry_pkey;

alter table private.vf_contact_phone_registry
  add constraint vf_contact_phone_registry_pkey
  primary key (municipality_id, phone_normalized);

create index if not exists vf_contact_phone_registry_phone_idx
  on private.vf_contact_phone_registry (phone_normalized);

create index if not exists vf_contact_phone_registry_municipality_record_idx
  on private.vf_contact_phone_registry (municipality_id, record_id);

create or replace function private.vf_release_contact_phone(
  p_record_id bigint,
  p_phone_normalized text
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  promoted_record_id bigint;
  v_municipality_id bigint;
begin
  if coalesce(p_phone_normalized, '') = '' then
    return;
  end if;

  select records.municipality_id
    into v_municipality_id
  from public.vf_owned_records records
  where records.id = p_record_id;

  if v_municipality_id is null then
    delete from private.vf_contact_duplicate_exceptions
    where record_id = p_record_id;
    return;
  end if;

  delete from private.vf_contact_duplicate_exceptions
  where record_id = p_record_id;

  delete from private.vf_contact_phone_registry
  where municipality_id = v_municipality_id
    and record_id = p_record_id
    and phone_normalized = p_phone_normalized;

  if found then
    select exception_row.record_id
      into promoted_record_id
    from private.vf_contact_duplicate_exceptions exception_row
    join public.vf_owned_records promoted_record
      on promoted_record.id = exception_row.record_id
    where exception_row.phone_normalized = p_phone_normalized
      and promoted_record.municipality_id = v_municipality_id
    order by exception_row.record_id
    limit 1
    for update of exception_row;

    if promoted_record_id is not null then
      delete from private.vf_contact_duplicate_exceptions
      where record_id = promoted_record_id;

      insert into private.vf_contact_phone_registry(
        municipality_id,
        phone_normalized,
        record_id
      )
      values (
        v_municipality_id,
        p_phone_normalized,
        promoted_record_id
      )
      on conflict (municipality_id, phone_normalized) do update
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
$function$;

create or replace function private.vf_enforce_contact_phone_uniqueness()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  old_phone text := '';
  new_phone text := '';
  old_lock_key text := '';
  new_lock_key text := '';
  reserved_record_id bigint;
  is_legacy_exception boolean := false;
begin
  if tg_op in ('UPDATE', 'DELETE') and old.kind = 'contact' then
    old_phone := public.vf_normalize_contact_phone(
      coalesce(old.payload->>'phoneNormalized', old.payload->>'phone', '')
    );
    old_lock_key := old.municipality_id::text || ':' || old_phone;
  end if;

  if tg_op in ('INSERT', 'UPDATE') and new.kind = 'contact' then
    new_phone := public.vf_normalize_contact_phone(
      coalesce(new.payload->>'phoneNormalized', new.payload->>'phone', '')
    );
    new_lock_key := new.municipality_id::text || ':' || new_phone;
  end if;

  if old_phone <> '' and new_phone <> '' and old_lock_key <> new_lock_key then
    perform pg_catalog.pg_advisory_xact_lock(
      least(
        pg_catalog.hashtextextended(old_lock_key, 0),
        pg_catalog.hashtextextended(new_lock_key, 0)
      )
    );
    perform pg_catalog.pg_advisory_xact_lock(
      greatest(
        pg_catalog.hashtextextended(old_lock_key, 0),
        pg_catalog.hashtextextended(new_lock_key, 0)
      )
    );
  elsif coalesce(nullif(old_lock_key, ''), nullif(new_lock_key, '')) is not null then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        coalesce(nullif(old_lock_key, ''), new_lock_key),
        0
      )
    );
  end if;

  if tg_op = 'DELETE' then
    perform private.vf_release_contact_phone(old.id, old_phone);
    return old;
  end if;

  if tg_op = 'UPDATE' and (
    old.kind <> new.kind
    or old_phone <> new_phone
    or old.municipality_id <> new.municipality_id
  ) then
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

  if is_legacy_exception
     and tg_op = 'UPDATE'
     and old_phone = new_phone
     and old.municipality_id = new.municipality_id then
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

  insert into private.vf_contact_phone_registry(
    municipality_id,
    phone_normalized,
    record_id
  )
  values (
    new.municipality_id,
    new_phone,
    new.id
  )
  on conflict (municipality_id, phone_normalized) do nothing;

  select registry.record_id
    into reserved_record_id
  from private.vf_contact_phone_registry registry
  where registry.municipality_id = new.municipality_id
    and registry.phone_normalized = new_phone;

  if reserved_record_id is distinct from new.id then
    raise exception 'Telefone já cadastrado em outro contato deste município.'
      using errcode = '23505',
            constraint = 'vf_contact_phone_municipality_unique';
  end if;

  new.payload := jsonb_set(
    new.payload - 'duplicateStatus',
    '{phoneNormalized}',
    to_jsonb(new_phone),
    true
  );
  return new;
end;
$function$;

create or replace function public.vf_create_contact_export(
  p_owner_scope text,
  p_format text
)
returns table(export_id uuid, item_count integer)
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_export_id uuid;
  v_count integer;
  v_actor_email text;
  v_scope text;
  v_municipality_id bigint;
begin
  if auth.uid() is null then
    raise exception 'Não autenticado';
  end if;

  if lower(coalesce(p_format, '')) not in ('csv', 'xlsx', 'vcf') then
    raise exception 'Formato de exportação inválido';
  end if;

  v_actor_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  if v_actor_email = '' then
    raise exception 'E-mail autenticado indisponível';
  end if;

  v_scope := lower(trim(coalesce(nullif(p_owner_scope, ''), v_actor_email)));
  v_municipality_id := private.vf_current_municipality_id();

  insert into public.vf_contact_exports (
    actor_id,
    actor_email,
    owner_scope,
    format,
    municipality_id
  ) values (
    auth.uid(),
    v_actor_email,
    v_scope,
    lower(p_format),
    v_municipality_id
  )
  returning id into v_export_id;

  insert into public.vf_contact_export_items (
    export_id,
    record_id,
    owner_email,
    snapshot
  )
  select
    v_export_id,
    records.id,
    records.owner_email,
    jsonb_build_object(
      'name', coalesce(records.payload ->> 'name', ''),
      'phone', coalesce(records.payload ->> 'phone', ''),
      'kind', coalesce(records.payload ->> 'kind', 'Eleitor'),
      'district', coalesce(records.payload ->> 'district', ''),
      'cep', coalesce(records.payload ->> 'cep', ''),
      'street', coalesce(records.payload ->> 'street', ''),
      'number', coalesce(records.payload ->> 'number', ''),
      'leader', coalesce(records.payload ->> 'leader', ''),
      'city', coalesce(records.payload ->> 'city', ''),
      'state', coalesce(records.payload ->> 'state', '')
    )
  from public.vf_owned_records records
  where records.kind = 'contact'
    and records.municipality_id = v_municipality_id
    and (v_scope = 'all' or lower(records.owner_email) = v_scope)
  order by records.id;

  get diagnostics v_count = row_count;

  update public.vf_contact_exports
  set item_count = v_count
  where id = v_export_id
    and municipality_id = v_municipality_id;

  insert into public.vf_audit_logs (
    actor_id,
    actor_email,
    action,
    detail
  ) values (
    auth.uid(),
    v_actor_email,
    'Exportação de contatos',
    upper(p_format) || ' · ' || v_count || ' contatos · lote ' || v_export_id::text
  );

  return query select v_export_id, v_count;
end;
$function$;
