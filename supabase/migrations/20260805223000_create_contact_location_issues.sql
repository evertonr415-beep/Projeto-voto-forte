begin;

create table if not exists public.vf_contact_location_issues (
  record_id bigint primary key references public.vf_owned_records(id) on delete cascade,
  owner_email text not null,
  contact_name text not null default '',
  phone text not null default '',
  district_original text not null default '',
  district_key text,
  category text not null,
  suggested_district text,
  updated_at timestamptz not null default now()
);

create index if not exists vf_contact_location_issues_owner_category_idx
  on public.vf_contact_location_issues(owner_email, category);

alter table public.vf_contact_location_issues enable row level security;

drop policy if exists vf_contact_location_issues_visible_records
  on public.vf_contact_location_issues;
create policy vf_contact_location_issues_visible_records
  on public.vf_contact_location_issues
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.vf_owned_records r
      where r.id = record_id
    )
  );

revoke all on public.vf_contact_location_issues from public, anon;
grant select on public.vf_contact_location_issues to authenticated, service_role;

create or replace function public.vf_location_issue_category(value text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when value is null
      or btrim(value) = ''
      or upper(btrim(value)) in ('NULL', '0', '-', 'SEM BAIRRO', 'NAO INFORMADO', 'NÃO INFORMADO')
      then 'sem_valor_util'
    when upper(unaccent(value)) ~ '(RURAL|RODOVIA|ESTRADA|^EST |^GL |GLEBA|SITIO|SÍTIO|CHACARA|CHÁCARA|FAZENDA|^FAZ |^PR [0-9]|KM [0-9]|AGUA |ÁGUA )'
      then 'rural_localidade'
    when upper(unaccent(value)) in ('ARAPONGAS', 'ARAPONGAS PR', 'NAO ENCONTRADO', 'NÃO ENCONTRADO')
      then 'cidade_ou_nao_encontrado'
    when upper(unaccent(value)) in (
      'AEROPORTO', 'BANDEIRANTES', 'J INTERLAGOS', 'PALMARES',
      'V SAMPAIO', 'U GUIMARAES', 'SAN PABLO', 'P INDUSTRIAL II',
      'APARECIDA', 'CENTAURO', 'FLAMINGOS III', 'V APARECIDA',
      'V INDUST', 'MTE CARLO', 'S JOSE'
    ) then 'provavel_alias'
    else 'revisao_manual'
  end;
$$;

create or replace function public.vf_location_issue_suggestion(value text)
returns text
language sql
immutable
set search_path = public
as $$
  select case upper(unaccent(coalesce(value, '')))
    when 'AEROPORTO' then 'Jardim Aeroporto'
    when 'BANDEIRANTES' then 'Jardim Bandeirantes'
    when 'J INTERLAGOS' then 'Jardim Interlagos'
    when 'PALMARES' then 'Conjunto Palmares'
    when 'V SAMPAIO' then 'Vila Sampaio'
    when 'U GUIMARAES' then 'Conjunto Ulisses Guimarães'
    when 'SAN PABLO' then 'Jardim San Pablo'
    when 'P INDUSTRIAL II' then 'Parque Industrial II'
    when 'APARECIDA' then 'Vila Aparecida'
    when 'CENTAURO' then 'Conjunto Centauro'
    when 'FLAMINGOS III' then 'Conjunto Flamingos III'
    when 'V APARECIDA' then 'Vila Aparecida'
    when 'V INDUST' then 'Vila Industrial'
    when 'MTE CARLO' then 'Jardim Monte Carlo'
    when 'S JOSE' then 'Vila São José'
    else null
  end;
$$;

create or replace function public.vf_sync_contact_location_issue_row(p_record_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.vf_owned_records%rowtype;
  canonical text;
  original_value text;
begin
  delete from public.vf_contact_location_issues where record_id = p_record_id;

  select * into r
  from public.vf_owned_records
  where id = p_record_id;

  if not found or r.kind <> 'contact' then
    return;
  end if;

  original_value := coalesce(r.payload->>'district', '');
  canonical := public.vf_canonical_arapongas_district(original_value);

  if canonical is not null then
    return;
  end if;

  insert into public.vf_contact_location_issues(
    record_id, owner_email, contact_name, phone, district_original,
    district_key, category, suggested_district, updated_at
  ) values (
    r.id,
    r.owner_email,
    coalesce(r.payload->>'name', ''),
    coalesce(r.payload->>'phone', ''),
    original_value,
    public.vf_normalize_arapongas_district(original_value),
    public.vf_location_issue_category(original_value),
    public.vf_location_issue_suggestion(original_value),
    now()
  );
end;
$$;

revoke execute on function public.vf_sync_contact_location_issue_row(bigint)
  from public, anon, authenticated;

create or replace function public.vf_sync_contact_location_issue_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.vf_contact_location_issues where record_id = old.id;
    return old;
  end if;

  perform public.vf_sync_contact_location_issue_row(new.id);
  return new;
end;
$$;

revoke execute on function public.vf_sync_contact_location_issue_trigger()
  from public, anon, authenticated;

drop trigger if exists vf_sync_contact_location_issue_trigger
  on public.vf_owned_records;
create trigger vf_sync_contact_location_issue_trigger
after insert or update of payload, kind, owner_email or delete
on public.vf_owned_records
for each row execute function public.vf_sync_contact_location_issue_trigger();

create or replace function public.vf_refresh_contact_location_issues()
returns table(total_issues bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  item record;
begin
  perform set_config('statement_timeout', '0', true);
  truncate table public.vf_contact_location_issues;

  for item in
    select id from public.vf_owned_records where kind = 'contact'
  loop
    perform public.vf_sync_contact_location_issue_row(item.id);
  end loop;

  return query select count(*)::bigint from public.vf_contact_location_issues;
end;
$$;

revoke execute on function public.vf_refresh_contact_location_issues()
  from public, anon;
grant execute on function public.vf_refresh_contact_location_issues()
  to authenticated, service_role;

commit;
