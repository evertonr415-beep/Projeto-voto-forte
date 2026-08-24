begin;

create index if not exists vf_signup_requests_reviewed_by_idx
  on public.vf_signup_requests(reviewed_by);

alter table public.vf_user_municipalities
  add column if not exists parent_user_id bigint references public.vf_users(id) on delete set null;

update public.vf_user_municipalities um
set parent_user_id = u.parent_user_id
from public.vf_users u
where u.id = um.user_id and um.parent_user_id is null;

create index if not exists vf_user_municipalities_parent_idx
  on public.vf_user_municipalities(parent_user_id);

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
  select * into actor
  from public.vf_users
  where auth_user_id=(select auth.uid()) and status='active'
  limit 1;
  if actor.id is null then raise exception 'Acesso negado' using errcode='42501'; end if;

  current_id := private.vf_current_municipality_id();

  if actor.access_role='adm' then
    insert into public.vf_user_municipalities(user_id,municipality_id,access_role,status,is_default,parent_user_id)
    select actor.id,m.id,'adm','active',m.id=current_id,null
    from public.vf_municipalities m
    where m.status='active'
    on conflict (user_id,municipality_id) do update set access_role='adm',status='active';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',m.id,'name',m.name,'state',m.state,'ibgeCode',m.ibge_code,
    'accessRole',um.access_role,'isDefault',um.is_default
  ) order by m.name),'[]'::jsonb)
  into items
  from public.vf_user_municipalities um
  join public.vf_municipalities m on m.id=um.municipality_id
  where um.user_id=actor.id and um.status='active' and m.status='active';

  return jsonb_build_object('currentMunicipalityId',current_id,'municipalities',items,'isGeneralAdm',actor.access_role='adm');
end;
$$;

create or replace function public.vf_municipality_context()
returns jsonb
language sql
set search_path=''
as $$ select private.vf_municipality_context_internal(); $$;
revoke all on function public.vf_municipality_context() from public;
grant execute on function public.vf_municipality_context() to authenticated;

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
  if not exists(select 1 from public.vf_municipalities where id=p_municipality_id and status='active') then raise exception 'Município inválido'; end if;

  if actor.access_role='adm' then
    insert into public.vf_user_municipalities(user_id,municipality_id,access_role,status,is_default,parent_user_id)
    values(actor.id,p_municipality_id,'adm','active',false,null)
    on conflict (user_id,municipality_id) do update set access_role='adm',status='active';
  elsif not exists(select 1 from public.vf_user_municipalities where user_id=actor.id and municipality_id=p_municipality_id and status='active') then
    raise exception 'Você não possui acesso a este município';
  end if;

  update public.vf_user_municipalities set is_default=false where user_id=actor.id;
  update public.vf_user_municipalities set is_default=true where user_id=actor.id and municipality_id=p_municipality_id and status='active';
  return private.vf_municipality_context_internal();
end;
$$;

create or replace function public.vf_set_default_municipality(p_municipality_id bigint)
returns jsonb
language sql
set search_path=''
as $$ select private.vf_set_default_municipality_internal(p_municipality_id); $$;
revoke all on function public.vf_set_default_municipality(bigint) from public;
grant execute on function public.vf_set_default_municipality(bigint) to authenticated;

create or replace function private.vf_municipality_overview_internal()
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
      'id',m.id,'name',m.name,'state',m.state,'status',m.status,
      'contacts',(select count(*) from public.vf_owned_records r where r.municipality_id=m.id and r.kind='contact'),
      'users',(select count(*) from public.vf_user_municipalities um where um.municipality_id=m.id and um.status='active'),
      'lastActivity',(select max(a.created_at) from public.vf_audit_logs a where a.municipality_id=m.id)
    ) order by m.name)
    from public.vf_municipalities m where m.status='active'
  ),'[]'::jsonb);
end;
$$;

create or replace function public.vf_municipality_overview()
returns jsonb
language sql
set search_path=''
as $$ select private.vf_municipality_overview_internal(); $$;
revoke all on function public.vf_municipality_overview() from public;
grant execute on function public.vf_municipality_overview() to authenticated;

commit;