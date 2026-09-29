alter extension unaccent set schema extensions;

create or replace function public.vf_is_rural_location(value text)
returns boolean
language sql
stable
set search_path to ''
as $function$
  select upper(extensions.unaccent(coalesce(value, ''))) ~
    '(RURAL|RODOVIA|ESTRADA|^EST |^GL |GLEBA|SITIO|CHACARA|FAZENDA|^FAZ |^PR [0-9]|KM [0-9]|AGUA )';
$function$;

alter function public.vf_location_issue_category(text)
  set search_path to public, extensions;

alter function public.vf_location_issue_suggestion(text)
  set search_path to public, extensions;

alter function public.vf_map_district_counts(text[], text)
  set search_path to public, extensions;

alter function public.vf_map_unmapped_district_counts(text[], text)
  set search_path to public, extensions;

alter function public.vf_normalize_arapongas_district(text)
  set search_path to public, extensions;

alter function public.vf_refresh_arapongas_district_summary()
  set search_path to public, extensions;

alter function public.vf_sync_arapongas_district_summary()
  set search_path to public, extensions;