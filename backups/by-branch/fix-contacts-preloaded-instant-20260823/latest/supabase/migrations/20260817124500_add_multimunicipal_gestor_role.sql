-- Gestor Multimunicipal
-- ADM > Gestor > Master > Lideranca > Liderado > Eleitor.
-- O Gestor opera apenas nos municipios explicitamente atribuidos pelo ADM,
-- nao enxerga contas ADM e nao recebe poderes de backup/seguranca global.

alter table public.vf_users
  drop constraint if exists vf_users_access_role_check;
alter table public.vf_users
  add constraint vf_users_access_role_check
  check (access_role = any (array['adm','gestor','master','lideranca','liderado','eleitor']::text[]));

alter table public.vf_user_municipalities
  drop constraint if exists vf_user_municipalities_access_role_check;
alter table public.vf_user_municipalities
  add constraint vf_user_municipalities_access_role_check
  check (access_role = any (array['adm','gestor','master','lideranca','liderado','eleitor']::text[]));

alter table public.vf_user_invitations
  drop constraint if exists vf_user_invitations_access_role_check;
alter table public.vf_user_invitations
  add constraint vf_user_invitations_access_role_check
  check (access_role = any (array['adm','gestor','master','lideranca','liderado','eleitor']::text[]));

create or replace function private.vf_enforce_single_non_adm_municipality()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare
  user_access_role text;
  has_other boolean;
begin
  select access_role into user_access_role
  from public.vf_users
  where id = new.user_id;

  if user_access_role is null then
    raise exception 'Usuario invalido';
  end if;

  if user_access_role not in ('adm','gestor') and new.status='active' then
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
      raise exception 'Este usuario ja possui municipio de acesso definido';
    end if;
  end if;

  return new;
end;
$function$;

create or replace function private.vf_child_access_role(p_role text)
returns text
language sql
immutable
set search_path to ''
as $function$
  select case p_role
    when 'adm' then 'gestor'
    when 'gestor' then 'master'
    when 'master' then 'lideranca'
    when 'lideranca' then 'liderado'
    when 'liderado' then 'eleitor'
    else null
  end;
$function$;

create or replace function private.vf_visible_user_ids()
returns table(user_id bigint)
language sql
stable security definer
set search_path to ''
as $function$
  with recursive me as (
    select
      u.id,
      u.access_role,
      private.vf_current_municipality_id() as municipality_id
    from public.vf_users u
    where u.auth_user_id=(select auth.uid())
      and u.status='active'
    limit 1
  ), tree as (
    select u.id, array[u.id]::bigint[] as path
    from public.vf_users u
    join me on me.id=u.id

    union all

    select child.id, tree.path || child.id
    from public.vf_users child
    join tree on child.parent_user_id=tree.id
    where not child.id=any(tree.path)
  )
  select um.user_id
  from me
  join public.vf_user_municipalities um
    on um.municipality_id=me.municipality_id
   and um.status='active'
  join public.vf_users target on target.id=um.user_id
  where me.access_role='adm'

  union

  select um.user_id
  from me
  join public.vf_user_municipalities um
    on um.municipality_id=me.municipality_id
   and um.status='active'
  join public.vf_users target on target.id=um.user_id
  where me.access_role='gestor'
    and target.access_role <> 'adm'

  union

  select tree.id
  from tree
  join me on true
  join public.vf_user_municipalities um
    on um.user_id=tree.id
   and um.municipality_id=me.municipality_id
   and um.status='active'
  where me.access_role not in ('adm','gestor');
$function$;

create or replace function private.vf_can_manage_record(p_record_id bigint)
returns boolean
language sql
stable security definer
set search_path to ''
as $function$
  select exists (
    select 1
    from public.vf_owned_records r
    join public.vf_users me
      on me.auth_user_id=(select auth.uid())
     and me.status='active'
    where r.id=p_record_id
      and r.municipality_id=private.vf_current_municipality_id()
      and me.access_role in ('adm','gestor','master','lideranca','liderado')
      and r.assigned_user_id in (select v.user_id from private.vf_visible_user_ids() v)
  );
$function$;

create or replace function private.vf_municipality_context_internal()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  actor public.vf_users;
  current_id bigint;
  items jsonb;
begin
  select * into actor
  from public.vf_users
  where auth_user_id=(select auth.uid()) and status='active'
  limit 1;

  if actor.id is null then
    raise exception 'Acesso negado' using errcode='42501';
  end if;

  current_id:=private.vf_current_municipality_id();

  if actor.access_role='adm' then
    insert into public.vf_user_municipalities(user_id,municipality_id,access_role,status,is_default,parent_user_id)
    select actor.id,m.id,'adm','active',m.id=current_id,null
    from public.vf_municipalities m
    where m.status='active'
    on conflict(user_id,municipality_id)
    do update set access_role='adm',status='active';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',m.id,
    'name',m.name,
    'state',m.state,
    'ibgeCode',m.ibge_code,
    'accessRole',um.access_role,
    'isDefault',um.is_default
  ) order by m.name),'[]'::jsonb)
  into items
  from public.vf_user_municipalities um
  join public.vf_municipalities m on m.id=um.municipality_id
  where um.user_id=actor.id
    and um.status='active'
    and m.status='active';

  return jsonb_build_object(
    'currentMunicipalityId',current_id,
    'municipalities',items,
    'isGeneralAdm',actor.access_role='adm',
    'isGestor',actor.access_role='gestor',
    'canSwitchMunicipality',actor.access_role in ('adm','gestor') and jsonb_array_length(items)>1
  );
end;
$function$;

create or replace function private.vf_set_default_municipality_internal(p_municipality_id bigint)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  actor public.vf_users;
begin
  select * into actor
  from public.vf_users
  where auth_user_id=(select auth.uid()) and status='active'
  limit 1;

  if actor.id is null then
    raise exception 'Acesso negado' using errcode='42501';
  end if;

  if actor.access_role not in ('adm','gestor') then
    raise exception 'Seu perfil nao pode trocar de municipio';
  end if;

  if not exists(
    select 1 from public.vf_municipalities
    where id=p_municipality_id and status='active'
  ) then
    raise exception 'Municipio invalido';
  end if;

  if actor.access_role='gestor' then
    if not exists(
      select 1
      from public.vf_user_municipalities um
      where um.user_id=actor.id
        and um.municipality_id=p_municipality_id
        and um.status='active'
        and um.access_role='gestor'
    ) then
      raise exception 'Municipio fora do seu escopo autorizado' using errcode='42501';
    end if;
  else
    insert into public.vf_user_municipalities(user_id,municipality_id,access_role,status,is_default,parent_user_id)
    values(actor.id,p_municipality_id,'adm','active',false,null)
    on conflict(user_id,municipality_id)
    do update set access_role='adm',status='active';
  end if;

  update public.vf_user_municipalities
  set is_default=false
  where user_id=actor.id;

  update public.vf_user_municipalities
  set is_default=true
  where user_id=actor.id
    and municipality_id=p_municipality_id
    and status='active';

  return private.vf_municipality_context_internal();
end;
$function$;

create or replace function private.vf_create_user_invitation_internal(
  p_email text,
  p_name text,
  p_access_role text default null,
  p_parent_user_id bigint default null
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
  current_municipality_id bigint := private.vf_current_municipality_id();
begin
  select * into actor
  from public.vf_users
  where auth_user_id=(select auth.uid()) and status='active'
  limit 1;

  if actor.id is null or actor.access_role='eleitor' then
    raise exception 'Acesso negado';
  end if;

  if normalized_email='' or position('@' in normalized_email)<2 then
    raise exception 'E-mail invalido';
  end if;
  if trim(coalesce(p_name,''))='' then
    raise exception 'Nome obrigatorio';
  end if;
  if exists(select 1 from public.vf_users where lower(trim(email))=normalized_email) then
    raise exception 'Este e-mail ja possui conta VotoForte';
  end if;

  if actor.access_role='adm' then
    target_role:=coalesce(p_access_role,'master');
    if target_role not in ('adm','gestor','master','lideranca','liderado','eleitor') then
      raise exception 'Perfil de destino invalido';
    end if;

    if target_role in ('adm','gestor') then
      target_parent_id:=actor.id;
    elsif target_role='master' then
      target_parent_id:=coalesce(p_parent_user_id,actor.id);
    else
      target_parent_id:=p_parent_user_id;
      if target_parent_id is null then
        raise exception 'Informe o superior imediato';
      end if;
    end if;
  elsif actor.access_role='gestor' then
    target_role:=coalesce(p_access_role,'master');
    if target_role not in ('master','lideranca','liderado','eleitor') then
      raise exception 'O Gestor pode criar apenas Master e niveis operacionais abaixo';
    end if;
    if target_role='master' then
      target_parent_id:=actor.id;
    else
      target_parent_id:=p_parent_user_id;
      if target_parent_id is null then
        raise exception 'Informe o superior imediato';
      end if;
    end if;
  else
    target_role:=private.vf_child_access_role(actor.access_role);
    if target_role is null then
      raise exception 'Seu perfil nao pode criar subordinados';
    end if;
    if p_access_role is not null and p_access_role is distinct from target_role then
      raise exception 'Seu perfil so pode convidar o nivel imediatamente abaixo';
    end if;
    target_parent_id:=actor.id;
  end if;

  select * into parent_user
  from public.vf_users
  where id=target_parent_id and status='active';

  if parent_user.id is null then
    raise exception 'Superior invalido ou inativo';
  end if;

  if actor.access_role not in ('adm','gestor') and parent_user.id<>actor.id then
    raise exception 'Voce so pode criar subordinados diretos';
  end if;

  if actor.access_role in ('adm','gestor')
     and parent_user.id not in (select user_id from private.vf_visible_user_ids()) then
    raise exception 'Superior fora do seu escopo';
  end if;

  if target_role='adm' and parent_user.access_role<>'adm' then
    raise exception 'Hierarquia incompativel';
  elsif target_role='gestor' and parent_user.access_role<>'adm' then
    raise exception 'Hierarquia incompativel';
  elsif target_role='master' and parent_user.access_role not in ('adm','gestor') then
    raise exception 'Hierarquia incompativel';
  elsif target_role='lideranca' and parent_user.access_role<>'master' then
    raise exception 'Hierarquia incompativel';
  elsif target_role='liderado' and parent_user.access_role<>'lideranca' then
    raise exception 'Hierarquia incompativel';
  elsif target_role='eleitor' and parent_user.access_role<>'liderado' then
    raise exception 'Hierarquia incompativel';
  end if;

  update public.vf_user_invitations
  set status='expired'
  where status='pending' and expires_at<=now();

  if target_role='adm' then
    perform pg_catalog.pg_advisory_xact_lock(9420021::bigint);
    select (
      (select count(*) from public.vf_users u where u.access_role='adm' and u.status='active')
      +
      (select count(*) from public.vf_user_invitations i where i.access_role='adm' and i.status='pending' and i.expires_at>now())
    )::integer into reserved_adm_count;

    if reserved_adm_count>=2 then
      raise exception 'O limite de 2 ADMs ja esta preenchido ou reservado por convite pendente.';
    end if;
  end if;

  if exists(
    select 1 from public.vf_user_invitations
    where lower(email)=normalized_email and status='pending'
  ) then
    raise exception 'Ja existe um convite pendente para este e-mail';
  end if;

  insert into public.vf_user_invitations(
    email,name,access_role,parent_user_id,invited_by_user_id,municipality_id
  ) values (
    normalized_email,trim(p_name),target_role,parent_user.id,actor.id,current_municipality_id
  ) returning * into invitation;

  insert into public.vf_audit_logs(actor_id,actor_email,action,detail,municipality_id)
  values(
    actor.auth_user_id,
    actor.email,
    case
      when invitation.access_role='adm' then 'Convite de ADM criado'
      when invitation.access_role='gestor' then 'Convite de Gestor criado'
      else 'Convite de usuario criado'
    end,
    format('%s <%s> · %s · responsavel #%s',invitation.name,invitation.email,invitation.access_role,invitation.parent_user_id),
    current_municipality_id
  );

  return jsonb_build_object(
    'id',invitation.id,
    'email',invitation.email,
    'name',invitation.name,
    'accessRole',invitation.access_role,
    'parentUserId',invitation.parent_user_id,
    'municipalityId',invitation.municipality_id,
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
  if uid is null then raise exception 'Nao autenticado'; end if;
  select lower(trim(email)),email_confirmed_at into auth_email,confirmed_at
  from auth.users where id=uid;
  if auth_email is null then raise exception 'Conta Auth nao encontrada'; end if;
  if confirmed_at is null then raise exception 'Confirme seu e-mail antes de ativar a conta'; end if;

  if exists(select 1 from public.vf_users where auth_user_id=uid) then
    select * into created_user from public.vf_users where auth_user_id=uid;
    return jsonb_build_object('id',created_user.id,'email',created_user.email,'name',created_user.name,'accessRole',created_user.access_role);
  end if;

  update public.vf_user_invitations
  set status='expired'
  where status='pending' and expires_at<=now();

  select * into inv
  from public.vf_user_invitations
  where lower(email)=auth_email and status='pending'
  order by created_at desc
  limit 1 for update;

  if inv.id is null then raise exception 'Esta conta nao possui convite VotoForte ativo'; end if;

  if inv.access_role='adm' then
    perform pg_catalog.pg_advisory_xact_lock(9420021::bigint);
    select count(*)::integer into active_adm_count
    from public.vf_users where access_role='adm' and status='active';
    if active_adm_count>=2 then raise exception 'O limite de 2 ADMs ativos ja foi atingido.'; end if;
  end if;

  legacy_role:=case inv.access_role
    when 'adm' then 'master'
    when 'gestor' then 'gestor'
    when 'master' then 'master'
    when 'lideranca' then 'lider'
    else 'liderado'
  end;

  insert into public.vf_users(auth_user_id,email,name,role,access_role,status,parent_user_id)
  values(
    uid,
    auth_email,
    inv.name,
    legacy_role,
    inv.access_role,
    'active',
    case when inv.access_role='adm' then null else inv.parent_user_id end
  )
  returning * into created_user;

  insert into public.vf_user_municipalities(user_id,municipality_id,access_role,status,is_default)
  values(created_user.id,coalesce(inv.municipality_id,private.vf_default_municipality_id()),inv.access_role,'active',true)
  on conflict(user_id,municipality_id)
  do update set access_role=excluded.access_role,status='active',is_default=true;

  update public.vf_user_invitations
  set status='claimed',claimed_auth_user_id=uid,claimed_at=now()
  where id=inv.id;

  insert into public.vf_audit_logs(actor_id,actor_email,action,detail,municipality_id)
  values(
    uid,
    auth_email,
    case
      when inv.access_role='adm' then 'Convite de ADM aceito'
      when inv.access_role='gestor' then 'Convite de Gestor aceito'
      else 'Convite de usuario aceito'
    end,
    format('%s · superior #%s',inv.access_role,inv.parent_user_id),
    coalesce(inv.municipality_id,private.vf_default_municipality_id())
  );

  return jsonb_build_object(
    'id',created_user.id,
    'email',created_user.email,
    'name',created_user.name,
    'accessRole',created_user.access_role,
    'municipalityId',coalesce(inv.municipality_id,private.vf_default_municipality_id())
  );
end;
$function$;

create or replace function private.vf_set_user_status_internal(p_user_id bigint,p_status text)
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
  if p_status not in ('active','blocked') then
    raise exception 'Status invalido';
  end if;

  select * into actor
  from public.vf_users
  where auth_user_id=(select auth.uid()) and status='active'
  limit 1;

  if actor.id is null then raise exception 'Acesso negado'; end if;

  select * into target from public.vf_users where id=p_user_id;
  if target.id is null then raise exception 'Usuario nao encontrado'; end if;
  if target.id=actor.id then raise exception 'Voce nao pode alterar o status do proprio acesso'; end if;

  if target.access_role='adm' then
    if actor.access_role<>'adm' then
      raise exception 'Somente um ADM pode alterar outro ADM';
    end if;

    perform pg_catalog.pg_advisory_xact_lock(9420021::bigint);
    if p_status='blocked' and target.status='active' then
      select count(*)::integer into remaining_active_adms
      from public.vf_users
      where access_role='adm' and status='active' and id<>target.id;
      if remaining_active_adms<1 then
        raise exception 'O sistema deve manter pelo menos 1 ADM ativo.';
      end if;
    end if;
  elsif actor.access_role='gestor' then
    if target.access_role in ('adm','gestor')
       or target.id not in (select user_id from private.vf_visible_user_ids()) then
      raise exception 'O Gestor so pode administrar Master e niveis operacionais do municipio atual';
    end if;
  elsif actor.access_role<>'adm' then
    expected_child:=private.vf_child_access_role(actor.access_role);
    if expected_child is null
       or target.parent_user_id<>actor.id
       or target.access_role<>expected_child then
      raise exception 'Voce so pode bloquear ou reativar subordinados diretos';
    end if;
  end if;

  update public.vf_users set status=p_status where id=target.id;

  insert into public.vf_audit_logs(actor_id,actor_email,action,detail,municipality_id)
  values(
    actor.auth_user_id,
    actor.email,
    case
      when target.access_role='adm' and p_status='blocked' then 'ADM bloqueado'
      when target.access_role='adm' and p_status='active' then 'ADM reativado'
      when target.access_role='gestor' and p_status='blocked' then 'Gestor bloqueado'
      when target.access_role='gestor' and p_status='active' then 'Gestor reativado'
      when p_status='blocked' then 'Usuario bloqueado'
      else 'Usuario reativado'
    end,
    format('%s <%s> · %s',target.name,target.email,target.access_role),
    private.vf_current_municipality_id()
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
  where u.auth_user_id=(select auth.uid()) and u.status='active'
  limit 1;

  if actor.id is null then
    raise exception 'Usuario sem acesso ativo.' using errcode='42501';
  end if;

  select count(*)::integer into active_adm_count
  from public.vf_users u
  where u.access_role='adm' and u.status='active';

  pending_adm_count:=private.vf_pending_adm_invitation_count();
  adm_slots_available:=greatest(0,2-active_adm_count-pending_adm_count);

  if actor.access_role='adm' then
    role_options:=jsonb_build_array(
      jsonb_build_object('value','gestor','label','Gestor','parentRole','adm','parentRequired',false),
      jsonb_build_object('value','master','label','Master','parentRole','gestor','parentRequired',true),
      jsonb_build_object('value','lideranca','label','Lideranca','parentRole','master','parentRequired',true),
      jsonb_build_object('value','liderado','label','Liderado','parentRole','lideranca','parentRequired',true),
      jsonb_build_object('value','eleitor','label','Eleitor','parentRole','liderado','parentRequired',true)
    );

    if adm_slots_available>0 then
      role_options:=jsonb_build_array(
        jsonb_build_object('value','adm','label',format('ADM (%s de 2 ativos)',active_adm_count),'parentRole','adm','parentRequired',false)
      ) || role_options;
    end if;

    select coalesce(jsonb_agg(x order by x->>'forRole',x->>'name'),'[]'::jsonb)
    into parent_options
    from (
      select jsonb_build_object('forRole','gestor','id',actor.id,'name',actor.name,'email',actor.email,'accessRole',actor.access_role) as x
      union all
      select jsonb_build_object('forRole','master','id',actor.id,'name',actor.name,'email',actor.email,'accessRole',actor.access_role)
      union all
      select jsonb_build_object('forRole','master','id',u.id,'name',u.name,'email',u.email,'accessRole',u.access_role)
      from public.vf_users u
      where u.status='active'
        and u.access_role='gestor'
        and u.id in (select v.user_id from private.vf_visible_user_ids() v)
      union all
      select jsonb_build_object(
        'forRole',case u.access_role when 'master' then 'lideranca' when 'lideranca' then 'liderado' when 'liderado' then 'eleitor' end,
        'id',u.id,'name',u.name,'email',u.email,'accessRole',u.access_role
      )
      from public.vf_users u
      where u.status='active'
        and u.access_role in ('master','lideranca','liderado')
        and u.id in (select v.user_id from private.vf_visible_user_ids() v)
    ) q;
  elsif actor.access_role='gestor' then
    role_options:=jsonb_build_array(
      jsonb_build_object('value','master','label','Master','parentRole','gestor','parentRequired',false),
      jsonb_build_object('value','lideranca','label','Lideranca','parentRole','master','parentRequired',true),
      jsonb_build_object('value','liderado','label','Liderado','parentRole','lideranca','parentRequired',true),
      jsonb_build_object('value','eleitor','label','Eleitor','parentRole','liderado','parentRequired',true)
    );

    select coalesce(jsonb_agg(x order by x->>'forRole',x->>'name'),'[]'::jsonb)
    into parent_options
    from (
      select jsonb_build_object('forRole','master','id',actor.id,'name',actor.name,'email',actor.email,'accessRole',actor.access_role) as x
      union all
      select jsonb_build_object(
        'forRole',case u.access_role when 'master' then 'lideranca' when 'lideranca' then 'liderado' when 'liderado' then 'eleitor' end,
        'id',u.id,'name',u.name,'email',u.email,'accessRole',u.access_role
      )
      from public.vf_users u
      where u.status='active'
        and u.access_role in ('master','lideranca','liderado')
        and u.id in (select v.user_id from private.vf_visible_user_ids() v)
    ) q;
  elsif actor.access_role in ('master','lideranca','liderado') then
    next_role:=case actor.access_role
      when 'master' then 'lideranca'
      when 'lideranca' then 'liderado'
      when 'liderado' then 'eleitor'
    end;

    role_options:=jsonb_build_array(
      jsonb_build_object(
        'value',next_role,
        'label',case next_role when 'lideranca' then 'Lideranca' when 'liderado' then 'Liderado' when 'eleitor' then 'Eleitor' end,
        'parentRole',actor.access_role,
        'parentRequired',false
      )
    );

    parent_options:=jsonb_build_array(
      jsonb_build_object('forRole',next_role,'id',actor.id,'name',actor.name,'email',actor.email,'accessRole',actor.access_role)
    );
  end if;

  return jsonb_build_object(
    'currentUser',jsonb_build_object('id',actor.id,'name',actor.name,'email',actor.email,'accessRole',actor.access_role),
    'canOpenAdministration',actor.access_role in ('adm','gestor','master','lideranca','liderado'),
    'canCreateAccess',actor.access_role in ('adm','gestor','master','lideranca','liderado'),
    'admLimit',2,
    'activeAdmCount',active_adm_count,
    'pendingAdmCount',pending_adm_count,
    'admSlotsAvailable',adm_slots_available,
    'roleOptions',role_options,
    'parentOptions',parent_options,
    'sections',case when actor.access_role in ('adm','gestor') then
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

create or replace function private.vf_set_gestor_municipalities_internal(
  p_user_id bigint,
  p_municipality_ids bigint[]
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  actor public.vf_users;
  target public.vf_users;
  selected_ids bigint[];
  default_id bigint;
  invalid_count integer;
begin
  select * into actor
  from public.vf_users
  where auth_user_id=(select auth.uid()) and status='active'
  limit 1;

  if actor.id is null or actor.access_role<>'adm' then
    raise exception 'Somente o ADM pode definir municipios de um Gestor' using errcode='42501';
  end if;

  select * into target
  from public.vf_users
  where id=p_user_id and status='active';

  if target.id is null or target.access_role<>'gestor' then
    raise exception 'Gestor invalido ou inativo';
  end if;

  select coalesce(array_agg(distinct x order by x),'{}'::bigint[])
  into selected_ids
  from unnest(coalesce(p_municipality_ids,'{}'::bigint[])) x
  where x is not null and x>0;

  if cardinality(selected_ids)=0 then
    raise exception 'Selecione pelo menos um municipio para o Gestor';
  end if;

  select count(*)::integer into invalid_count
  from unnest(selected_ids) x
  left join public.vf_municipalities m on m.id=x and m.status='active'
  where m.id is null;

  if invalid_count>0 then
    raise exception 'Um ou mais municipios selecionados estao inativos ou nao existem';
  end if;

  select um.municipality_id into default_id
  from public.vf_user_municipalities um
  where um.user_id=target.id
    and um.status='active'
    and um.is_default
    and um.municipality_id=any(selected_ids)
  limit 1;

  if default_id is null then
    select min(x) into default_id from unnest(selected_ids) x;
  end if;

  update public.vf_user_municipalities
  set status='blocked',is_default=false
  where user_id=target.id
    and not (municipality_id=any(selected_ids));

  insert into public.vf_user_municipalities(user_id,municipality_id,access_role,status,is_default,parent_user_id)
  select target.id,x,'gestor','active',x=default_id,actor.id
  from unnest(selected_ids) x
  on conflict(user_id,municipality_id)
  do update set
    access_role='gestor',
    status='active',
    is_default=excluded.is_default,
    parent_user_id=actor.id;

  update public.vf_user_municipalities
  set is_default=(municipality_id=default_id)
  where user_id=target.id and status='active';

  insert into public.vf_audit_logs(actor_id,actor_email,action,detail,municipality_id)
  values(
    actor.auth_user_id,
    actor.email,
    'Municipios do Gestor atualizados',
    format('%s <%s> · municipios=%s',target.name,target.email,array_to_string(selected_ids,',')),
    private.vf_current_municipality_id()
  );

  return jsonb_build_object(
    'id',target.id,
    'municipalityIds',to_jsonb(selected_ids),
    'defaultMunicipalityId',default_id
  );
end;
$function$;

create or replace function public.vf_set_gestor_municipalities(
  p_user_id bigint,
  p_municipality_ids bigint[]
)
returns jsonb
language sql
set search_path to ''
as $function$
  select private.vf_set_gestor_municipalities_internal(p_user_id,p_municipality_ids);
$function$;

revoke all on function public.vf_set_gestor_municipalities(bigint,bigint[]) from public, anon;
grant execute on function public.vf_set_gestor_municipalities(bigint,bigint[]) to authenticated;
