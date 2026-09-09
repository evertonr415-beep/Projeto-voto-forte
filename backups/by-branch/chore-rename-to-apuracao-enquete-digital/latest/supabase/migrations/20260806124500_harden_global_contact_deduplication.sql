begin;

-- Replace the client-influenced partial index with an internal reservation model.
drop index if exists public.vf_owned_records_contact_phone_global_unique;

create schema if not exists private;

create table if not exists private.vf_contact_phone_registry (
  phone_normalized text primary key,
  record_id bigint not null unique references public.vf_owned_records(id) on delete cascade
);

create table if not exists private.vf_contact_duplicate_exceptions (
  record_id bigint primary key references public.vf_owned_records(id) on delete cascade,
  phone_normalized text not null
);

revoke all on table private.vf_contact_phone_registry from public, anon, authenticated;
revoke all on table private.vf_contact_duplicate_exceptions from public, anon, authenticated;
grant select, insert, update, delete on table private.vf_contact_phone_registry to service_role;
grant select, insert, update, delete on table private.vf_contact_duplicate_exceptions to service_role;

truncate table private.vf_contact_phone_registry;
truncate table private.vf_contact_duplicate_exceptions;

with ranked as (
  select
    r.id,
    public.vf_normalize_contact_phone(
      coalesce(r.payload->>'phoneNormalized', r.payload->>'phone', '')
    ) as phone_normalized,
    row_number() over (
      partition by public.vf_normalize_contact_phone(
        coalesce(r.payload->>'phoneNormalized', r.payload->>'phone', '')
      )
      order by r.id
    ) as duplicate_rank
  from public.vf_owned_records r
  where r.kind = 'contact'
    and public.vf_normalize_contact_phone(
      coalesce(r.payload->>'phoneNormalized', r.payload->>'phone', '')
    ) <> ''
)
insert into private.vf_contact_phone_registry(phone_normalized, record_id)
select phone_normalized, id
from ranked
where duplicate_rank = 1;

with ranked as (
  select
    r.id,
    public.vf_normalize_contact_phone(
      coalesce(r.payload->>'phoneNormalized', r.payload->>'phone', '')
    ) as phone_normalized,
    row_number() over (
      partition by public.vf_normalize_contact_phone(
        coalesce(r.payload->>'phoneNormalized', r.payload->>'phone', '')
      )
      order by r.id
    ) as duplicate_rank
  from public.vf_owned_records r
  where r.kind = 'contact'
    and public.vf_normalize_contact_phone(
      coalesce(r.payload->>'phoneNormalized', r.payload->>'phone', '')
    ) <> ''
)
insert into private.vf_contact_duplicate_exceptions(record_id, phone_normalized)
select id, phone_normalized
from ranked
where duplicate_rank > 1;

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
      on conflict (phone_normalized) do nothing;
    end if;
  end if;
end;
$$;

revoke all on function private.vf_release_contact_phone(bigint, text) from public, anon, authenticated;
grant execute on function private.vf_release_contact_phone(bigint, text) to service_role;

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
      least(pg_catalog.hashtextextended(old_phone, 0), pg_catalog.hashtextextended(new_phone, 0))
    );
    perform pg_catalog.pg_advisory_xact_lock(
      greatest(pg_catalog.hashtextextended(old_phone, 0), pg_catalog.hashtextextended(new_phone, 0))
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
    return new;
  end if;

  select exists (
    select 1
    from private.vf_contact_duplicate_exceptions e
    where e.record_id = new.id
      and e.phone_normalized = new_phone
  ) into is_legacy_exception;

  if is_legacy_exception and tg_op = 'UPDATE' and old_phone = new_phone then
    new.payload := new.payload - 'duplicateStatus';
    return new;
  end if;

  delete from private.vf_contact_duplicate_exceptions
  where record_id = new.id;

  insert into private.vf_contact_phone_registry(phone_normalized, record_id)
  values (new_phone, new.id)
  on conflict (phone_normalized) do nothing;

  select r.record_id
    into reserved_record_id
  from private.vf_contact_phone_registry r
  where r.phone_normalized = new_phone;

  if reserved_record_id is distinct from new.id then
    raise exception 'Telefone já cadastrado em outro contato.'
      using errcode = '23505',
            constraint = 'vf_contact_phone_global_unique';
  end if;

  new.payload := (new.payload - 'duplicateStatus')
    || jsonb_build_object('phoneNormalized', new_phone);
  return new;
end;
$$;

revoke all on function private.vf_enforce_contact_phone_uniqueness() from public, anon, authenticated;
grant execute on function private.vf_enforce_contact_phone_uniqueness() to service_role;

drop trigger if exists vf_enforce_contact_phone_uniqueness on public.vf_owned_records;
create trigger vf_enforce_contact_phone_uniqueness
before insert or update or delete on public.vf_owned_records
for each row execute function private.vf_enforce_contact_phone_uniqueness();

-- Classify both sides of a historical duplicate from the actual phone values.
with duplicate_phones as (
  select q.phone_normalized
  from public.vf_contact_quality q
  where q.phone_normalized <> ''
  group by q.phone_normalized
  having count(*) > 1
)
update public.vf_contact_quality q
set
  has_duplicate_phone = (d.phone_normalized is not null),
  issue_codes = case
    when d.phone_normalized is not null then
      array_append(array_remove(q.issue_codes, 'duplicate_phone'), 'duplicate_phone')
    else array_remove(q.issue_codes, 'duplicate_phone')
  end,
  severity = case
    when d.phone_normalized is not null
      or q.has_invalid_phone
      or q.has_missing_location then 'critical'
    when q.has_incomplete_location
      or q.has_location_divergence then 'warning'
    when q.is_rural then 'info'
    else 'ok'
  end,
  updated_at = now()
from duplicate_phones d
where q.phone_normalized = d.phone_normalized;

update public.vf_contact_quality q
set
  has_duplicate_phone = false,
  issue_codes = array_remove(q.issue_codes, 'duplicate_phone'),
  severity = case
    when q.has_invalid_phone or q.has_missing_location then 'critical'
    when q.has_incomplete_location or q.has_location_divergence then 'warning'
    when q.is_rural then 'info'
    else 'ok'
  end,
  updated_at = now()
where q.has_duplicate_phone
  and not exists (
    select 1
    from public.vf_contact_quality other
    where other.phone_normalized = q.phone_normalized
      and other.record_id <> q.record_id
  );

commit;
