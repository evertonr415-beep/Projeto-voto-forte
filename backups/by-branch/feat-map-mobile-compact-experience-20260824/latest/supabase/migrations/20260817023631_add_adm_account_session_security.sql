begin;

create or replace function private.vf_adm_account_sessions_internal()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  actor public.vf_users;
  current_session_id uuid;
  items jsonb;
begin
  select * into actor
  from public.vf_users
  where auth_user_id=(select auth.uid()) and status='active'
  limit 1;

  if actor.id is null or actor.access_role <> 'adm' then
    raise exception 'Acesso negado' using errcode='42501';
  end if;

  begin
    current_session_id := nullif(auth.jwt()->>'session_id','')::uuid;
  exception when others then
    current_session_id := null;
  end;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',s.id,
    'createdAt',s.created_at,
    'updatedAt',s.updated_at,
    'refreshedAt',s.refreshed_at,
    'notAfter',s.not_after,
    'userAgent',coalesce(s.user_agent,''),
    'ip',coalesce(host(s.ip),''),
    'aal',s.aal::text,
    'current',s.id=current_session_id
  ) order by (s.id=current_session_id) desc, coalesce(s.refreshed_at,s.updated_at::timestamp,s.created_at::timestamp) desc),'[]'::jsonb)
  into items
  from auth.sessions s
  where s.user_id=actor.auth_user_id
    and (s.not_after is null or s.not_after>now());

  return jsonb_build_object(
    'currentSessionId',current_session_id,
    'sessions',items
  );
end;
$$;

create or replace function public.vf_adm_account_sessions()
returns jsonb
language sql
set search_path=''
as $$
  select private.vf_adm_account_sessions_internal();
$$;

revoke all on function public.vf_adm_account_sessions() from public, anon;
grant execute on function public.vf_adm_account_sessions() to authenticated;

commit;
