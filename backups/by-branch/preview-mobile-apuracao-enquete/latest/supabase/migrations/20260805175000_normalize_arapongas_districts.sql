begin;

create extension if not exists unaccent;

create or replace function public.vf_normalize_arapongas_district(value text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  normalized text;
begin
  normalized := upper(unaccent(trim(coalesce(value, ''))));
  normalized := regexp_replace(normalized, '[^A-Z0-9 ]+', ' ', 'g');
  normalized := regexp_replace(normalized, '\s+', ' ', 'g');
  normalized := regexp_replace(normalized, '^BAIRRO\s+', '');
  normalized := regexp_replace(normalized, '^(JD|JARD)\s+', 'JARDIM ');
  normalized := regexp_replace(normalized, '^(VL)\s+', 'VILA ');
  normalized := regexp_replace(normalized, '^(CJ|CONJ)\s+', 'CONJUNTO ');
  normalized := regexp_replace(normalized, '^(RES)\s+', 'RESIDENCIAL ');
  normalized := regexp_replace(normalized, '^(PQ)\s+', 'PARQUE ');
  normalized := regexp_replace(normalized, '^(CH)\s+', 'CHACARA ');
  normalized := regexp_replace(normalized, '^(COND)\s+', 'CONDOMINIO ');
  normalized := trim(normalized);

  if normalized in (
    '', 'NULL', 'NULO', 'N A', 'NA', 'SEM BAIRRO', 'NAO INFORMADO',
    'INDEFINIDO', 'DESCONHECIDO', 'SEM INFORMACAO', '0', '-', '--'
  ) then
    return null;
  end if;

  if normalized ~ '^[0-9]{5,8}$' then
    return null;
  end if;

  if normalized ~ '^(RUA|AVENIDA|AV|RODOVIA|ESTRADA|TRAVESSA|ALAMEDA) ' then
    return null;
  end if;

  return normalized;
end;
$$;

create or replace function public.vf_contact_dashboard_summary(p_owner_emails text[])
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with contacts_all as (
    select
      coalesce(payload->>'kind', 'Eleitor') as profile
    from public.vf_owned_records
    where kind = 'contact'
      and owner_email = any(p_owner_emails)
  ),
  contacts_arapongas as (
    select
      public.vf_normalize_arapongas_district(payload->>'district') as district_key
    from public.vf_owned_records
    where kind = 'contact'
      and owner_email = any(p_owner_emails)
      and (
        coalesce(trim(payload->>'city'), '') = ''
        or upper(unaccent(trim(payload->>'city'))) = 'ARAPONGAS'
      )
  ),
  district_counts as (
    select district_key, count(*)::bigint as total
    from contacts_arapongas
    where district_key is not null
    group by district_key
  ),
  contact_totals as (
    select
      count(*)::bigint as total,
      count(*) filter (where profile = 'Eleitor')::bigint as voters,
      count(*) filter (where profile = 'Liderança')::bigint as leaders
    from contacts_all
  ),
  district_totals as (
    select count(*)::bigint as districts_reached
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
    'districtsReached', district_totals.districts_reached,
    'districts', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'district', initcap(lower(district_key)),
            'total', total
          )
          order by total desc, district_key asc
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

commit;
