create or replace function private.vf_pending_adm_invitation_count()
returns integer
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  actor_role text;
  pending_count integer;
begin
  select u.access_role
  into actor_role
  from public.vf_users u
  where u.auth_user_id = (select auth.uid())
    and u.status = 'active'
  limit 1;

  if actor_role is null then
    raise exception 'Acesso negado';
  end if;

  if actor_role <> 'adm' then
    return 0;
  end if;

  select count(*)::integer
  into pending_count
  from public.vf_user_invitations i
  where i.access_role = 'adm'
    and i.status = 'pending'
    and i.expires_at > now();

  return pending_count;
end;
$function$;

revoke all on function private.vf_pending_adm_invitation_count() from public;
revoke all on function private.vf_pending_adm_invitation_count() from anon;
grant execute on function private.vf_pending_adm_invitation_count() to authenticated;

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
  where u.auth_user_id = (select auth.uid())
    and u.status = 'active'
  limit 1;

  if actor.id is null then
    raise exception 'Usuário sem acesso ativo.' using errcode = '42501';
  end if;

  select count(*)::integer
  into active_adm_count
  from public.vf_users u
  where u.access_role = 'adm' and u.status = 'active';

  pending_adm_count := private.vf_pending_adm_invitation_count();
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
        jsonb_build_object(
          'value','adm',
          'label',format('ADM (%s de 2 ativos)',active_adm_count),
          'parentRole','adm',
          'parentRequired',false
        )
      ) || role_options;
    end if;

    select coalesce(jsonb_agg(x order by x->>'forRole', x->>'name'), '[]'::jsonb)
      into parent_options
    from (
      select jsonb_build_object(
        'forRole','master',
        'id',actor.id,
        'name',actor.name,
        'email',actor.email,
        'accessRole',actor.access_role
      ) as x
      union all
      select jsonb_build_object(
        'forRole',
          case u.access_role
            when 'master' then 'lideranca'
            when 'lideranca' then 'liderado'
            when 'liderado' then 'eleitor'
          end,
        'id',u.id,
        'name',u.name,
        'email',u.email,
        'accessRole',u.access_role
      )
      from public.vf_users u
      where u.status = 'active'
        and u.access_role in ('master','lideranca','liderado')
    ) q;
  elsif actor.access_role in ('master','lideranca','liderado') then
    next_role := case actor.access_role
      when 'master' then 'lideranca'
      when 'lideranca' then 'liderado'
      when 'liderado' then 'eleitor'
    end;

    role_options := jsonb_build_array(
      jsonb_build_object(
        'value',next_role,
        'label',case next_role
          when 'lideranca' then 'Liderança'
          when 'liderado' then 'Liderado'
          when 'eleitor' then 'Eleitor'
        end,
        'parentRole',actor.access_role,
        'parentRequired',false
      )
    );

    parent_options := jsonb_build_array(
      jsonb_build_object(
        'forRole',next_role,
        'id',actor.id,
        'name',actor.name,
        'email',actor.email,
        'accessRole',actor.access_role
      )
    );
  end if;

  return jsonb_build_object(
    'currentUser', jsonb_build_object(
      'id',actor.id,
      'name',actor.name,
      'email',actor.email,
      'accessRole',actor.access_role
    ),
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