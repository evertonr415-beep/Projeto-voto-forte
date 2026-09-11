-- Keep VOTO FORTE Neural audit analysis complete while avoiding transfer of
-- thousands of audit rows to the application server on every page load.

create or replace function private.vf_system_audit_metrics_internal(
  p_since timestamptz
)
returns table(
  audit_events bigint,
  navigation_events bigint,
  operational_events bigint,
  import_runs bigint,
  imported bigint,
  duplicates bigint,
  invalid bigint,
  navigation jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_profile public.vf_users;
  v_municipality_id bigint;
begin
  select * into v_profile from private.vf_current_profile();
  if v_profile.id is null or v_profile.access_role <> 'adm' then
    raise exception 'A Inteligência do Sistema é exclusiva do ADM.' using errcode = '42501';
  end if;

  v_municipality_id := private.vf_current_municipality_id();

  return query
  with events as materialized (
    select
      coalesce(l.action, '') as action,
      coalesce(l.detail, '') as detail
    from public.vf_audit_logs l
    where l.municipality_id = v_municipality_id
      and l.created_at >= p_since
  ),
  totals as (
    select
      count(*)::bigint as audit_events,
      count(*) filter (where action = 'Navegação')::bigint as navigation_events,
      count(*) filter (where action not in ('Acesso ao sistema', 'Navegação'))::bigint as operational_events,
      count(*) filter (
        where action in ('Importação inteligente de contatos', 'Importação de contatos em lote')
      )::bigint as import_runs,
      coalesce(sum(
        case when action in ('Importação inteligente de contatos', 'Importação de contatos em lote') then
          coalesce(nullif(regexp_replace(coalesce(substring(detail from '([0-9.]+)[[:space:]]+inseridos'), ''), '[^0-9]', '', 'g'), '')::bigint, 0)
        else 0 end
      ), 0)::bigint as imported,
      coalesce(sum(
        case when action in ('Importação inteligente de contatos', 'Importação de contatos em lote') then
          coalesce(nullif(regexp_replace(coalesce(substring(detail from '([0-9.]+)[[:space:]]+duplicados'), ''), '[^0-9]', '', 'g'), '')::bigint, 0)
        else 0 end
      ), 0)::bigint as duplicates,
      coalesce(sum(
        case when action in ('Importação inteligente de contatos', 'Importação de contatos em lote') then
          coalesce(nullif(regexp_replace(coalesce(substring(detail from '([0-9.]+)[[:space:]]+inválidos'), ''), '[^0-9]', '', 'g'), '')::bigint, 0)
        else 0 end
      ), 0)::bigint as invalid
    from events
  ),
  navigation_counts as (
    select
      coalesce(nullif(btrim(detail), ''), 'Sem identificação') as label,
      count(*)::bigint as count
    from events
    where action = 'Navegação'
    group by coalesce(nullif(btrim(detail), ''), 'Sem identificação')
  ),
  navigation_json as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object('label', label, 'count', count)
        order by count desc, label asc
      ),
      '[]'::jsonb
    ) as items
    from navigation_counts
  )
  select
    t.audit_events,
    t.navigation_events,
    t.operational_events,
    t.import_runs,
    t.imported,
    t.duplicates,
    t.invalid,
    n.items
  from totals t
  cross join navigation_json n;
end;
$function$;

revoke all on function private.vf_system_audit_metrics_internal(timestamptz) from public;
revoke all on function private.vf_system_audit_metrics_internal(timestamptz) from anon;
grant execute on function private.vf_system_audit_metrics_internal(timestamptz) to authenticated, service_role;

create or replace function public.vf_system_audit_metrics(
  p_since timestamptz
)
returns table(
  audit_events bigint,
  navigation_events bigint,
  operational_events bigint,
  import_runs bigint,
  imported bigint,
  duplicates bigint,
  invalid bigint,
  navigation jsonb
)
language sql
stable
set search_path = ''
as $function$
  select * from private.vf_system_audit_metrics_internal(p_since);
$function$;

revoke all on function public.vf_system_audit_metrics(timestamptz) from public;
revoke all on function public.vf_system_audit_metrics(timestamptz) from anon;
grant execute on function public.vf_system_audit_metrics(timestamptz) to authenticated, service_role;
