-- Keep contact pagination exact without recalculating the full dashboard summary.
-- Authorization follows the same owner-scope validation used by the official
-- contact dashboard summary before the SECURITY DEFINER count is executed.

create or replace function private.vf_contact_scope_total_internal(
  p_owner_emails text[]
)
returns bigint
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_requested text[];
  v_forbidden boolean;
  v_total bigint;
begin
  select coalesce(array_agg(distinct lower(trim(x))), '{}'::text[])
    into v_requested
  from unnest(coalesce(p_owner_emails, '{}'::text[])) x
  where trim(x) <> '';

  if cardinality(v_requested) = 0 then
    raise exception 'Nenhum responsável foi informado.' using errcode = '22023';
  end if;

  if coalesce((select auth.jwt()->>'role'), '') <> 'service_role' then
    if (select auth.uid()) is null then
      raise exception 'Usuário não autenticado.' using errcode = '42501';
    end if;

    select exists(
      select 1
      from unnest(v_requested) e
      where not private.vf_can_view_owner_email(e)
    ) into v_forbidden;

    if v_forbidden then
      raise exception 'Você não possui acesso a um ou mais responsáveis informados.' using errcode = '42501';
    end if;
  end if;

  select count(*)::bigint
    into v_total
  from public.vf_owned_records r
  where r.kind = 'contact'
    and r.municipality_id = private.vf_current_municipality_id()
    and r.owner_email = any(v_requested);

  return coalesce(v_total, 0);
end;
$function$;

revoke all on function private.vf_contact_scope_total_internal(text[]) from public;
revoke all on function private.vf_contact_scope_total_internal(text[]) from anon;
grant execute on function private.vf_contact_scope_total_internal(text[]) to authenticated, service_role;

create or replace function public.vf_contact_scope_total(
  p_owner_emails text[]
)
returns bigint
language sql
stable
set search_path = ''
as $function$
  select private.vf_contact_scope_total_internal(p_owner_emails);
$function$;

revoke all on function public.vf_contact_scope_total(text[]) from public;
revoke all on function public.vf_contact_scope_total(text[]) from anon;
grant execute on function public.vf_contact_scope_total(text[]) to authenticated, service_role;
