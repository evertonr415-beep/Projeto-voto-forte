create or replace function private.vf_auth_profile_reconciliation_internal()
returns table(
  auth_user_id uuid,
  email text,
  display_name text,
  auth_created_at timestamptz,
  confirmed_at timestamptz,
  last_sign_in_at timestamptz,
  current_sessions bigint,
  profile_id bigint,
  profile_name text,
  profile_access_role text,
  profile_status text,
  pending_invitation boolean,
  pending_invitation_role text,
  owned_records bigint,
  subject_records bigint,
  audit_events bigint,
  reconciliation_state text,
  can_reconcile boolean
)
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if not private.vf_is_adm() then
    raise exception 'Acesso negado: reconciliação de contas exclusiva do ADM' using errcode = '42501';
  end if;

  return query
  select
    au.id,
    lower(au.email),
    coalesce(
      nullif(au.raw_user_meta_data->>'full_name',''),
      nullif(au.raw_user_meta_data->>'name',''),
      nullif(au.raw_user_meta_data->>'display_name','')
    ) as display_name,
    au.created_at,
    au.confirmed_at,
    au.last_sign_in_at,
    (select count(*)::bigint from auth.sessions s where s.user_id = au.id) as current_sessions,
    vu.id,
    vu.name,
    vu.access_role,
    vu.status,
    exists (
      select 1
      from public.vf_user_invitations i
      where lower(i.email) = lower(au.email)
        and i.status = 'pending'
        and i.expires_at > now()
    ) as pending_invitation,
    (
      select i.access_role
      from public.vf_user_invitations i
      where lower(i.email) = lower(au.email)
        and i.status = 'pending'
        and i.expires_at > now()
      order by i.created_at desc
      limit 1
    ) as pending_invitation_role,
    (select count(*)::bigint from public.vf_owned_records r where r.owner_id = au.id) as owned_records,
    (select count(*)::bigint from public.vf_owned_records r where r.subject_auth_user_id = au.id) as subject_records,
    (select count(*)::bigint from public.vf_audit_logs a where a.actor_id = au.id) as audit_events,
    case
      when vu.id is not null then 'linked'
      when au.confirmed_at is null then 'unconfirmed'
      when exists (
        select 1
        from public.vf_user_invitations i
        where lower(i.email) = lower(au.email)
          and i.status = 'pending'
          and i.expires_at > now()
      ) then 'pending_invitation'
      else 'confirmed_unlinked'
    end as reconciliation_state,
    (
      vu.id is null
      and au.confirmed_at is not null
      and not exists (
        select 1 from public.vf_users ux
        where lower(trim(ux.email)) = lower(trim(au.email))
      )
      and not exists (
        select 1
        from public.vf_user_invitations i
        where lower(i.email) = lower(au.email)
          and i.status = 'pending'
          and i.expires_at > now()
      )
    ) as can_reconcile
  from auth.users au
  left join public.vf_users vu on vu.auth_user_id = au.id
  order by
    case when vu.id is null then 0 else 1 end,
    au.created_at,
    lower(au.email);
end;
$function$;

revoke execute on function private.vf_auth_profile_reconciliation_internal() from public, anon;
grant execute on function private.vf_auth_profile_reconciliation_internal() to authenticated, service_role;

create or replace function public.vf_auth_profile_reconciliation()
returns table(
  auth_user_id uuid,
  email text,
  display_name text,
  auth_created_at timestamptz,
  confirmed_at timestamptz,
  last_sign_in_at timestamptz,
  current_sessions bigint,
  profile_id bigint,
  profile_name text,
  profile_access_role text,
  profile_status text,
  pending_invitation boolean,
  pending_invitation_role text,
  owned_records bigint,
  subject_records bigint,
  audit_events bigint,
  reconciliation_state text,
  can_reconcile boolean
)
language sql
stable
security invoker
set search_path to ''
as $function$
  select * from private.vf_auth_profile_reconciliation_internal();
$function$;

revoke execute on function public.vf_auth_profile_reconciliation() from public, anon;
grant execute on function public.vf_auth_profile_reconciliation() to authenticated, service_role;

create or replace function private.vf_reconcile_auth_profile_internal(
  p_auth_user_id uuid,
  p_name text,
  p_access_role text,
  p_parent_user_id bigint default null
)
returns public.vf_users
language plpgsql
security definer
set search_path to ''
as $function$
declare
  auth_row auth.users;
  result public.vf_users;
begin
  if not private.vf_is_adm() then
    raise exception 'Acesso negado: reconciliação de contas exclusiva do ADM' using errcode = '42501';
  end if;

  select * into auth_row
  from auth.users
  where id = p_auth_user_id;

  if auth_row.id is null then
    raise exception 'Conta Auth não encontrada' using errcode = '22023';
  end if;

  if auth_row.confirmed_at is null then
    raise exception 'A conta Auth ainda não confirmou o e-mail' using errcode = '22023';
  end if;

  if trim(coalesce(p_name,'')) = '' then
    raise exception 'Nome obrigatório' using errcode = '22023';
  end if;

  if p_access_role = 'adm' then
    raise exception 'Para adicionar outro ADM, utilize o fluxo de convite de ADM' using errcode = '22023';
  end if;

  if p_access_role not in ('master','lideranca','liderado','eleitor') then
    raise exception 'Perfil de destino inválido' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.vf_user_invitations i
    where lower(i.email) = lower(auth_row.email)
      and i.status = 'pending'
      and i.expires_at > now()
  ) then
    raise exception 'Existe convite ativo para esta conta; utilize o fluxo de aceite do convite' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.vf_users u
    where u.auth_user_id = auth_row.id
       or lower(trim(u.email)) = lower(trim(auth_row.email))
  ) then
    raise exception 'Conta Auth já vinculada a um perfil VotoForte' using errcode = '23505';
  end if;

  select * into result
  from private.vf_register_profile_internal(
    auth_row.id,
    lower(trim(auth_row.email)),
    trim(p_name),
    p_access_role,
    p_parent_user_id
  );

  return result;
end;
$function$;

revoke execute on function private.vf_reconcile_auth_profile_internal(uuid,text,text,bigint) from public, anon;
grant execute on function private.vf_reconcile_auth_profile_internal(uuid,text,text,bigint) to authenticated, service_role;

create or replace function public.vf_reconcile_auth_profile(
  p_auth_user_id uuid,
  p_name text,
  p_access_role text,
  p_parent_user_id bigint default null
)
returns public.vf_users
language sql
security invoker
set search_path to ''
as $function$
  select private.vf_reconcile_auth_profile_internal(
    p_auth_user_id,
    p_name,
    p_access_role,
    p_parent_user_id
  );
$function$;

revoke execute on function public.vf_reconcile_auth_profile(uuid,text,text,bigint) from public, anon;
grant execute on function public.vf_reconcile_auth_profile(uuid,text,text,bigint) to authenticated, service_role;