begin;

create or replace function private.vf_activate_municipality_internal(p_municipality_id bigint)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  actor public.vf_users;
  municipality public.vf_municipalities;
begin
  select * into actor
  from public.vf_users
  where auth_user_id=(select auth.uid()) and status='active'
  limit 1;

  if actor.id is null or actor.access_role <> 'adm' then
    raise exception 'Acesso negado' using errcode='42501';
  end if;

  select * into municipality
  from public.vf_municipalities
  where id=p_municipality_id
  for update;

  if municipality.id is null then
    raise exception 'Município não encontrado';
  end if;

  if municipality.status='active' then
    insert into public.vf_user_municipalities(user_id,municipality_id,access_role,status,is_default,parent_user_id)
    values(actor.id,municipality.id,'adm','active',false,null)
    on conflict(user_id,municipality_id) do update
      set access_role='adm',status='active',parent_user_id=null;

    return jsonb_build_object('id',municipality.id,'name',municipality.name,'state',municipality.state,'status','active');
  end if;

  if municipality.status<>'configuring' then
    raise exception 'Município não está em configuração';
  end if;

  update public.vf_municipalities
  set status='active'
  where id=municipality.id;

  insert into public.vf_user_municipalities(user_id,municipality_id,access_role,status,is_default,parent_user_id)
  values(actor.id,municipality.id,'adm','active',false,null)
  on conflict(user_id,municipality_id) do update
    set access_role='adm',status='active',parent_user_id=null;

  insert into public.vf_audit_logs(actor_id,actor_email,action,detail,municipality_id)
  values(actor.auth_user_id,actor.email,'Município ativado',format('%s/%s · ativação pelo ADM Geral sem exigência de Master',municipality.name,municipality.state),municipality.id);

  return jsonb_build_object('id',municipality.id,'name',municipality.name,'state',municipality.state,'status','active');
end;
$$;

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
    and status in ('configuring','active');

  if municipality.id is null then
    raise exception 'Município indisponível para convite de Master';
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

with activated as (
  update public.vf_municipalities
  set status='active'
  where state='PR'
    and name in ('Prudentópolis','Bandeirantes','Carlópolis','Cambará','Siqueira Campos')
    and status='configuring'
  returning id,name,state
), actor as (
  select auth_user_id,email
  from public.vf_users
  where access_role='adm' and status='active'
  order by id
  limit 1
)
insert into public.vf_audit_logs(actor_id,actor_email,action,detail,municipality_id)
select actor.auth_user_id,actor.email,'Município ativado',format('%s/%s · ativação inicial pelo ADM Geral sem exigência de Master',activated.name,activated.state),activated.id
from activated cross join actor;

insert into public.vf_user_municipalities(user_id,municipality_id,access_role,status,is_default,parent_user_id)
select u.id,m.id,'adm','active',false,null
from public.vf_users u
cross join public.vf_municipalities m
where u.access_role='adm'
  and u.status='active'
  and m.status='active'
on conflict(user_id,municipality_id) do update
  set access_role='adm',status='active',parent_user_id=null;

commit;
