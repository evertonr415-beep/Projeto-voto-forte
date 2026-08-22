begin;

alter table public.vf_contact_quality
  add column if not exists has_missing_name boolean not null default false,
  add column if not exists has_incomplete_name boolean not null default false,
  add column if not exists has_missing_district boolean not null default false,
  add column if not exists has_missing_street boolean not null default false;

create or replace function public.vf_sync_contact_quality_row(p_record_id bigint)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  r public.vf_owned_records%rowtype;
  name_value text;
  normalized_phone text;
  district_value text;
  city_value text;
  state_value text;
  street_value text;
  number_value text;
  cep_value text;
  rural boolean;
  invalid_phone boolean;
  missing_name boolean;
  incomplete_name boolean;
  missing_district boolean;
  missing_street boolean;
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

  name_value := trim(coalesce(r.payload->>'name', ''));
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
  missing_name := name_value = '';
  incomplete_name := not missing_name
    and name_value !~ '[^[:space:]]+[[:space:]]+[^[:space:]]+';
  missing_district := district_value = '';
  missing_street := street_value = '';
  missing_location := missing_district and missing_street;
  incomplete_location := not missing_location and (missing_district or missing_street);
  location_divergence := district_value <> ''
    and not rural
    and public.vf_canonical_arapongas_district(district_value) is null;
  duplicate_phone := coalesce(r.payload->>'duplicateStatus', '') = 'existing_duplicate';

  if duplicate_phone then codes := array_append(codes, 'duplicate_phone'); end if;
  if invalid_phone then codes := array_append(codes, 'invalid_phone'); end if;
  if missing_name then codes := array_append(codes, 'missing_name'); end if;
  if incomplete_name then codes := array_append(codes, 'incomplete_name'); end if;
  if missing_district then codes := array_append(codes, 'missing_district'); end if;
  if missing_street then codes := array_append(codes, 'missing_street'); end if;
  if location_divergence then codes := array_append(codes, 'location_divergence'); end if;
  if rural then codes := array_append(codes, 'rural_location'); end if;

  if duplicate_phone or invalid_phone or missing_name then
    quality_severity := 'critical';
  elsif incomplete_name or missing_district or missing_street or location_divergence then
    quality_severity := 'warning';
  elsif rural then
    quality_severity := 'info';
  end if;

  insert into public.vf_contact_quality(
    record_id,
    owner_email,
    contact_name,
    phone,
    phone_normalized,
    district_original,
    city,
    state,
    street,
    street_number,
    cep,
    is_rural,
    has_invalid_phone,
    has_missing_location,
    has_incomplete_location,
    has_location_divergence,
    has_duplicate_phone,
    has_missing_name,
    has_incomplete_name,
    has_missing_district,
    has_missing_street,
    issue_codes,
    severity,
    updated_at
  ) values (
    r.id,
    lower(trim(r.owner_email)),
    name_value,
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
    missing_name,
    incomplete_name,
    missing_district,
    missing_street,
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

with base as (
  select
    r.id as record_id,
    lower(trim(r.owner_email)) as owner_email,
    trim(coalesce(r.payload->>'name', '')) as contact_name,
    trim(coalesce(r.payload->>'phone', '')) as phone,
    public.vf_normalize_contact_phone(
      coalesce(r.payload->>'phoneNormalized', r.payload->>'phone', '')
    ) as phone_normalized,
    trim(coalesce(r.payload->>'district', '')) as district_original,
    trim(coalesce(r.payload->>'city', '')) as city,
    trim(coalesce(r.payload->>'state', '')) as state,
    trim(coalesce(r.payload->>'street', '')) as street,
    trim(coalesce(r.payload->>'number', '')) as street_number,
    trim(coalesce(r.payload->>'cep', '')) as cep,
    coalesce(r.payload->>'duplicateStatus', '') = 'existing_duplicate' as has_duplicate_phone
  from public.vf_owned_records r
  where r.kind = 'contact'
), flags as (
  select
    base.*,
    public.vf_is_rural_location(district_original) as is_rural,
    phone_normalized !~ '^[1-9][0-9]{9,10}$'
      or phone_normalized ~ '^([0-9])\1+$' as has_invalid_phone,
    contact_name = '' as has_missing_name,
    contact_name <> ''
      and contact_name !~ '[^[:space:]]+[[:space:]]+[^[:space:]]+' as has_incomplete_name,
    district_original = '' as has_missing_district,
    street = '' as has_missing_street
  from base
), classified as (
  select
    flags.*,
    has_missing_district and has_missing_street as has_missing_location,
    not (has_missing_district and has_missing_street)
      and (has_missing_district or has_missing_street) as has_incomplete_location,
    district_original <> ''
      and not is_rural
      and public.vf_canonical_arapongas_district(district_original) is null
      as has_location_divergence
  from flags
)
insert into public.vf_contact_quality(
  record_id,
  owner_email,
  contact_name,
  phone,
  phone_normalized,
  district_original,
  city,
  state,
  street,
  street_number,
  cep,
  is_rural,
  has_invalid_phone,
  has_missing_location,
  has_incomplete_location,
  has_location_divergence,
  has_duplicate_phone,
  has_missing_name,
  has_incomplete_name,
  has_missing_district,
  has_missing_street,
  issue_codes,
  severity,
  updated_at
)
select
  record_id,
  owner_email,
  contact_name,
  phone,
  phone_normalized,
  district_original,
  city,
  state,
  street,
  street_number,
  cep,
  is_rural,
  has_invalid_phone,
  has_missing_location,
  has_incomplete_location,
  has_location_divergence,
  has_duplicate_phone,
  has_missing_name,
  has_incomplete_name,
  has_missing_district,
  has_missing_street,
  array_remove(array[
    case when has_duplicate_phone then 'duplicate_phone' end,
    case when has_invalid_phone then 'invalid_phone' end,
    case when has_missing_name then 'missing_name' end,
    case when has_incomplete_name then 'incomplete_name' end,
    case when has_missing_district then 'missing_district' end,
    case when has_missing_street then 'missing_street' end,
    case when has_location_divergence then 'location_divergence' end,
    case when is_rural then 'rural_location' end
  ]::text[], null),
  case
    when has_duplicate_phone or has_invalid_phone or has_missing_name then 'critical'
    when has_incomplete_name or has_missing_district or has_missing_street
      or has_location_divergence then 'warning'
    when is_rural then 'info'
    else 'ok'
  end,
  now()
from classified
on conflict(record_id) do update set
  owner_email = excluded.owner_email,
  contact_name = excluded.contact_name,
  phone = excluded.phone,
  phone_normalized = excluded.phone_normalized,
  district_original = excluded.district_original,
  city = excluded.city,
  state = excluded.state,
  street = excluded.street,
  street_number = excluded.street_number,
  cep = excluded.cep,
  is_rural = excluded.is_rural,
  has_invalid_phone = excluded.has_invalid_phone,
  has_missing_location = excluded.has_missing_location,
  has_incomplete_location = excluded.has_incomplete_location,
  has_location_divergence = excluded.has_location_divergence,
  has_duplicate_phone = excluded.has_duplicate_phone,
  has_missing_name = excluded.has_missing_name,
  has_incomplete_name = excluded.has_incomplete_name,
  has_missing_district = excluded.has_missing_district,
  has_missing_street = excluded.has_missing_street,
  issue_codes = excluded.issue_codes,
  severity = excluded.severity,
  updated_at = excluded.updated_at;

commit;
