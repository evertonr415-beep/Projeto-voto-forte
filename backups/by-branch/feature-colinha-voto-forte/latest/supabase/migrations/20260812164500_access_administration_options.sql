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
begin
  select u.* into actor
  from public.vf_users u
  where u.auth_user_id = (select auth.uid())
    and u.status = 'active'
  limit 1;

  if actor.id is null then
    raise exception 'Usuário sem acesso ativo.' using errcode = '42501';
  end if;

  if actor.access_role = 'adm' then
    role_options := jsonb_build_array(
      jsonb_build_object('value','master','label','Master','parentRole','adm','parentRequired',false),
      jsonb_build_object('value','lideranca','label','Liderança','parentRole','master','parentRequired',true),
      jsonb_build_object('value','liderado','label','Liderado','parentRole','lideranca','parentRequired',true),
      jsonb_build_object('value','eleitor','label','Eleitor','parentRole','liderado','parentRequired',true)
    );

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

revoke all on function public.vf_access_administration_options() from public;
revoke all on function public.vf_access_administration_options() from anon;
grant execute on function public.vf_access_administration_options() to authenticated;
