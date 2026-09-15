begin;

create or replace function private.vf_list_signup_requests_internal()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare actor public.vf_users;
begin
  select * into actor from public.vf_users where auth_user_id=(select auth.uid()) and status='active' limit 1;
  if actor.id is null or actor.access_role not in ('adm','master') then raise exception 'Acesso negado' using errcode='42501'; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',r.id,'email',r.email,'name',r.name,'municipalityName',r.municipality_name,
      'state',r.state,'status',r.status,'requestedAt',r.requested_at,
      'municipalityId',m.id,
      'parentOptions',coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',u.id,'name',u.name,'email',u.email,'accessRole',um.access_role
        ) order by u.name)
        from public.vf_user_municipalities um
        join public.vf_users u on u.id=um.user_id
        where um.municipality_id=m.id and um.status='active' and u.status='active'
          and um.access_role in ('master','lideranca','liderado')
      ),'[]'::jsonb)
    ) order by r.requested_at desc)
    from public.vf_signup_requests r
    left join public.vf_municipalities m on lower(m.name)=lower(r.municipality_name) and m.state=r.state
    where r.status='pending'
      and (
        actor.access_role='adm'
        or exists(
          select 1 from public.vf_user_municipalities own
          where own.user_id=actor.id and own.municipality_id=m.id and own.status='active' and own.access_role='master'
        )
      )
  ),'[]'::jsonb);
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
    if not exists(select 1 from public.vf_user_municipalities where user_id=actor.id and municipality_id=municipality.id and status='active' and access_role='master') then
      raise exception 'Solicitação fora do seu município';
    end if;
    target_role:='lideranca';
  end if;

  if target_role='master' then
    target_parent:=actor.id;
  elsif actor.access_role='master' then
    target_parent:=actor.id;
  else
    target_parent:=p_parent_user_id;
    if target_parent is null then raise exception 'Informe o superior imediato'; end if;
    select * into parent_membership from public.vf_user_municipalities
    where user_id=target_parent and municipality_id=municipality.id and status='active';
    if parent_membership.id is null then raise exception 'Superior inválido para este município'; end if;
    if (target_role='lideranca' and parent_membership.access_role <> 'master')
      or (target_role='liderado' and parent_membership.access_role <> 'lideranca')
      or (target_role='eleitor' and parent_membership.access_role <> 'liderado') then
      raise exception 'Hierarquia incompatível';
    end if;
  end if;

  select * into existing_user from public.vf_users where auth_user_id=req.auth_user_id limit 1;

  if existing_user.id is not null then
    insert into public.vf_user_municipalities(user_id,municipality_id,access_role,status,is_default,parent_user_id)
    values(existing_user.id,municipality.id,target_role,'active',false,target_parent)
    on conflict(user_id,municipality_id) do update
      set access_role=excluded.access_role,status='active',parent_user_id=excluded.parent_user_id;
    created_user:=existing_user;
  else
    legacy_role:=case target_role when 'master' then 'master' when 'lideranca' then 'lider' else 'liderado' end;
    insert into public.vf_users(auth_user_id,email,name,role,access_role,status,parent_user_id)
    values(req.auth_user_id,lower(req.email),req.name,legacy_role,target_role,'active',target_parent)
    returning * into created_user;

    insert into public.vf_user_municipalities(user_id,municipality_id,access_role,status,is_default,parent_user_id)
    values(created_user.id,municipality.id,target_role,'active',true,target_parent);
  end if;

  update public.vf_signup_requests set status='approved',reviewed_at=now(),reviewed_by=actor.id where id=req.id;

  insert into public.vf_audit_logs(actor_id,actor_email,action,detail,municipality_id)
  values(actor.auth_user_id,actor.email,'Cadastro municipal aprovado',format('%s <%s> · %s · %s/%s',req.name,req.email,target_role,municipality.name,municipality.state),municipality.id);

  return jsonb_build_object('userId',created_user.id,'municipalityId',municipality.id,'municipalityName',municipality.name,'accessRole',target_role);
end;
$$;

create or replace function private.vf_reject_signup_request_internal(p_request_id uuid,p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare actor public.vf_users; req public.vf_signup_requests; municipality_id bigint;
begin
  select * into actor from public.vf_users where auth_user_id=(select auth.uid()) and status='active' limit 1;
  if actor.id is null or actor.access_role not in ('adm','master') then raise exception 'Acesso negado' using errcode='42501'; end if;

  select * into req from public.vf_signup_requests where id=p_request_id and status='pending' for update;
  if req.id is null then raise exception 'Solicitação não encontrada ou já processada'; end if;

  select id into municipality_id from public.vf_municipalities where lower(name)=lower(req.municipality_name) and state=req.state limit 1;
  if actor.access_role='master' and not exists(
    select 1 from public.vf_user_municipalities where user_id=actor.id and municipality_id=municipality_id and status='active' and access_role='master'
  ) then raise exception 'Solicitação fora do seu município'; end if;

  update public.vf_signup_requests set status='rejected',reviewed_at=now(),reviewed_by=actor.id,review_note=left(coalesce(p_note,''),500)
  where id=req.id;
  return jsonb_build_object('id',req.id,'status','rejected');
end;
$$;

commit;