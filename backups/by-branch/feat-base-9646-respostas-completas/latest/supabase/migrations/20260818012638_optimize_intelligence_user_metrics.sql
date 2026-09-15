create or replace function private.vf_intelligence_user_metrics_internal()
returns table(
  owner_email text,
  manual_created_contacts bigint,
  imported_contacts bigint,
  updated_contacts bigint,
  operational_pending_contacts bigint,
  system_pending_contacts bigint
)
language sql
stable
security definer
set search_path=''
as $function$
  with current_profile as materialized (
    select p.id
    from private.vf_current_profile() p
  ),
  visible_users as materialized (
    select
      u.id as user_id,
      u.auth_user_id,
      lower(trim(u.email)) as owner_email
    from public.vf_users u
    where u.status='active'
      and exists (select 1 from current_profile)
      and u.id in (select v.user_id from private.vf_visible_user_ids() v)
  ),
  audit_metrics as materialized (
    select
      vu.owner_email,
      count(*) filter (where l.action='Cadastro criado')::bigint as manual_created_contacts,
      count(*) filter (
        where l.action in ('Contato editado','Cadastro essencial do contato corrigido')
      )::bigint as updated_contacts,
      coalesce(sum(case
        when l.action in ('Importação inteligente de contatos','Importação de contatos em lote') then
          coalesce(
            nullif(
              regexp_replace(
                coalesce(substring(l.detail from '([0-9.]+)[[:space:]]+inseridos'),''),
                '[^0-9]','','g'
              ),
              ''
            )::bigint,
            0
          )
        else 0
      end),0)::bigint as imported_contacts
    from visible_users vu
    left join public.vf_audit_logs l
      on l.actor_id=vu.auth_user_id
     and l.municipality_id=private.vf_current_municipality_id()
     and l.action in (
       'Cadastro criado',
       'Contato editado',
       'Cadastro essencial do contato corrigido',
       'Importação inteligente de contatos',
       'Importação de contatos em lote'
     )
    group by vu.owner_email
  ),
  quality_metrics as materialized (
    select
      lower(trim(r.owner_email)) as owner_email,
      count(*) filter (
        where q.issue_codes && array[
          'invalid_phone','missing_name','incomplete_name','missing_district',
          'missing_street','location_divergence','rural_location'
        ]::text[]
      )::bigint as operational_pending_contacts,
      count(*) filter (
        where q.issue_codes && array[
          'invalid_phone','missing_name','incomplete_name','missing_district',
          'location_divergence'
        ]::text[]
      )::bigint as system_pending_contacts
    from public.vf_contact_quality q
    join public.vf_owned_records r
      on r.id=q.record_id
     and r.kind='contact'
    join visible_users vu on vu.user_id=r.assigned_user_id
    where r.municipality_id=private.vf_current_municipality_id()
    group by lower(trim(r.owner_email))
  ),
  owners as (
    select owner_email from visible_users
    union
    select owner_email from quality_metrics
  )
  select
    o.owner_email,
    coalesce(a.manual_created_contacts,0)::bigint,
    coalesce(a.imported_contacts,0)::bigint,
    coalesce(a.updated_contacts,0)::bigint,
    coalesce(q.operational_pending_contacts,0)::bigint,
    coalesce(q.system_pending_contacts,0)::bigint
  from owners o
  left join audit_metrics a on a.owner_email=o.owner_email
  left join quality_metrics q on q.owner_email=o.owner_email
  order by o.owner_email;
$function$;

revoke all on function private.vf_intelligence_user_metrics_internal() from public;
revoke all on function private.vf_intelligence_user_metrics_internal() from anon;
grant execute on function private.vf_intelligence_user_metrics_internal() to authenticated, service_role;

create or replace function public.vf_intelligence_user_metrics()
returns table(
  owner_email text,
  manual_created_contacts bigint,
  imported_contacts bigint,
  updated_contacts bigint,
  operational_pending_contacts bigint,
  system_pending_contacts bigint
)
language sql
stable
set search_path=''
as $function$
  select * from private.vf_intelligence_user_metrics_internal();
$function$;

revoke all on function public.vf_intelligence_user_metrics() from public;
revoke all on function public.vf_intelligence_user_metrics() from anon;
grant execute on function public.vf_intelligence_user_metrics() to authenticated, service_role;
