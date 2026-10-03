create or replace function public.vf_refresh_arapongas_district_summary()
returns table(contacts_recognized bigint, districts_recognized bigint, owners_recognized bigint)
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
begin
  perform set_config('statement_timeout', '0', true);

  truncate table public.vf_arapongas_district_summary;

  insert into public.vf_arapongas_district_summary (
    owner_email,
    district_name,
    total,
    updated_at
  )
  select
    r.owner_email,
    case
      when upper(unaccent(coalesce(r.payload ->> 'district', ''))) ~ '(RURAL|RODOVIA|ESTRADA|^EST |^GL |GLEBA|SITIO|SÍTIO|CHACARA|CHÁCARA|FAZENDA|^FAZ |^PR [0-9]|KM [0-9]|AGUA |ÁGUA )'
        then 'Zona rural'::text
      else a.canonical_name
    end as district_name,
    count(*)::bigint,
    now()
  from public.vf_owned_records r
  left join public.vf_arapongas_district_aliases a
    on a.alias_key = public.vf_normalize_arapongas_district(r.payload ->> 'district')
   and a.active = true
  where r.kind = 'contact'
    and r.owner_email is not null
    and (
      coalesce(trim(r.payload->>'city'), '') = ''
      or upper(unaccent(trim(r.payload->>'city'))) = 'ARAPONGAS'
    )
    and case
      when upper(unaccent(coalesce(r.payload ->> 'district', ''))) ~ '(RURAL|RODOVIA|ESTRADA|^EST |^GL |GLEBA|SITIO|SÍTIO|CHACARA|CHÁCARA|FAZENDA|^FAZ |^PR [0-9]|KM [0-9]|AGUA |ÁGUA )'
        then 'Zona rural'::text
      else a.canonical_name
    end is not null
  group by r.owner_email,
    case
      when upper(unaccent(coalesce(r.payload ->> 'district', ''))) ~ '(RURAL|RODOVIA|ESTRADA|^EST |^GL |GLEBA|SITIO|SÍTIO|CHACARA|CHÁCARA|FAZENDA|^FAZ |^PR [0-9]|KM [0-9]|AGUA |ÁGUA )'
        then 'Zona rural'::text
      else a.canonical_name
    end;

  return query
  select
    coalesce(sum(s.total), 0)::bigint,
    count(distinct s.district_name)::bigint,
    count(distinct s.owner_email)::bigint
  from public.vf_arapongas_district_summary s;
end;
$function$;

create or replace function public.vf_sync_arapongas_district_summary()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  old_district text;
  new_district text;
  old_is_arapongas boolean;
  new_is_arapongas boolean;
begin
  if tg_op in ('UPDATE', 'DELETE') and old.kind = 'contact' then
    old_is_arapongas := (
      coalesce(trim(old.payload->>'city'), '') = ''
      or upper(unaccent(trim(old.payload->>'city'))) = 'ARAPONGAS'
    );

    if old_is_arapongas then
      old_district := case
        when upper(unaccent(coalesce(old.payload ->> 'district', ''))) ~ '(RURAL|RODOVIA|ESTRADA|^EST |^GL |GLEBA|SITIO|SÍTIO|CHACARA|CHÁCARA|FAZENDA|^FAZ |^PR [0-9]|KM [0-9]|AGUA |ÁGUA )'
          then 'Zona rural'::text
        else public.vf_canonical_arapongas_district(old.payload->>'district')
      end;
      perform public.vf_adjust_arapongas_district_summary(old.owner_email, old_district, -1);
    end if;
  end if;

  if tg_op in ('INSERT', 'UPDATE') and new.kind = 'contact' then
    new_is_arapongas := (
      coalesce(trim(new.payload->>'city'), '') = ''
      or upper(unaccent(trim(new.payload->>'city'))) = 'ARAPONGAS'
    );

    if new_is_arapongas then
      new_district := case
        when upper(unaccent(coalesce(new.payload ->> 'district', ''))) ~ '(RURAL|RODOVIA|ESTRADA|^EST |^GL |GLEBA|SITIO|SÍTIO|CHACARA|CHÁCARA|FAZENDA|^FAZ |^PR [0-9]|KM [0-9]|AGUA |ÁGUA )'
          then 'Zona rural'::text
        else public.vf_canonical_arapongas_district(new.payload->>'district')
      end;
      perform public.vf_adjust_arapongas_district_summary(new.owner_email, new_district, 1);
    end if;
  end if;

  return coalesce(new, old);
end;
$function$;
