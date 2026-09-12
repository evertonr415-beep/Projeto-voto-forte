begin;

create or replace function private.vf_revoke_adm_account_session_internal(
  p_mode text,
  p_session_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  actor public.vf_users;
  current_session_id uuid;
  affected integer := 0;
  normalized_mode text := lower(trim(coalesce(p_mode,'')));
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

  if normalized_mode='single' then
    if p_session_id is null then
      raise exception 'Sessão inválida';
    end if;
    if p_session_id=current_session_id then
      raise exception 'Use a opção sair desta sessão para encerrar a sessão atual';
    end if;
    delete from auth.sessions
    where id=p_session_id and user_id=actor.auth_user_id;
    get diagnostics affected = row_count;
  elsif normalized_mode='others' then
    delete from auth.sessions
    where user_id=actor.auth_user_id
      and (current_session_id is null or id<>current_session_id);
    get diagnostics affected = row_count;
  elsif normalized_mode='all' then
    delete from auth.sessions
    where user_id=actor.auth_user_id;
    get diagnostics affected = row_count;
  else
    raise exception 'Modo de revogação inválido';
  end if;

  insert into public.vf_audit_logs(actor_id,actor_email,action,detail,municipality_id)
  values(
    actor.auth_user_id,
    actor.email,
    'Sessões da conta revogadas',
    format('modo=%s · sessões=%s',normalized_mode,affected),
    private.vf_current_municipality_id()
  );

  return jsonb_build_object('mode',normalized_mode,'revoked',affected,'currentSessionId',current_session_id);
end;
$$;

create or replace function public.vf_revoke_adm_account_session(
  p_mode text,
  p_session_id uuid default null
)
returns jsonb
language sql
set search_path=''
as $$
  select private.vf_revoke_adm_account_session_internal(p_mode,p_session_id);
$$;

revoke all on function public.vf_revoke_adm_account_session(text,uuid) from public, anon;
grant execute on function public.vf_revoke_adm_account_session(text,uuid) to authenticated;

commit;
