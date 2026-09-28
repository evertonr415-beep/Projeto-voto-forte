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
  if actor.id is null or actor.access_role <> 'adm' then raise exception 'Acesso negado' using errcode='42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',r.id,'email',r.email,'name',r.name,'municipalityName',r.municipality_name,
      'state',r.state,'status',r.status,'requestedAt',r.requested_at
    ) order by r.requested_at desc)
    from public.vf_signup_requests r
    where r.status='pending'
  ),'[]'::jsonb);
end;
$$;

create or replace function public.vf_list_signup_requests()
returns jsonb language sql set search_path=''
as $$ select private.vf_list_signup_requests_internal(); $$;
revoke all on function public.vf_list_signup_requests() from public, anon;
grant execute on function public.vf_list_signup_requests() to authenticated;

create or replace function private.vf_approve_signup_request_internal(
  p_request_id uuid,
  p_access_role text,
  p_parent_user_id bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  actor public.vf_users;
  req public.vf_signup_requests;
  municipality public.vf_municipalities;
  parent_user public.vf_users;
  created_user public.vf_users;
  legacy_role text;
  target_parent bigint;
begin
  select * into actor from public.vf_users where auth_user_id=(select auth.uid()) and status='active' limit 1;
  if actor.id is null or actor.access_role <> 'adm' then raise exception 'Acesso negado' using errcode='42501'; end if;
  if p_access_role not in ('master','lideranca','liderado','eleitor') then raise exception 'Perfil inválido'; end if;

  select * into req from public.vf_signup_requests where id=p_request_id and status='pending' for update;
  if req.id is null then raise exception 'Solicitação não encontrada ou já processada'; end if;
  if exists(select 1 from public.vf_users where auth_user_id=req.auth_user_id) then raise exception 'Esta conta já possui perfil Voto Forte'; end if;

  insert into public.vf_municipalities(name,state,status,created_by)
  values(req.municipality_name,req.state,'active',actor.auth_user_id)
  on conflict(name,state) do update set status='active'
  returning * into municipality;

  insert into public.vf_user_municipalities(user_id,municipality_id,access_role,status,is_default)
  values(actor.id,municipality.id,'adm','active',false)
  on conflict(user_id,municipality_id) do update set access_role='adm',status='active';

  if p_access_role='master' then
    target_parent := actor.id;
  else
    target_parent := p_parent_user_id;
    if target_parent is null then raise exception 'Informe o superior imediato'; end if;
    select u.* into parent_user
    from public.vf_users u
    join public.vf_user_municipalities um on um.user_id=u.id
    where u.id=target_parent and u.status='active' and um.municipality_id=municipality.id and um.status='active';
    if parent_user.id is null then raise exception 'Superior inválido para este município'; end if;
    if (p_access_role='lideranca' and parent_user.access_role <> 'master')
      or (p_access_role='liderado' and parent_user.access_role <> 'lideranca')
      or (p_access_role='eleitor' and parent_user.access_role <> 'liderado') then
      raise exception 'Hierarquia incompatível';
    end if;
  end if;

  legacy_role := case p_access_role when 'master' then 'master' when 'lideranca' then 'lider' else 'liderado' end;

  insert into public.vf_users(auth_user_id,email,name,role,access_role,status,parent_user_id)
  values(req.auth_user_id,lower(req.email),req.name,legacy_role,p_access_role,'active',target_parent)
  returning * into created_user;

  insert into public.vf_user_municipalities(user_id,municipality_id,access_role,status,is_default)
  values(created_user.id,municipality.id,p_access_role,'active',true);

  update public.vf_signup_requests set status='approved',reviewed_at=now(),reviewed_by=actor.id where id=req.id;

  insert into public.vf_audit_logs(actor_id,actor_email,action,detail,municipality_id)
  values(actor.auth_user_id,actor.email,'Cadastro municipal aprovado',format('%s <%s> · %s · %s/%s',req.name,req.email,p_access_role,municipality.name,municipality.state),municipality.id);

  return jsonb_build_object('userId',created_user.id,'municipalityId',municipality.id,'municipalityName',municipality.name,'accessRole',p_access_role);
end;
$$;

create or replace function public.vf_approve_signup_request(p_request_id uuid,p_access_role text,p_parent_user_id bigint default null)
returns jsonb language sql set search_path=''
as $$ select private.vf_approve_signup_request_internal(p_request_id,p_access_role,p_parent_user_id); $$;
revoke all on function public.vf_approve_signup_request(uuid,text,bigint) from public, anon;
grant execute on function public.vf_approve_signup_request(uuid,text,bigint) to authenticated;

create or replace function private.vf_reject_signup_request_internal(p_request_id uuid,p_note text default null)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare actor public.vf_users; req public.vf_signup_requests;
begin
  select * into actor from public.vf_users where auth_user_id=(select auth.uid()) and status='active' limit 1;
  if actor.id is null or actor.access_role <> 'adm' then raise exception 'Acesso negado' using errcode='42501'; end if;
  update public.vf_signup_requests set status='rejected',reviewed_at=now(),reviewed_by=actor.id,review_note=left(coalesce(p_note,''),500)
  where id=p_request_id and status='pending' returning * into req;
  if req.id is null then raise exception 'Solicitação não encontrada ou já processada'; end if;
  return jsonb_build_object('id',req.id,'status',req.status);
end;
$$;

create or replace function public.vf_reject_signup_request(p_request_id uuid,p_note text default null)
returns jsonb language sql set search_path=''
as $$ select private.vf_reject_signup_request_internal(p_request_id,p_note); $$;
revoke all on function public.vf_reject_signup_request(uuid,text) from public, anon;
grant execute on function public.vf_reject_signup_request(uuid,text) to authenticated;

create or replace function private.vf_create_user_invitation_for_municipality_internal(
  p_email text,p_name text,p_access_role text,p_parent_user_id bigint,p_municipality_id bigint
)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  actor public.vf_users;
  parent_user public.vf_users;
  municipality public.vf_municipalities;
  invitation public.vf_user_invitations;
  normalized_email text:=lower(trim(p_email));
  target_role text;
  target_parent bigint;
begin
  select * into actor from public.vf_users where auth_user_id=(select auth.uid()) and status='active' limit 1;
  if actor.id is null or actor.access_role='eleitor' then raise exception 'Acesso negado' using errcode='42501'; end if;
  select * into municipality from public.vf_municipalities where id=p_municipality_id and status='active';
  if municipality.id is null then raise exception 'Município inválido'; end if;
  if not exists(select 1 from public.vf_user_municipalities where user_id=actor.id and municipality_id=municipality.id and status='active') then
    raise exception 'Você não possui acesso a este município';
  end if;
  if normalized_email='' or position('@' in normalized_email)<2 or trim(coalesce(p_name,''))='' then raise exception 'Nome e e-mail válidos são obrigatórios'; end if;
  if exists(select 1 from public.vf_users where lower(trim(email))=normalized_email) then raise exception 'Este e-mail já possui conta VotoForte'; end if;

  target_role:=p_access_role;
  if actor.access_role='adm' then
    if target_role not in ('master','lideranca','liderado','eleitor') then raise exception 'Perfil inválido'; end if;
  else
    target_role:=private.vf_child_access_role(actor.access_role);
    if p_access_role is distinct from target_role then raise exception 'Seu perfil só pode convidar o nível imediatamente abaixo'; end if;
  end if;

  if target_role='master' then
    if actor.access_role<>'adm' then raise exception 'Somente ADM pode criar Master'; end if;
    target_parent:=actor.id;
  else
    target_parent:=coalesce(p_parent_user_id,case when actor.access_role<>'adm' then actor.id else null end);
    if target_parent is null then raise exception 'Informe o superior imediato'; end if;
    select u.* into parent_user from public.vf_users u
    join public.vf_user_municipalities um on um.user_id=u.id
    where u.id=target_parent and u.status='active' and um.municipality_id=municipality.id and um.status='active';
    if parent_user.id is null then raise exception 'Superior inválido para este município'; end if;
  end if;

  if exists(select 1 from public.vf_user_invitations where lower(email)=normalized_email and status='pending' and expires_at>now()) then raise exception 'Já existe um convite pendente para este e-mail'; end if;

  insert into public.vf_user_invitations(email,name,access_role,parent_user_id,invited_by_user_id,municipality_id)
  values(normalized_email,trim(p_name),target_role,target_parent,actor.id,municipality.id)
  returning * into invitation;

  return jsonb_build_object('id',invitation.id,'email',invitation.email,'name',invitation.name,'accessRole',invitation.access_role,'parentUserId',invitation.parent_user_id,'municipalityId',municipality.id,'municipalityName',municipality.name,'expiresAt',invitation.expires_at);
end;
$$;

create or replace function public.vf_create_user_invitation_for_municipality(p_email text,p_name text,p_access_role text,p_parent_user_id bigint,p_municipality_id bigint)
returns jsonb language sql set search_path=''
as $$ select private.vf_create_user_invitation_for_municipality_internal(p_email,p_name,p_access_role,p_parent_user_id,p_municipality_id); $$;
revoke all on function public.vf_create_user_invitation_for_municipality(text,text,text,bigint,bigint) from public, anon;
grant execute on function public.vf_create_user_invitation_for_municipality(text,text,text,bigint,bigint) to authenticated;

commit;