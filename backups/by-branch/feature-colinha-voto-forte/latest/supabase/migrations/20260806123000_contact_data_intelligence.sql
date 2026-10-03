begin;

create or replace function public.vf_normalize_contact_phone(value text)
returns text
language plpgsql
immutable
set search_path to ''
as $$
declare
  normalized text;
begin
  normalized := regexp_replace(coalesce(value, ''), '\D', '', 'g');
  if length(normalized) in (12, 13) and left(normalized, 2) = '55' then
    normalized := substr(normalized, 3);
  end if;
  return normalized;
end;
$$;

create or replace function public.vf_is_rural_location(value text)
returns boolean
language sql
stable
set search_path to ''
as $$
  select upper(public.unaccent(coalesce(value, ''))) ~
    '(RURAL|RODOVIA|ESTRADA|^EST |^GL |GLEBA|SITIO|CHACARA|FAZENDA|^FAZ |^PR [0-9]|KM [0-9]|AGUA )';
$$;

with ranked as (
  select id,
    row_number() over (
      partition by public.vf_normalize_contact_phone(
        coalesce(payload->>'phoneNormalized', payload->>'phone', '')
      )
      order by id
    ) as duplicate_rank
  from public.vf_owned_records
  where kind = 'contact'
    and public.vf_normalize_contact_phone(
      coalesce(payload->>'phoneNormalized', payload->>'phone', '')
    ) <> ''
)
update public.vf_owned_records record
set payload = jsonb_set(record.payload, '{duplicateStatus}', '"existing_duplicate"'::jsonb, true),
    updated_at = now()
from ranked
where ranked.id = record.id and ranked.duplicate_rank > 1;

create unique index if not exists vf_owned_records_contact_phone_global_unique
on public.vf_owned_records (
  public.vf_normalize_contact_phone(
    coalesce(payload->>'phoneNormalized', payload->>'phone', '')
  )
)
where kind = 'contact'
  and coalesce(payload->>'duplicateStatus', '') <> 'existing_duplicate'
  and public.vf_normalize_contact_phone(
    coalesce(payload->>'phoneNormalized', payload->>'phone', '')
  ) <> '';

create table if not exists public.vf_contact_quality (
  record_id bigint primary key references public.vf_owned_records(id) on delete cascade,
  owner_email text not null,
  contact_name text not null default '',
  phone text not null default '',
  phone_normalized text not null default '',
  district_original text not null default '',
  city text not null default '',
  state text not null default '',
  street text not null default '',
  street_number text not null default '',
  cep text not null default '',
  is_rural boolean not null default false,
  has_invalid_phone boolean not null default false,
  has_missing_location boolean not null default false,
  has_incomplete_location boolean not null default false,
  has_location_divergence boolean not null default false,
  has_duplicate_phone boolean not null default false,
  issue_codes text[] not null default '{}'::text[],
  severity text not null default 'ok' check (severity in ('ok','info','warning','critical')),
  updated_at timestamptz not null default now()
);

create index if not exists vf_contact_quality_owner_severity_idx
  on public.vf_contact_quality(owner_email, severity, updated_at desc, record_id desc);
create index if not exists vf_contact_quality_issue_codes_idx
  on public.vf_contact_quality using gin(issue_codes);
create index if not exists vf_contact_quality_rural_idx
  on public.vf_contact_quality(owner_email, is_rural) where is_rural = true;

alter table public.vf_contact_quality enable row level security;
revoke all on table public.vf_contact_quality from public, anon;
grant select on table public.vf_contact_quality to authenticated, service_role;

drop policy if exists vf_contact_quality_visible_records on public.vf_contact_quality;
create policy vf_contact_quality_visible_records
on public.vf_contact_quality for select to authenticated
using (
  exists (
    select 1 from public.vf_owned_records visible_record
    where visible_record.id = vf_contact_quality.record_id
  )
);

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
  select * into r from public.vf_owned_records where id = p_record_id;
  if not found or r.kind <> 'contact' then return; end if;

  normalized_phone := public.vf_normalize_contact_phone(coalesce(r.payload->>'phoneNormalized', r.payload->>'phone', ''));
  district_value := trim(coalesce(r.payload->>'district', ''));
  city_value := trim(coalesce(r.payload->>'city', ''));
  state_value := trim(coalesce(r.payload->>'state', ''));
  street_value := trim(coalesce(r.payload->>'street', ''));
  number_value := trim(coalesce(r.payload->>'number', ''));
  cep_value := trim(coalesce(r.payload->>'cep', ''));
  rural := public.vf_is_rural_location(district_value);
  invalid_phone := normalized_phone !~ '^[1-9][0-9]{9,10}$' or normalized_phone ~ '^([0-9])\1+$';
  missing_location := district_value = '' and city_value = '' and street_value = '' and cep_value = '';
  incomplete_location := not missing_location and (district_value = '' or city_value = '' or state_value = '');
  location_divergence := district_value <> '' and not rural
    and public.vf_canonical_arapongas_district(district_value) is null;
  duplicate_phone := coalesce(r.payload->>'duplicateStatus', '') = 'existing_duplicate';

  if duplicate_phone then codes := array_append(codes, 'duplicate_phone'); end if;
  if invalid_phone then codes := array_append(codes, 'invalid_phone'); end if;
  if missing_location then codes := array_append(codes, 'missing_location'); end if;
  if incomplete_location then codes := array_append(codes, 'incomplete_location'); end if;
  if location_divergence then codes := array_append(codes, 'location_divergence'); end if;
  if rural then codes := array_append(codes, 'rural_location'); end if;

  if duplicate_phone or invalid_phone or missing_location then quality_severity := 'critical';
  elsif incomplete_location or location_divergence then quality_severity := 'warning';
  elsif rural then quality_severity := 'info';
  end if;

  insert into public.vf_contact_quality(
    record_id,owner_email,contact_name,phone,phone_normalized,district_original,
    city,state,street,street_number,cep,is_rural,has_invalid_phone,
    has_missing_location,has_incomplete_location,has_location_divergence,
    has_duplicate_phone,issue_codes,severity,updated_at
  ) values (
    r.id,lower(trim(r.owner_email)),trim(coalesce(r.payload->>'name','')),
    trim(coalesce(r.payload->>'phone','')),normalized_phone,district_value,
    city_value,state_value,street_value,number_value,cep_value,rural,
    invalid_phone,missing_location,incomplete_location,location_divergence,
    duplicate_phone,codes,quality_severity,now()
  );
end;
$$;

revoke all on function public.vf_sync_contact_quality_row(bigint) from public, anon, authenticated;
grant execute on function public.vf_sync_contact_quality_row(bigint) to service_role;

with base as (
  select
    r.id record_id, lower(trim(r.owner_email)) owner_email,
    trim(coalesce(r.payload->>'name','')) contact_name,
    trim(coalesce(r.payload->>'phone','')) phone,
    public.vf_normalize_contact_phone(coalesce(r.payload->>'phoneNormalized',r.payload->>'phone','')) phone_normalized,
    trim(coalesce(r.payload->>'district','')) district_original,
    trim(coalesce(r.payload->>'city','')) city,
    trim(coalesce(r.payload->>'state','')) state,
    trim(coalesce(r.payload->>'street','')) street,
    trim(coalesce(r.payload->>'number','')) street_number,
    trim(coalesce(r.payload->>'cep','')) cep,
    coalesce(r.payload->>'duplicateStatus','') = 'existing_duplicate' has_duplicate_phone
  from public.vf_owned_records r where r.kind='contact'
), flags as (
  select base.*,
    public.vf_is_rural_location(district_original) is_rural,
    phone_normalized !~ '^[1-9][0-9]{9,10}$' or phone_normalized ~ '^([0-9])\1+$' has_invalid_phone,
    district_original='' and city='' and street='' and cep='' has_missing_location
  from base
), classified as (
  select flags.*,
    not has_missing_location and (district_original='' or city='' or state='') has_incomplete_location,
    district_original<>'' and not is_rural
      and public.vf_canonical_arapongas_district(district_original) is null has_location_divergence
  from flags
)
insert into public.vf_contact_quality(
  record_id,owner_email,contact_name,phone,phone_normalized,district_original,
  city,state,street,street_number,cep,is_rural,has_invalid_phone,
  has_missing_location,has_incomplete_location,has_location_divergence,
  has_duplicate_phone,issue_codes,severity,updated_at
)
select
  record_id,owner_email,contact_name,phone,phone_normalized,district_original,
  city,state,street,street_number,cep,is_rural,has_invalid_phone,
  has_missing_location,has_incomplete_location,has_location_divergence,
  has_duplicate_phone,
  array_remove(array[
    case when has_duplicate_phone then 'duplicate_phone' end,
    case when has_invalid_phone then 'invalid_phone' end,
    case when has_missing_location then 'missing_location' end,
    case when has_incomplete_location then 'incomplete_location' end,
    case when has_location_divergence then 'location_divergence' end,
    case when is_rural then 'rural_location' end
  ]::text[],null),
  case when has_duplicate_phone or has_invalid_phone or has_missing_location then 'critical'
    when has_incomplete_location or has_location_divergence then 'warning'
    when is_rural then 'info' else 'ok' end,
  now()
from classified
on conflict(record_id) do update set
  owner_email=excluded.owner_email,contact_name=excluded.contact_name,
  phone=excluded.phone,phone_normalized=excluded.phone_normalized,
  district_original=excluded.district_original,city=excluded.city,state=excluded.state,
  street=excluded.street,street_number=excluded.street_number,cep=excluded.cep,
  is_rural=excluded.is_rural,has_invalid_phone=excluded.has_invalid_phone,
  has_missing_location=excluded.has_missing_location,
  has_incomplete_location=excluded.has_incomplete_location,
  has_location_divergence=excluded.has_location_divergence,
  has_duplicate_phone=excluded.has_duplicate_phone,issue_codes=excluded.issue_codes,
  severity=excluded.severity,updated_at=excluded.updated_at;

create or replace function public.vf_sync_contact_quality_trigger()
returns trigger language plpgsql security definer set search_path to ''
as $$
begin
  if tg_op='DELETE' then
    delete from public.vf_contact_quality where record_id=old.id;
    return old;
  end if;
  perform public.vf_sync_contact_quality_row(new.id);
  return new;
end;
$$;
revoke all on function public.vf_sync_contact_quality_trigger() from public,anon,authenticated;
grant execute on function public.vf_sync_contact_quality_trigger() to service_role;
drop trigger if exists vf_sync_contact_quality_trigger on public.vf_owned_records;
create trigger vf_sync_contact_quality_trigger after insert or update or delete
on public.vf_owned_records for each row execute function public.vf_sync_contact_quality_trigger();

create or replace function public.vf_import_contacts_deduplicated(
  p_owner_email text,p_contacts jsonb,p_import_session_id text default null,
  p_import_batch_id text default null
) returns jsonb language plpgsql security definer set search_path to ''
as $$
declare
  caller_id bigint; caller_role text; target_owner public.vf_users%rowtype;
  contact jsonb; normalized_phone text; inserted_count integer:=0;
  duplicate_count integer:=0; affected_rows integer:=0; batch_count integer:=0;
  allowed boolean:=false;
begin
  if coalesce(jsonb_typeof(p_contacts),'')<>'array' then
    raise exception 'Lista de contatos inválida.' using errcode='22023';
  end if;
  select u.id,u.role into caller_id,caller_role from public.vf_users u
  where u.auth_user_id=(select auth.uid()) and u.status='active' limit 1;
  if caller_id is null and coalesce((select auth.jwt()->>'role'),'')<>'service_role' then
    raise exception 'Usuário sem acesso ativo.' using errcode='42501';
  end if;
  select * into target_owner from public.vf_users u
  where lower(trim(u.email))=lower(trim(p_owner_email)) and u.status='active' limit 1;
  if target_owner.id is null then raise exception 'Responsável inválido.' using errcode='22023'; end if;
  if coalesce((select auth.jwt()->>'role'),'')='service_role' or caller_role='master' then allowed:=true;
  elsif target_owner.id=caller_id then allowed:=true;
  else
    with recursive descendants as (
      select u.id,array[u.id]::bigint[] visited_ids from public.vf_users u
      where u.id=caller_id and u.status='active'
      union all
      select child.id,parent.visited_ids||child.id from public.vf_users child
      join descendants parent on child.parent_user_id=parent.id
      where child.status='active' and not child.id=any(parent.visited_ids)
    ) select exists(select 1 from descendants where id=target_owner.id) into allowed;
  end if;
  if not allowed then raise exception 'Acesso negado.' using errcode='42501'; end if;
  if coalesce(trim(p_import_batch_id),'')<>'' then
    select count(*) into batch_count from public.vf_owned_records
    where kind='contact' and lower(trim(owner_email))=lower(trim(target_owner.email))
      and payload->>'importBatchId'=trim(p_import_batch_id);
    if batch_count>0 then return jsonb_build_object('inserted',batch_count,'duplicates',0,'recovered',true); end if;
  end if;
  for contact in select value from jsonb_array_elements(p_contacts) loop
    normalized_phone:=public.vf_normalize_contact_phone(coalesce(contact->>'phoneNormalized',contact->>'phone',''));
    if normalized_phone='' then duplicate_count:=duplicate_count+1; continue; end if;
    insert into public.vf_owned_records(owner_id,owner_email,kind,payload,updated_at)
    values(target_owner.auth_user_id,target_owner.email,'contact',
      contact||jsonb_build_object('phoneNormalized',normalized_phone)
      ||case when coalesce(trim(p_import_session_id),'')<>'' then jsonb_build_object('importSessionId',trim(p_import_session_id)) else '{}'::jsonb end
      ||case when coalesce(trim(p_import_batch_id),'')<>'' then jsonb_build_object('importBatchId',trim(p_import_batch_id)) else '{}'::jsonb end,
      now()) on conflict do nothing;
    get diagnostics affected_rows=row_count;
    if affected_rows=1 then inserted_count:=inserted_count+1;
    else duplicate_count:=duplicate_count+1; end if;
  end loop;
  return jsonb_build_object('inserted',inserted_count,'duplicates',duplicate_count,'recovered',false);
end;
$$;
revoke all on function public.vf_import_contacts_deduplicated(text,jsonb,text,text) from public,anon;
grant execute on function public.vf_import_contacts_deduplicated(text,jsonb,text,text) to authenticated,service_role;

commit;
