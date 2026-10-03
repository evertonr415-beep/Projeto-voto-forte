begin;

create or replace function private.vf_enforce_single_non_adm_municipality()
returns trigger
language plpgsql
set search_path=''
as $$
declare user_access_role text;
begin
  select access_role into user_access_role from public.vf_users where id=new.user_id;
  if user_access_role is null then raise exception 'Usuário inválido'; end if;
  if user_access_role <> 'adm' and new.status='active' and exists(
    select 1 from public.vf_user_municipalities um
    where um.user_id=new.user_id
      and um.status='active'
      and um.municipality_id<>new.municipality_id
      and (tg_op='INSERT' or um.id<>new.id)
  ) then
    raise exception 'Este usuário já possui município de acesso definido';
  end if;
  return new;
end;
$$;

drop trigger if exists vf_user_municipalities_single_city_guard on public.vf_user_municipalities;
create trigger vf_user_municipalities_single_city_guard
before insert or update of municipality_id,status on public.vf_user_municipalities
for each row execute function private.vf_enforce_single_non_adm_municipality();

create or replace function private.vf_municipality_context_internal()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  actor public.vf_users;
  current_id bigint;
  items jsonb;
begin
  select * into actor from public.vf_users
  where auth_user_id=(select auth.uid()) and status='active' limit 1;
  if actor.id is null then raise exception 'Acesso negado' using errcode='42501'; end if;

  current_id:=private.vf_current_municipality_id();

  if actor.access_role='adm' then
    insert into public.vf_user_municipalities(user_id,municipality_id,access_role,status,is_default,parent_user_id)
    select actor.id,m.id,'adm','active',m.id=current_id,null
    from public.vf_municipalities m where m.status='active'
    on conflict(user_id,municipality_id) do update set access_role='adm',status='active';

    select coalesce(jsonb_agg(jsonb_build_object(
      'id',m.id,'name',m.name,'state',m.state,'ibgeCode',m.ibge_code,
      'accessRole','adm','isDefault',um.is_default
    ) order by m.name),'[]'::jsonb)
    into items
    from public.vf_user_municipalities um
    join public.vf_municipalities m on m.id=um.municipality_id
    where um.user_id=actor.id and um.status='active' and m.status='active';
  else
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',m.id,'name',m.name,'state',m.state,'ibgeCode',m.ibge_code,
      'accessRole',um.access_role,'isDefault',true
    )),'[]'::jsonb)
    into items
    from public.vf_user_municipalities um
    join public.vf_municipalities m on m.id=um.municipality_id
    where um.user_id=actor.id and um.status='active' and m.status='active';
  end if;

  return jsonb_build_object(
    'currentMunicipalityId',current_id,
    'municipalities',items,
    'isGeneralAdm',actor.access_role='adm',
    'canSwitchMunicipality',actor.access_role='adm'
  );
end;
$$;

create or replace function private.vf_set_default_municipality_internal(p_municipality_id bigint)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare actor public.vf_users;
begin
  select * into actor from public.vf_users
  where auth_user_id=(select auth.uid()) and status='active' limit 1;
  if actor.id is null then raise exception 'Acesso negado' using errcode='42501'; end if;
  if actor.access_role <> 'adm' then raise exception 'Somente o ADM pode trocar de município'; end if;
  if not exists(select 1 from public.vf_municipalities where id=p_municipality_id and status='active') then raise exception 'Município inválido'; end if;

  insert into public.vf_user_municipalities(user_id,municipality_id,access_role,status,is_default,parent_user_id)
  values(actor.id,p_municipality_id,'adm','active',false,null)
  on conflict(user_id,municipality_id) do update set access_role='adm',status='active';

  update public.vf_user_municipalities set is_default=false where user_id=actor.id;
  update public.vf_user_municipalities set is_default=true where user_id=actor.id and municipality_id=p_municipality_id;
  return private.vf_municipality_context_internal();
end;
$$;

create or replace function private.vf_approve_signup_request_internal(p_request_id uuid,p_access_role text,p_parent_user_id bigint default null)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  actor public.vf_users;
  req public.vf_signup_requests;
  municipality public.vf_municipalities;
  parent_membership public.vf_user_municipalities;
  existing_user public.vf_users;
  created_user public.vf_users;
  legacy_role text;
  target_role text:=lower(trim(coalesce(p_access_role,'')));
  target_parent bigint;
begin
  select * into actor from public.vf_users where auth_user_id=(select auth.uid()) and status='active' limit 1;
  if actor.id is null or actor.access_role not in ('adm','master') then raise exception 'Acesso negado' using errcode='42501'; end if;

  select * into req from public.vf_signup_requests where id=p_request_id and status='pending' for update;
  if req.id is null then raise exception 'Solicitação não encontrada ou já processada'; end if;

  select * into municipality from public.vf_municipalities
  where lower(name)=lower(req.municipality_name) and state=req.state limit 1;

  if municipality.id is null then
    if actor.access_role <> 'adm' then raise exception 'O município ainda precisa ser criado pelo ADM geral'; end if;
    insert into public.vf_municipalities(name,state,status,created_by)
    values(req.municipality_name,req.state,'active',actor.auth_user_id)
    returning * into municipality;
  end if;

  if actor.access_role='adm' then
    insert into public.vf_user_municipalities(user_id,municipality_id,access_role,status,is_default,parent_user_id)
    values(actor.id,municipality.id,'adm','active',false,null)
    on conflict(user_id,municipality_id) do update set access_role='adm',status='active';
    if target_role not in ('master','lideranca','liderado','eleitor') then raise exception 'Perfil inválido'; end if;
  else
    if not exists(select 1 from public.vf_user_municipalities where user_id=actor.id and municipality_id=municipality.id and status='active' and access_role='master') then raise exception 'Solicitação fora do seu município'; end if;
    target_role:='lideranca';
  end if;

  if target_role='master' then target_parent:=actor.id;
  elsif actor.access_role='master' then target_parent:=actor.id;
  else
    target_parent:=p_parent_user_id;
    if target_parent is null then raise exception 'Informe o superior imediato'; end if;
    select * into parent_membership from public.vf_user_municipalities
    where user_id=target_parent and municipality_id=municipality.id and status='active';
    if parent_membership.id is null then raise exception 'Superior inválido para este município'; end if;
    if (target_role='lideranca' and parent_membership.access_role <> 'master')
      or (target_role='liderado' and parent_membership.access_role <> 'lideranca')
      or (target_role='eleitor' and parent_membership.access_role <> 'liderado') then raise exception 'Hierarquia incompatível'; end if;
  end if;

  select * into existing_user from public.vf_users where auth_user_id=req.auth_user_id limit 1;
  if existing_user.id is not null then
    if existing_user.access_role <> 'adm' then
      raise exception 'Este login já está vinculado a outro município';
    end if;
    raise exception 'ADM não utiliza solicitação municipal comum';
  end if;

  legacy_role:=case target_role when 'master' then 'master' when 'lideranca' then 'lider' else 'liderado' end;
  insert into public.vf_users(auth_user_id,email,name,role,access_role,status,parent_user_id)
  values(req.auth_user_id,lower(req.email),req.name,legacy_role,target_role,'active',target_parent)
  returning * into created_user;

  insert into public.vf_user_municipalities(user_id,municipality_id,access_role,status,is_default,parent_user_id)
  values(created_user.id,municipality.id,target_role,'active',true,target_parent);

  update public.vf_signup_requests set status='approved',reviewed_at=now(),reviewed_by=actor.id where id=req.id;
  insert into public.vf_audit_logs(actor_id,actor_email,action,detail,municipality_id)
  values(actor.auth_user_id,actor.email,'Cadastro municipal aprovado',format('%s <%s> · %s · %s/%s',req.name,req.email,target_role,municipality.name,municipality.state),municipality.id);

  return jsonb_build_object('userId',created_user.id,'municipalityId',municipality.id,'municipalityName',municipality.name,'accessRole',target_role);
end;
$$;

commit;