begin;

create or replace function public.vf_contact_dashboard_summary(p_owner_emails text[])
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_caller_id bigint;
  v_caller_role text;
  v_requested_emails text[];
  v_has_forbidden_email boolean;
begin
  select coalesce(array_agg(distinct lower(trim(requested_email))), '{}'::text[])
    into v_requested_emails
  from unnest(coalesce(p_owner_emails, '{}'::text[])) as requested(requested_email)
  where trim(requested_email) <> '';

  if cardinality(v_requested_emails) = 0 then
    raise exception 'Nenhum responsável foi informado.'
      using errcode = '22023';
  end if;

  if coalesce((select auth.jwt() ->> 'role'), '') = 'service_role' then
    return public.vf_contact_dashboard_summary_cached(v_requested_emails);
  end if;

  if (select auth.uid()) is null then
    raise exception 'Usuário não autenticado.'
      using errcode = '42501';
  end if;

  select u.id, u.role
    into v_caller_id, v_caller_role
  from public.vf_users u
  where u.auth_user_id = (select auth.uid())
    and u.status = 'active'
  limit 1;

  if v_caller_id is null then
    raise exception 'Usuário sem acesso ativo.'
      using errcode = '42501';
  end if;

  if v_caller_role = 'master' then
    select exists (
      select 1
      from unnest(v_requested_emails) as requested(email)
      where not exists (
        select 1
        from public.vf_users allowed_user
        where allowed_user.status = 'active'
          and lower(trim(allowed_user.email)) = requested.email
      )
    )
      into v_has_forbidden_email;
  else
    with recursive visible_users as (
      select
        u.id,
        lower(trim(u.email)) as email,
        array[u.id]::bigint[] as visited_ids
      from public.vf_users u
      where u.id = v_caller_id
        and u.status = 'active'

      union all

      select
        child.id,
        lower(trim(child.email)) as email,
        parent.visited_ids || child.id
      from public.vf_users child
      join visible_users parent
        on child.parent_user_id = parent.id
      where child.status = 'active'
        and not child.id = any(parent.visited_ids)
    )
    select exists (
      select 1
      from unnest(v_requested_emails) as requested(email)
      where not exists (
        select 1
        from visible_users allowed_user
        where allowed_user.email = requested.email
      )
    )
      into v_has_forbidden_email;
  end if;

  if v_has_forbidden_email then
    raise exception 'Você não possui acesso a um ou mais responsáveis informados.'
      using errcode = '42501';
  end if;

  return public.vf_contact_dashboard_summary_cached(v_requested_emails);
end;
$$;

revoke all on function public.vf_contact_dashboard_summary(text[]) from public, anon;
grant execute on function public.vf_contact_dashboard_summary(text[]) to authenticated, service_role;

revoke all on function public.vf_contact_dashboard_summary_cached(text[]) from public, anon, authenticated;
grant execute on function public.vf_contact_dashboard_summary_cached(text[]) to service_role;

commit;
