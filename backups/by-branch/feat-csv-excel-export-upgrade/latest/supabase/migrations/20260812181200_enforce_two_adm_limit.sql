alter table public.vf_user_invitations
  drop constraint if exists vf_user_invitations_access_role_check;

alter table public.vf_user_invitations
  add constraint vf_user_invitations_access_role_check
  check (access_role = any (array['adm'::text,'master'::text,'lideranca'::text,'liderado'::text,'eleitor'::text]));

create or replace function private.vf_enforce_active_adm_limit()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  active_adm_count integer;
begin
  if new.access_role = 'adm' and new.status = 'active' then
    perform pg_catalog.pg_advisory_xact_lock(9420021::bigint);

    if tg_op = 'UPDATE' then
      select count(*)::integer into active_adm_count
      from public.vf_users u
      where u.access_role = 'adm' and u.status = 'active' and u.id <> new.id;
    else
      select count(*)::integer into active_adm_count
      from public.vf_users u
      where u.access_role = 'adm' and u.status = 'active';
    end if;

    if active_adm_count >= 2 then
      raise exception 'O VotoForte permite no máximo 2 ADMs ativos.';
    end if;
  end if;

  return new;
end;
$function$;

revoke all on function private.vf_enforce_active_adm_limit() from public;

drop trigger if exists vf_enforce_active_adm_limit on public.vf_users;
create trigger vf_enforce_active_adm_limit
before insert or update of access_role, status on public.vf_users
for each row execute function private.vf_enforce_active_adm_limit();

create or replace function private.vf_create_user_invitation_internal(
  p_email text,
  p_name text,
  p_access_role text default null::text,
  p_parent_user_id bigint default null::bigint
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  actor public.vf_users;
  parent_user public.vf_users;
  target_role text;
  target_parent_id bigint;
  normalized_email text := lower(trim(p_email));
  invitation public.vf_user_invitations;
  reserved_adm_count integer;
begin
  select * into actor
  from public.vf_users
  where auth_user_id = (select auth.uid()) and status = 'active'
  limit 1;

  if actor.id is null or actor.access_role = 'eleitor' then
    raise exception 'Acesso negado';
  end if;

  if normalized_email = '' or position('@' in normalized_email) < 2 then
    raise exception 'E-mail inválido';
  end if;
  if trim(coalesce(p_name,'')) = '' then
    raise exception 'Nome obrigatório';
  end if;
  if exists (select 1 from public.vf_users where lower(trim(email)) = normalized_email) then
    raise exception 'Este e-mail já possui conta VotoForte';
  end if;

  if actor.access_role = 'adm' then
    target_role := coalesce(p_access_role, 'master');
    if target_role not in ('adm','master','lideranca','liderado','eleitor') then
      raise exception 'Perfil de destino inválido';
    end if;

    if target_role in ('adm','master') then
      target_parent_id := actor.id;
    else
      target_parent_id := p_parent_user_id;
      if target_parent_id is null then raise exception 'Informe o superior imediato'; end if;
    end if;
  else
    target_role := private.vf_child_access_role(actor.access_role);
    if target_role is null then raise exception 'Seu perfil não pode criar subordinados'; end if;
    if p_access_role is not null and p_access_role is distinct from target_role then
      raise exception 'Seu perfil só pode convidar o nível imediatamente abaixo';
    end if;
    target_parent_id := actor.id;
  end if;

  select * into parent_user
  from public.vf_users
  where id = target_parent_id and status = 'active';

  if parent_user.id is null then raise exception 'Superior inválido ou inativo'; end if;
  if actor.access_role <> 'adm' and parent_user.id <> actor.id then
    raise exception 'Você só pode criar subordinados diretos';
  end if;
  if actor.access_role = 'adm'
     and parent_user.id not in (select user_id from private.vf_visible_user_ids()) then
    raise exception 'Superior fora do seu escopo';
  end if;

  if (target_role = 'adm' and parent_user.access_role <> 'adm')
    or (target_role = 'master' and parent_user.access_role <> 'adm')
    or (target_role = 'lideranca' and parent_user.access_role <> 'master')
    or (target_role = 'liderado' and parent_user.access_role <> 'lideranca')
    or (target_role = 'eleitor' and parent_user.access_role <> 'liderado') then
    raise exception 'Hierarquia incompatível';
  end if;

  update public.vf_user_invitations
  set status = 'expired'
  where status = 'pending' and expires_at <= now();

  if target_role = 'adm' then
    perform pg_catalog.pg_advisory_xact_lock(9420021::bigint);

    select (
      (select count(*) from public.vf_users u
       where u.access_role = 'adm' and u.status = 'active')
      +
      (select count(*) from public.vf_user_invitations i
       where i.access_role = 'adm'
         and i.status = 'pending'
         and i.expires_at > now())
    )::integer
    into reserved_adm_count;

    if reserved_adm_count >= 2 then
      raise exception 'O limite de 2 ADMs já está preenchido ou reservado por convite pendente.';
    end if;
  end if;

  if exists (
    select 1 from public.vf_user_invitations
    where lower(email) = normalized_email and status = 'pending'
  ) then
    raise exception 'Já existe um convite pendente para este e-mail';
  end if;

  insert into public.vf_user_invitations(
    email,name,access_role,parent_user_id,invited_by_user_id
  ) values (
    normalized_email,trim(p_name),target_role,parent_user.id,actor.id
  ) returning * into invitation;

  insert into public.vf_audit_logs(actor_id,actor_email,action,detail)
  values(
    actor.auth_user_id,
    actor.email,
    case when invitation.access_role = 'adm' then 'Convite de ADM criado' else 'Convite de usuário criado' end,
    format('%s <%s> · %s · responsável #%s', invitation.name, invitation.email, invitation.access_role, invitation.parent_user_id)
  );

  return jsonb_build_object(
    'id',invitation.id,
    'email',invitation.email,
    'name',invitation.name,
    'accessRole',invitation.access_role,
    'parentUserId',invitation.parent_user_id,
    'expiresAt',invitation.expires_at
  );
end;
$function$;

create or replace function private.vf_claim_user_invitation_internal()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  uid uuid := (select auth.uid());
  auth_email text;
  confirmed_at timestamptz;
  inv public.vf_user_invitations;
  legacy_role text;
  created_user public.vf_users;
  active_adm_count integer;
begin
  if uid is null then raise exception 'Não autenticado'; end if;

  select lower(trim(email)), email_confirmed_at
  into auth_email, confirmed_at
  from auth.users
  where id = uid;

  if auth_email is null then raise exception 'Conta Auth não encontrada'; end if;
  if confirmed_at is null then raise exception 'Confirme seu e-mail antes de ativar a conta'; end if;

  if exists (select 1 from public.vf_users where auth_user_id = uid) then
    select * into created_user from public.vf_users where auth_user_id = uid;
    return jsonb_build_object('id',created_user.id,'email',created_user.email,'name',created_user.name,'accessRole',created_user.access_role);
  end if;

  update public.vf_user_invitations
  set status = 'expired'
  where status = 'pending' and expires_at <= now();

  select * into inv
  from public.vf_user_invitations
  where lower(email) = auth_email and status = 'pending'
  order by created_at desc
  limit 1
  for update;

  if inv.id is null then raise exception 'Esta conta não possui convite VotoForte ativo'; end if;

  if inv.access_role = 'adm' then
    perform pg_catalog.pg_advisory_xact_lock(9420021::bigint);
    select count(*)::integer into active_adm_count
    from public.vf_users
    where access_role = 'adm' and status = 'active';

    if active_adm_count >= 2 then
      raise exception 'O limite de 2 ADMs ativos já foi atingido.';
    end if;
  end if;

  legacy_role := case inv.access_role
    when 'adm' then 'master'
    when 'master' then 'master'
    when 'lideranca' then 'lider'
    else 'liderado'
  end;

  insert into public.vf_users(
    auth_user_id,email,name,role,access_role,status,parent_user_id
  ) values (
    uid,auth_email,inv.name,legacy_role,inv.access_role,'active',
    case when inv.access_role = 'adm' then null else inv.parent_user_id end
  ) returning * into created_user;

  update public.vf_user_invitations
  set status = 'claimed', claimed_auth_user_id = uid, claimed_at = now()
  where id = inv.id;

  insert into public.vf_audit_logs(actor_id,actor_email,action,detail)
  values(
    uid,
    auth_email,
    case when inv.access_role = 'adm' then 'Convite de ADM aceito' else 'Convite de usuário aceito' end,
    case when inv.access_role = 'adm'
      then format('adm · convidado pelo ADM #%s', inv.invited_by_user_id)
      else format('%s · superior #%s', inv.access_role, inv.parent_user_id)
    end
  );

  return jsonb_build_object('id',created_user.id,'email',created_user.email,'name',created_user.name,'accessRole',created_user.access_role);
end;
$function$;

create or replace function private.vf_set_user_status_internal(p_user_id bigint, p_status text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  actor public.vf_users;
  target public.vf_users;
  expected_child text;
  remaining_active_adms integer;
begin
  if p_status not in ('active','blocked') then raise exception 'Status inválido'; end if;

  select * into actor
  from public.vf_users
  where auth_user_id = (select auth.uid()) and status = 'active'
  limit 1;
  if actor.id is null then raise exception 'Acesso negado'; end if;

  select * into target from public.vf_users where id = p_user_id;
  if target.id is null then raise exception 'Usuário não encontrado'; end if;
  if target.id = actor.id then raise exception 'Você não pode alterar o status do próprio acesso'; end if;

  if target.access_role = 'adm' then
    if actor.access_role <> 'adm' then raise exception 'Somente um ADM pode alterar outro ADM'; end if;
    perform pg_catalog.pg_advisory_xact_lock(9420021::bigint);

    if p_status = 'blocked' and target.status = 'active' then
      select count(*)::integer into remaining_active_adms
      from public.vf_users
      where access_role = 'adm' and status = 'active' and id <> target.id;

      if remaining_active_adms < 1 then
        raise exception 'O sistema deve manter pelo menos 1 ADM ativo.';
      end if;
    end if;
  elsif actor.access_role <> 'adm' then
    expected_child := private.vf_child_access_role(actor.access_role);
    if expected_child is null
       or target.parent_user_id <> actor.id
       or target.access_role <> expected_child then
      raise exception 'Você só pode bloquear ou reativar subordinados diretos';
    end if;
  end if;

  update public.vf_users set status = p_status where id = target.id;

  insert into public.vf_audit_logs(actor_id,actor_email,action,detail)
  values (
    actor.auth_user_id,
    actor.email,
    case
      when target.access_role = 'adm' and p_status = 'blocked' then 'ADM bloqueado'
      when target.access_role = 'adm' and p_status = 'active' then 'ADM reativado'
      when p_status = 'blocked' then 'Usuário bloqueado'
      else 'Usuário reativado'
    end,
    format('%s <%s> · %s', target.name, target.email, target.access_role)
  );

  return jsonb_build_object('id',target.id,'status',p_status);
end;
$function$;

create or replace function public.vf_access_administration_options()
returns jsonb
language plpgsql
stable
set search_path to ''
as $function$
declare
  actor public.vf_users%rowtype;
  next_role text;
  role_options jsonb := '[]'::jsonb;
  parent_options jsonb := '[]'::jsonb;
  active_adm_count integer := 0;
  pending_adm_count integer := 0;
  adm_slots_available integer := 0;
begin
  select u.* into actor
  from public.vf_users u
  where u.auth_user_id = (select auth.uid()) and u.status = 'active'
  limit 1;

  if actor.id is null then
    raise exception 'Usuário sem acesso ativo.' using errcode = '42501';
  end if;

  select count(*)::integer into active_adm_count
  from public.vf_users u
  where u.access_role = 'adm' and u.status = 'active';

  select count(*)::integer into pending_adm_count
  from public.vf_user_invitations i
  where i.access_role = 'adm' and i.status = 'pending' and i.expires_at > now();

  adm_slots_available := greatest(0, 2 - active_adm_count - pending_adm_count);

  if actor.access_role = 'adm' then
    role_options := jsonb_build_array(
      jsonb_build_object('value','master','label','Master','parentRole','adm','parentRequired',false),
      jsonb_build_object('value','lideranca','label','Liderança','parentRole','master','parentRequired',true),
      jsonb_build_object('value','liderado','label','Liderado','parentRole','lideranca','parentRequired',true),
      jsonb_build_object('value','eleitor','label','Eleitor','parentRole','liderado','parentRequired',true)
    );

    if adm_slots_available > 0 then
      role_options := jsonb_build_array(
        jsonb_build_object('value','adm','label',format('ADM (%s de 2 ativos)',active_adm_count),'parentRole','adm','parentRequired',false)
      ) || role_options;
    end if;

    select coalesce(jsonb_agg(x order by x->>'forRole', x->>'name'), '[]'::jsonb)
    into parent_options
    from (
      select jsonb_build_object('forRole','master','id',actor.id,'name',actor.name,'email',actor.email,'accessRole',actor.access_role) as x
      union all
      select jsonb_build_object(
        'forRole', case u.access_role when 'master' then 'lideranca' when 'lideranca' then 'liderado' when 'liderado' then 'eleitor' end,
        'id',u.id,'name',u.name,'email',u.email,'accessRole',u.access_role
      )
      from public.vf_users u
      where u.status = 'active' and u.access_role in ('master','lideranca','liderado')
    ) q;
  elsif actor.access_role in ('master','lideranca','liderado') then
    next_role := case actor.access_role when 'master' then 'lideranca' when 'lideranca' then 'liderado' when 'liderado' then 'eleitor' end;

    role_options := jsonb_build_array(
      jsonb_build_object(
        'value',next_role,
        'label',case next_role when 'lideranca' then 'Liderança' when 'liderado' then 'Liderado' when 'eleitor' then 'Eleitor' end,
        'parentRole',actor.access_role,
        'parentRequired',false
      )
    );

    parent_options := jsonb_build_array(
      jsonb_build_object('forRole',next_role,'id',actor.id,'name',actor.name,'email',actor.email,'accessRole',actor.access_role)
    );
  end if;

  return jsonb_build_object(
    'currentUser', jsonb_build_object('id',actor.id,'name',actor.name,'email',actor.email,'accessRole',actor.access_role),
    'canOpenAdministration', actor.access_role in ('adm','master','lideranca','liderado'),
    'canCreateAccess', actor.access_role in ('adm','master','lideranca','liderado'),
    'admLimit', 2,
    'activeAdmCount', active_adm_count,
    'pendingAdmCount', pending_adm_count,
    'admSlotsAvailable', adm_slots_available,
    'roleOptions', role_options,
    'parentOptions', parent_options,
    'sections', case when actor.access_role = 'adm' then
      jsonb_build_array(
        jsonb_build_object('key','users','label','Gerenciar acessos'),
        jsonb_build_object('key','create','label','Cadastrar acesso'),
        jsonb_build_object('key','invitations','label','Convites'),
        jsonb_build_object('key','audit','label','Auditoria')
      )
    else
      jsonb_build_array(
        jsonb_build_object('key','users','label','Minha equipe'),
        jsonb_build_object('key','create','label','Cadastrar acesso'),
        jsonb_build_object('key','invitations','label','Convites')
      )
    end
  );
end;
$function$;
