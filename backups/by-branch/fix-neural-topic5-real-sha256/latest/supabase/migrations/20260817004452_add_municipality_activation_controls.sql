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
  master_count integer;
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
    return jsonb_build_object('id',municipality.id,'name',municipality.name,'state',municipality.state,'status','active');
  end if;

  if municipality.status<>'configuring' then
    raise exception 'Município não está em configuração';
  end if;

  select count(*)::integer into master_count
  from public.vf_user_municipalities um
  join public.vf_users u on u.id=um.user_id
  where um.municipality_id=municipality.id
    and um.access_role='master'
    and um.status='active'
    and u.status='active';

  if master_count <> 1 then
    raise exception 'Defina exatamente um Master ativo antes de liberar o município';
  end if;

  update public.vf_municipalities
  set status='active'
  where id=municipality.id;

  insert into public.vf_audit_logs(actor_id,actor_email,action,detail,municipality_id)
  values(actor.auth_user_id,actor.email,'Município ativado',format('%s/%s',municipality.name,municipality.state),municipality.id);

  return jsonb_build_object('id',municipality.id,'name',municipality.name,'state',municipality.state,'status','active');
end;
$$;

create or replace function public.vf_activate_municipality(p_municipality_id bigint)
returns jsonb
language sql
set search_path=''
as $$ select private.vf_activate_municipality_internal(p_municipality_id); $$;

revoke all on function public.vf_activate_municipality(bigint) from public, anon;
grant execute on function public.vf_activate_municipality(bigint) to authenticated;

commit;