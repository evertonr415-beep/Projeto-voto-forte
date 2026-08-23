create or replace function public.vf_validate_access_hierarchy()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare
  parent_access_role text;
  adm_count integer;
begin
  if new.access_role = 'adm' then
    new.parent_user_id := null;
    select count(*) into adm_count
    from public.vf_users
    where access_role = 'adm'
      and status = 'active'
      and id <> coalesce(new.id, -1);
    if new.status = 'active' and adm_count >= 2 then
      raise exception 'O sistema permite no máximo dois ADMs ativos.';
    end if;
    return new;
  end if;

  if new.parent_user_id is null then
    raise exception 'Usuários Master, Liderança, Liderado e Eleitor precisam de um superior.';
  end if;

  if new.parent_user_id = new.id then
    raise exception 'Um usuário não pode ser superior de si mesmo.';
  end if;

  select access_role into parent_access_role
  from public.vf_users
  where id = new.parent_user_id
    and status = 'active';

  if parent_access_role is null then
    raise exception 'Superior ativo não encontrado.';
  end if;

  if new.access_role = 'master' and parent_access_role <> 'adm' then
    raise exception 'Master deve estar vinculado ao ADM.';
  elsif new.access_role = 'lideranca' and parent_access_role <> 'master' then
    raise exception 'Liderança deve estar vinculada a um Master.';
  elsif new.access_role = 'liderado' and parent_access_role <> 'lideranca' then
    raise exception 'Liderado deve estar vinculado a uma Liderança.';
  elsif new.access_role = 'eleitor' and parent_access_role <> 'liderado' then
    raise exception 'Eleitor deve estar vinculado a um Liderado.';
  end if;

  return new;
end;
$function$;