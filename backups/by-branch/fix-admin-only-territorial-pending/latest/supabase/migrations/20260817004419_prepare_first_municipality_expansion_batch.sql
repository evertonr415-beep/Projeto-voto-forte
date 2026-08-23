begin;

alter table public.vf_municipalities
  drop constraint if exists vf_municipalities_status_check;

alter table public.vf_municipalities
  add constraint vf_municipalities_status_check
  check (status in ('active','configuring','inactive'));

insert into public.vf_municipalities(name,state,status)
values
  ('Prudentópolis','PR','configuring'),
  ('Bandeirantes','PR','configuring'),
  ('Carlópolis','PR','configuring'),
  ('Cambará','PR','configuring'),
  ('Siqueira Campos','PR','configuring')
on conflict (name,state) do update
set status = case
  when public.vf_municipalities.status = 'inactive' then 'configuring'
  else public.vf_municipalities.status
end;

create or replace function private.vf_enforce_single_non_adm_municipality()
returns trigger
language plpgsql
set search_path=''
as $$
declare
  user_access_role text;
  has_other boolean;
begin
  select access_role into user_access_role
  from public.vf_users
  where id = new.user_id;

  if user_access_role is null then
    raise exception 'Usuário inválido';
  end if;

  if user_access_role <> 'adm' and new.status='active' then
    if tg_op = 'UPDATE' then
      select exists(
        select 1
        from public.vf_user_municipalities um
        where um.user_id = new.user_id
          and um.status = 'active'
          and um.municipality_id <> new.municipality_id
          and not (
            um.user_id = old.user_id
            and um.municipality_id = old.municipality_id
          )
      ) into has_other;
    else
      select exists(
        select 1
        from public.vf_user_municipalities um
        where um.user_id = new.user_id
          and um.status = 'active'
          and um.municipality_id <> new.municipality_id
      ) into has_other;
    end if;

    if has_other then
      raise exception 'Este usuário já possui município de acesso definido';
    end if;
  end if;

  return new;
end;
$$;

create or replace function private.vf_admin_municipalities_internal()
returns jsonb
language plpgsql
security definer
stable
set search_path=''
as $$
declare
  actor public.vf_users;
begin
  select * into actor
  from public.vf_users
  where auth_user_id=(select auth.uid())
    and status='active'
  limit 1;

  if actor.id is null or actor.access_role <> 'adm' then
    raise exception 'Acesso negado' using errcode='42501';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', m.id,
        'name', m.name,
        'state', m.state,
        'ibgeCode', m.ibge_code,
        'status', m.status,
        'users', (
          select count(*)
          from public.vf_user_municipalities um
          where um.municipality_id=m.id and um.status='active'
            and um.access_role <> 'adm'
        ),
        'contacts', (
          select count(*)
          from public.vf_owned_records r
          where r.municipality_id=m.id and r.kind='contact'
        ),
        'master', (
          select jsonb_build_object(
            'id',u.id,
            'name',u.name,
            'email',u.email,
            'status',u.status
          )
          from public.vf_user_municipalities um
          join public.vf_users u on u.id=um.user_id
          where um.municipality_id=m.id
            and um.status='active'
            and um.access_role='master'
            and u.status='active'
          order by um.created_at
          limit 1
        ),
        'pendingMasterInvitation', (
          select jsonb_build_object(
            'id',i.id,
            'name',i.name,
            'email',i.email,
            'expiresAt',i.expires_at
          )
          from public.vf_user_invitations i
          where i.municipality_id=m.id
            and i.access_role='master'
            and i.status='pending'
            and i.expires_at>now()
          order by i.created_at desc
          limit 1
        )
      )
      order by case when m.name='Arapongas' then 0 else 1 end, m.name
    )
    from public.vf_municipalities m
    where m.status <> 'inactive'
  ), '[]'::jsonb);
end;
$$;

create or replace function public.vf_admin_municipalities()
returns jsonb
language sql
stable
set search_path=''
as $$
  select private.vf_admin_municipalities_internal();
$$;

revoke all on function public.vf_admin_municipalities() from public, anon;
grant execute on function public.vf_admin_municipalities() to authenticated;

create or replace function private.vf_invite_configuring_municipality_master_internal(
  p_municipality_id bigint,
  p_name text,
  p_email text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  actor public.vf_users;
  municipality public.vf_municipalities;
  normalized_email text := lower(trim(coalesce(p_email,'')));
  normalized_name text := trim(coalesce(p_name,''));
  invitation public.vf_user_invitations;
begin
  select * into actor
  from public.vf_users
  where auth_user_id=(select auth.uid())
    and status='active'
  limit 1;

  if actor.id is null or actor.access_role <> 'adm' then
    raise exception 'Acesso negado' using errcode='42501';
  end if;

  select * into municipality
  from public.vf_municipalities
  where id=p_municipality_id
    and status='configuring';

  if municipality.id is null then
    raise exception 'Município não está em configuração';
  end if;

  if normalized_name='' or normalized_email='' or position('@' in normalized_email)<2 then
    raise exception 'Nome e e-mail válidos são obrigatórios';
  end if;

  if exists(
    select 1 from public.vf_user_municipalities um
    join public.vf_users u on u.id=um.user_id
    where um.municipality_id=municipality.id
      and um.access_role='master'
      and um.status='active'
      and u.status='active'
  ) then
    raise exception 'Este município já possui Master definido';
  end if;

  if exists(select 1 from public.vf_users where lower(trim(email))=normalized_email) then
    raise exception 'Este e-mail já possui conta Voto Forte';
  end if;

  update public.vf_user_invitations
  set status='expired'
  where status='pending' and expires_at<=now();

  if exists(
    select 1 from public.vf_user_invitations
    where municipality_id=municipality.id
      and access_role='master'
      and status='pending'
      and expires_at>now()
  ) then
    raise exception 'Já existe convite pendente para o Master deste município';
  end if;

  if exists(
    select 1 from public.vf_user_invitations
    where lower(email)=normalized_email
      and status='pending'
      and expires_at>now()
  ) then
    raise exception 'Já existe um convite pendente para este e-mail';
  end if;

  insert into public.vf_user_invitations(
    email,name,access_role,parent_user_id,invited_by_user_id,municipality_id
  ) values (
    normalized_email,normalized_name,'master',actor.id,actor.id,municipality.id
  )
  returning * into invitation;

  insert into public.vf_audit_logs(actor_id,actor_email,action,detail,municipality_id)
  values(
    actor.auth_user_id,
    actor.email,
    'Convite de Master municipal criado',
    format('%s <%s> · %s/%s',normalized_name,normalized_email,municipality.name,municipality.state),
    municipality.id
  );

  return jsonb_build_object(
    'id',invitation.id,
    'name',invitation.name,
    'email',invitation.email,
    'municipalityId',municipality.id,
    'municipalityName',municipality.name,
    'status',invitation.status,
    'expiresAt',invitation.expires_at
  );
end;
$$;

create or replace function public.vf_invite_configuring_municipality_master(
  p_municipality_id bigint,
  p_name text,
  p_email text
)
returns jsonb
language sql
set search_path=''
as $$
  select private.vf_invite_configuring_municipality_master_internal(
    p_municipality_id,p_name,p_email
  );
$$;

revoke all on function public.vf_invite_configuring_municipality_master(bigint,text,text) from public, anon;
grant execute on function public.vf_invite_configuring_municipality_master(bigint,text,text) to authenticated;

create or replace function private.vf_session_access_status_internal()
returns jsonb
language plpgsql
stable security definer
set search_path=''
as $$
declare
  uid uuid := (select auth.uid());
  auth_email text;
  email_confirmed_at timestamptz;
  profile public.vf_users;
  inv public.vf_user_invitations;
  req public.vf_signup_requests;
  municipality_status text;
  municipality_name text;
  state_code text;
  message_text text;
  suggested_action text;
begin
  if uid is null then raise exception 'Não autenticado' using errcode='42501'; end if;

  select lower(trim(u.email)),u.email_confirmed_at
  into auth_email,email_confirmed_at
  from auth.users u
  where u.id=uid;

  if auth_email is null then raise exception 'Conta Auth não encontrada' using errcode='42501'; end if;

  select * into profile
  from public.vf_users u
  where u.auth_user_id=uid
  limit 1;

  if profile.id is not null then
    select m.status,m.name
    into municipality_status,municipality_name
    from public.vf_user_municipalities um
    join public.vf_municipalities m on m.id=um.municipality_id
    where um.user_id=profile.id and um.status='active'
    order by um.is_default desc,um.created_at
    limit 1;
  end if;

  select * into inv
  from public.vf_user_invitations i
  where lower(trim(i.email))=auth_email
    and i.status='pending'
    and i.expires_at>now()
  order by i.created_at desc
  limit 1;

  select * into req
  from public.vf_signup_requests r
  where r.auth_user_id=uid
  order by r.requested_at desc
  limit 1;

  if profile.id is not null and profile.status='active' and profile.access_role='adm' then
    state_code:='active';
    message_text:='Acesso Voto Forte liberado.';
    suggested_action:='enter_application';
  elsif profile.id is not null and profile.status='active' and municipality_status='active' then
    state_code:='active';
    message_text:='Acesso Voto Forte liberado.';
    suggested_action:='enter_application';
  elsif profile.id is not null and profile.status='active' and municipality_status='configuring' then
    state_code:='awaiting_adm_activation';
    message_text:=format('O ambiente de %s está em configuração. Aguarde a liberação do ADM Geral.',coalesce(municipality_name,'seu município'));
    suggested_action:='wait_for_adm';
  elsif profile.id is not null then
    state_code:='profile_inactive';
    message_text:='Seu perfil Voto Forte está inativo. Procure o ADM responsável.';
    suggested_action:='contact_adm';
  elsif email_confirmed_at is null then
    state_code:='email_unconfirmed';
    message_text:='Confirme seu e-mail antes de ativar o acesso ao Voto Forte.';
    suggested_action:='confirm_email';
  elsif inv.id is not null then
    state_code:='invitation_ready';
    message_text:='Existe um convite Voto Forte válido para esta conta. Ative o convite para concluir seu acesso.';
    suggested_action:='claim_invitation';
  elsif req.id is not null and req.status='pending' then
    state_code:='awaiting_adm_activation';
    message_text:=format('Solicitação para %s/%s enviada. Aguarde a aprovação do ADM.',req.municipality_name,req.state);
    suggested_action:='wait_for_adm';
  elsif req.id is not null and req.status='rejected' then
    state_code:='awaiting_adm_activation';
    message_text:='Sua solicitação municipal não foi aprovada. Procure o ADM responsável.';
    suggested_action:='contact_adm';
  else
    state_code:='awaiting_adm_activation';
    message_text:='Sua conta foi autenticada, mas ainda não foi habilitada no Voto Forte.';
    suggested_action:='wait_for_adm';
  end if;

  return jsonb_build_object(
    'state',state_code,
    'message',message_text,
    'suggestedAction',suggested_action,
    'canEnterApplication',state_code='active',
    'canClaimInvitation',state_code='invitation_ready',
    'requiresAdmReview',state_code in ('awaiting_adm_activation','profile_inactive'),
    'email',auth_email,
    'emailConfirmed',email_confirmed_at is not null,
    'signupRequest',case when req.id is null then null else jsonb_build_object(
      'id',req.id,'municipalityName',req.municipality_name,'state',req.state,'status',req.status
    ) end
  );
end;
$$;

commit;