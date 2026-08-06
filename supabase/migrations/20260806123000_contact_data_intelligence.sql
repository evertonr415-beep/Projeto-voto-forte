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

with ranked as (
  select
    id,
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
where ranked.id = record.id
  and ranked.duplicate_rank > 1;

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
  severity text not null default 'ok' check (severity in ('ok', 'info', 'warning', 'critical')),
  updated_at timestamptz not null default now()
);

create index if not exists vf_contact_quality_owner_severity_idx
  on public.vf_contact_quality(owner_email, severity, updated_at desc, record_id desc);
create index if not exists vf_contact_quality_issue_codes_idx
  on public.vf_contact_quality using gin(issue_codes);
create index if not exists vf_contact_quality_rural_idx
  on public.vf_contact_quality(owner_email, is_rural)
  where is_rural = true;

alter table public.vf_contact_quality enable row level security;

revoke all on table public.vf_contact_quality from public, anon;
grant select on table public.vf_contact_quality to authenticated, service_role;

create policy vf_contact_quality_visible_records
on public.vf_contact_quality
for select
to authenticated
using (
  exists (
    select 1
    from public.vf_owned_records visible_record
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
  record_row public.vf_owned_records%rowtype;
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

  select * into record_row
  from public.vf_owned_records
  where id = p_record_id;

  if not found or record_row.kind <> 'contact' then
    return;
  end if;

  normalized_phone := public.vf_normalize_contact_phone(
    coalesce(record_row.payload->>'phoneNormalized', record_row.payload->>'phone', '')
  );
  district_value := trim(coalesce(record_row.payload->>'district', ''));
  city_value := trim(coalesce(record_row.payload->>'city', ''));
  state_value := trim(coalesce(record_row.payload->>'state', ''));
  street_value := trim(coalesce(record_row.payload->>'street', ''));
  number_value := trim(coalesce(record_row.payload->>'number', ''));
  cep_value := trim(coalesce(record_row.payload->>'cep', ''));

  rural := upper(unaccent(district_value)) ~ '(RURAL|RODOVIA|ESTRADA|^EST |^GL |GLEBA|SITIO|SÍTIO|CHACARA|CHÁCARA|FAZENDA|^FAZ |^PR [0-9]|KM [0-9]|AGUA |ÁGUA )';
  invalid_phone := normalized_phone !~ '^[1-9][0-9]{9,10}$'
    or normalized_phone ~ '^([0-9])\1+$';
  missing_location := district_value = '' and city_value = '' and street_value = '' and cep_value = '';
  incomplete_location := not missing_location and (
    district_value = '' or city_value = '' or state_value = ''
  );
  location_divergence := district_value <> ''
    and not rural
    and public.vf_canonical_arapongas_district(district_value) is null;
  duplicate_phone := coalesce(record_row.payload->>'duplicateStatus', '') = 'existing_duplicate';

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
    issue_codes,
    severity,
    updated_at
  ) values (
    record_row.id,
    lower(trim(record_row.owner_email)),
    trim(coalesce(record_row.payload->>'name', '')),
    trim(coalesce(record_row.payload->>'phone', '')),
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

revoke all on function public.vf_sync_contact_quality_row(bigint) from public, anon, authenticated;
grant execute on function public.vf_sync_contact_quality_row(bigint) to service_role;

create or replace function public.vf_sync_contact_quality_trigger()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.vf_contact_quality where record_id = old.id;
    return old;
  end if;

  perform public.vf_sync_contact_quality_row(new.id);
  return new;
end;
$$;

revoke all on function public.vf_sync_contact_quality_trigger() from public, anon, authenticated;
grant execute on function public.vf_sync_contact_quality_trigger() to service_role;

drop trigger if exists vf_sync_contact_quality_trigger on public.vf_owned_records;
create trigger vf_sync_contact_quality_trigger
after insert or update or delete on public.vf_owned_records
for each row execute function public.vf_sync_contact_quality_trigger();

insert into public.vf_contact_quality(record_id, owner_email)
select id, lower(trim(owner_email))
from public.vf_owned_records
where kind = 'contact'
on conflict (record_id) do nothing;

do $$
declare
  contact_id bigint;
begin
  for contact_id in
    select id from public.vf_owned_records where kind = 'contact'
  loop
    perform public.vf_sync_contact_quality_row(contact_id);
  end loop;
end;
$$;

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
  inserted_count integer := 0;
  duplicate_count integer := 0;
  row_count integer := 0;
  batch_count integer := 0;
  allowed boolean := false;
begin
  if coalesce(jsonb_typeof(p_contacts), '') <> 'array' then
    raise exception 'Lista de contatos inválida.' using errcode = '22023';
  end if;

  select u.id, u.role into caller_id, caller_role
  from public.vf_users u
  where u.auth_user_id = (select auth.uid())
    and u.status = 'active'
  limit 1;

  if caller_id is null and coalesce((select auth.jwt()->>'role'), '') <> 'service_role' then
    raise exception 'Usuário sem acesso ativo.' using errcode = '42501';
  end if;

  select * into target_owner
  from public.vf_users u
  where lower(trim(u.email)) = lower(trim(p_owner_email))
    and u.status = 'active'
  limit 1;

  if target_owner.id is null then
    raise exception 'Responsável inválido.' using errcode = '22023';
  end if;

  if coalesce((select auth.jwt()->>'role'), '') = 'service_role' or caller_role = 'master' then
    allowed := true;
  elsif target_owner.id = caller_id then
    allowed := true;
  else
    with recursive descendants as (
      select u.id, array[u.id]::bigint[] as visited_ids
      from public.vf_users u
      where u.id = caller_id and u.status = 'active'
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
    select count(*) into batch_count
    from public.vf_owned_records
    where kind = 'contact'
      and lower(trim(owner_email)) = lower(trim(target_owner.email))
      and payload->>'importBatchId' = trim(p_import_batch_id);
    if batch_count > 0 then
      return jsonb_build_object(
        'inserted', batch_count,
        'duplicates', 0,
        'recovered', true
      );
    end if;
  end if;

  for contact in select value from jsonb_array_elements(p_contacts)
  loop
    normalized_phone := public.vf_normalize_contact_phone(
      coalesce(contact->>'phoneNormalized', contact->>'phone', '')
    );

    if normalized_phone = '' then
      duplicate_count := duplicate_count + 1;
      continue;
    end if;

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
      contact
        || jsonb_build_object('phoneNormalized', normalized_phone)
        || case when coalesce(trim(p_import_session_id), '') <> ''
          then jsonb_build_object('importSessionId', trim(p_import_session_id))
          else '{}'::jsonb end
        || case when coalesce(trim(p_import_batch_id), '') <> ''
          then jsonb_build_object('importBatchId', trim(p_import_batch_id))
          else '{}'::jsonb end,
      now()
    )
    on conflict do nothing;

    get diagnostics row_count = row_count;
    if row_count = 1 then
      inserted_count := inserted_count + 1;
    else
      duplicate_count := duplicate_count + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'inserted', inserted_count,
    'duplicates', duplicate_count,
    'recovered', false
  );
end;
$$;

revoke all on function public.vf_import_contacts_deduplicated(text, jsonb, text, text) from public, anon;
grant execute on function public.vf_import_contacts_deduplicated(text, jsonb, text, text) to authenticated, service_role;

create or replace function public.vf_contact_dashboard_summary_cached(p_owner_emails text[])
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  with contacts_all as (
    select
      coalesce(payload->>'kind', 'Eleitor') as profile,
      upper(unaccent(coalesce(payload->>'district', ''))) ~ '(RURAL|RODOVIA|ESTRADA|^EST |^GL |GLEBA|SITIO|SÍTIO|CHACARA|CHÁCARA|FAZENDA|^FAZ |^PR [0-9]|KM [0-9]|AGUA |ÁGUA )' as is_rural
    from public.vf_owned_records
    where kind = 'contact'
      and owner_email = any(p_owner_emails)
  ),
  district_catalog as (
    select distinct canonical_name as district_name
    from public.vf_arapongas_district_aliases
    where active = true
  ),
  cached_counts as (
    select district_name, sum(total)::bigint as total
    from public.vf_arapongas_district_summary
    where owner_email = any(p_owner_emails)
    group by district_name
  ),
  district_counts as (
    select c.district_name, coalesce(s.total, 0)::bigint as total
    from district_catalog c
    left join cached_counts s using (district_name)
  ),
  contact_totals as (
    select
      count(*)::bigint as total,
      count(*) filter (where profile = 'Eleitor')::bigint as voters,
      count(*) filter (where profile = 'Liderança')::bigint as leaders,
      count(*) filter (where is_rural)::bigint as rural_contacts
    from contacts_all
  ),
  district_totals as (
    select count(*) filter (where total > 0)::bigint as districts_reached
    from district_counts
  ),
  meeting_totals as (
    select count(*)::bigint as meetings
    from public.vf_owned_records
    where kind = 'meeting'
      and owner_email = any(p_owner_emails)
  )
  select jsonb_build_object(
    'total', contact_totals.total,
    'voters', contact_totals.voters,
    'leaders', contact_totals.leaders,
    'meetings', meeting_totals.meetings,
    'ruralContacts', contact_totals.rural_contacts,
    'districtsReached', district_totals.districts_reached,
    'districts', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object('district', district_name, 'total', total)
          order by (total > 0) desc, total desc, district_name asc
        )
        from district_counts
      ),
      '[]'::jsonb
    )
  )
  from contact_totals
  cross join district_totals
  cross join meeting_totals;
$$;

revoke all on function public.vf_contact_dashboard_summary_cached(text[]) from public, anon, authenticated;
grant execute on function public.vf_contact_dashboard_summary_cached(text[]) to service_role;

commit;
