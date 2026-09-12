begin;

create index if not exists vf_owned_records_contact_phone_lookup_idx
on public.vf_owned_records (
  public.vf_normalize_contact_phone(
    coalesce(payload->>'phoneNormalized', payload->>'phone', '')
  )
)
where kind = 'contact'
  and public.vf_normalize_contact_phone(
    coalesce(payload->>'phoneNormalized', payload->>'phone', '')
  ) <> '';

create or replace function public.vf_sync_contact_quality_row(p_record_id bigint)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  r public.vf_owned_records%rowtype;
  normalized_phone text;
  district_value text;
  city_value text;
  state_value text;
  street_value text;
  number_value text;
  cep_value text;
  rural boolean;
  invalid_phone boolean;
  missing_location boolean;
  incomplete_location boolean;
  location_divergence boolean;
  duplicate_phone boolean;
  codes text[] := '{}'::text[];
  quality_severity text := 'ok';
begin
  delete from public.vf_contact_quality where record_id = p_record_id;

  select * into r
  from public.vf_owned_records
  where id = p_record_id;

  if not found or r.kind <> 'contact' then
    return;
  end if;

  normalized_phone := public.vf_normalize_contact_phone(
    coalesce(r.payload->>'phoneNormalized', r.payload->>'phone', '')
  );
  district_value := trim(coalesce(r.payload->>'district', ''));
  city_value := trim(coalesce(r.payload->>'city', ''));
  state_value := trim(coalesce(r.payload->>'state', ''));
  street_value := trim(coalesce(r.payload->>'street', ''));
  number_value := trim(coalesce(r.payload->>'number', ''));
  cep_value := trim(coalesce(r.payload->>'cep', ''));

  rural := public.vf_is_rural_location(district_value);
  invalid_phone := normalized_phone !~ '^[1-9][0-9]{9,10}$'
    or normalized_phone ~ '^([0-9])\1+$';
  missing_location := district_value = ''
    and city_value = ''
    and street_value = ''
    and cep_value = '';
  incomplete_location := not missing_location
    and (district_value = '' or city_value = '' or state_value = '');
  location_divergence := district_value <> ''
    and not rural
    and public.vf_canonical_arapongas_district(district_value) is null;
  duplicate_phone := normalized_phone <> '' and exists (
    select 1
    from public.vf_owned_records other
    where other.kind = 'contact'
      and other.id <> r.id
      and public.vf_normalize_contact_phone(
        coalesce(other.payload->>'phoneNormalized', other.payload->>'phone', '')
      ) = normalized_phone
  );

  if duplicate_phone then codes := array_append(codes, 'duplicate_phone'); end if;
  if invalid_phone then codes := array_append(codes, 'invalid_phone'); end if;
  if missing_location then codes := array_append(codes, 'missing_location'); end if;
  if incomplete_location then codes := array_append(codes, 'incomplete_location'); end if;
  if location_divergence then codes := array_append(codes, 'location_divergence'); end if;
  if rural then codes := array_append(codes, 'rural_location'); end if;

  if duplicate_phone or invalid_phone or missing_location then
    quality_severity := 'critical';
  elsif incomplete_location or location_divergence then
    quality_severity := 'warning';
  elsif rural then
    quality_severity := 'info';
  end if;

  insert into public.vf_contact_quality(
    record_id, owner_email, contact_name, phone, phone_normalized,
    district_original, city, state, street, street_number, cep,
    is_rural, has_invalid_phone, has_missing_location,
    has_incomplete_location, has_location_divergence,
    has_duplicate_phone, issue_codes, severity, updated_at
  ) values (
    r.id,
    lower(trim(r.owner_email)),
    trim(coalesce(r.payload->>'name', '')),
    trim(coalesce(r.payload->>'phone', '')),
    normalized_phone,
    district_value,
    city_value,
    state_value,
    street_value,
    number_value,
    cep_value,
    rural,
    invalid_phone,
    missing_location,
    incomplete_location,
    location_divergence,
    duplicate_phone,
    codes,
    quality_severity,
    now()
  );
end;
$$;

revoke all on function public.vf_sync_contact_quality_row(bigint)
from public, anon, authenticated;
grant execute on function public.vf_sync_contact_quality_row(bigint)
to service_role;

create or replace function private.vf_refresh_contact_duplicate_quality()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  old_phone text := '';
  new_phone text := '';
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

  update public.vf_contact_quality q
  set
    has_duplicate_phone = exists (
      select 1
      from public.vf_owned_records other
      where other.kind = 'contact'
        and other.id <> q.record_id
        and public.vf_normalize_contact_phone(
          coalesce(other.payload->>'phoneNormalized', other.payload->>'phone', '')
        ) = q.phone_normalized
    ),
    issue_codes = case
      when exists (
        select 1
        from public.vf_owned_records other
        where other.kind = 'contact'
          and other.id <> q.record_id
          and public.vf_normalize_contact_phone(
            coalesce(other.payload->>'phoneNormalized', other.payload->>'phone', '')
          ) = q.phone_normalized
      ) then array_append(array_remove(q.issue_codes, 'duplicate_phone'), 'duplicate_phone')
      else array_remove(q.issue_codes, 'duplicate_phone')
    end,
    severity = case
      when exists (
        select 1
        from public.vf_owned_records other
        where other.kind = 'contact'
          and other.id <> q.record_id
          and public.vf_normalize_contact_phone(
            coalesce(other.payload->>'phoneNormalized', other.payload->>'phone', '')
          ) = q.phone_normalized
      ) or q.has_invalid_phone or q.has_missing_location then 'critical'
      when q.has_incomplete_location or q.has_location_divergence then 'warning'
      when q.is_rural then 'info'
      else 'ok'
    end,
    updated_at = now()
  where q.phone_normalized <> ''
    and q.phone_normalized in (old_phone, new_phone);

  return coalesce(new, old);
end;
$$;

revoke all on function private.vf_refresh_contact_duplicate_quality()
from public, anon, authenticated;
grant execute on function private.vf_refresh_contact_duplicate_quality()
to service_role;

drop trigger if exists vf_refresh_contact_duplicate_quality
on public.vf_owned_records;
create trigger vf_refresh_contact_duplicate_quality
after insert or update or delete on public.vf_owned_records
for each row execute function private.vf_refresh_contact_duplicate_quality();

commit;
