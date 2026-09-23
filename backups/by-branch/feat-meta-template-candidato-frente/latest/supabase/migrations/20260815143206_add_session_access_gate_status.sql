create or replace function private.vf_session_access_status_internal()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  uid uuid := (select auth.uid());
  auth_email text;
  email_confirmed_at timestamptz;
  profile public.vf_users;
  inv public.vf_user_invitations;
  state_code text;
  message_text text;
  suggested_action text;
begin
  if uid is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;

  select lower(trim(u.email)), u.email_confirmed_at
  into auth_email, email_confirmed_at
  from auth.users u
  where u.id = uid;

  if auth_email is null then
    raise exception 'Conta Auth não encontrada' using errcode = '42501';
  end if;

  select * into profile
  from public.vf_users u
  where u.auth_user_id = uid
  limit 1;

  select * into inv
  from public.vf_user_invitations i
  where lower(trim(i.email)) = auth_email
    and i.status = 'pending'
    and i.expires_at > now()
  order by i.created_at desc
  limit 1;

  if profile.id is not null and profile.status = 'active' then
    state_code := 'active';
    message_text := 'Acesso Voto Forte liberado.';
    suggested_action := 'enter_application';
  elsif profile.id is not null then
    state_code := 'profile_inactive';
    message_text := 'Seu perfil Voto Forte está inativo. Procure o ADM responsável.';
    suggested_action := 'contact_adm';
  elsif email_confirmed_at is null then
    state_code := 'email_unconfirmed';
    message_text := 'Confirme seu e-mail antes de ativar o acesso ao Voto Forte.';
    suggested_action := 'confirm_email';
  elsif inv.id is not null then
    state_code := 'invitation_ready';
    message_text := 'Existe um convite Voto Forte válido para esta conta. Ative o convite para concluir seu acesso.';
    suggested_action := 'claim_invitation';
  else
    state_code := 'awaiting_adm_activation';
    message_text := 'Sua conta foi autenticada, mas ainda não foi habilitada no Voto Forte. Solicite a habilitação ao ADM.';
    suggested_action := 'wait_for_adm';
  end if;

  return jsonb_build_object(
    'state', state_code,
    'message', message_text,
    'suggestedAction', suggested_action,
    'canEnterApplication', state_code = 'active',
    'canClaimInvitation', state_code = 'invitation_ready',
    'requiresAdmReview', state_code in ('awaiting_adm_activation','profile_inactive'),
    'email', auth_email,
    'emailConfirmed', email_confirmed_at is not null,
    'profile', case when profile.id is null then null else jsonb_build_object(
      'id', profile.id,
      'name', profile.name,
      'email', profile.email,
      'accessRole', profile.access_role,
      'status', profile.status,
      'parentUserId', profile.parent_user_id
    ) end,
    'invitation', case when inv.id is null then null else jsonb_build_object(
      'id', inv.id,
      'name', inv.name,
      'accessRole', inv.access_role,
      'expiresAt', inv.expires_at
    ) end
  );
end;
$function$;

revoke execute on function private.vf_session_access_status_internal() from public, anon;
grant execute on function private.vf_session_access_status_internal() to authenticated, service_role;

create or replace function public.vf_session_access_status()
returns jsonb
language sql
stable
security invoker
set search_path to ''
as $function$
  select private.vf_session_access_status_internal();
$function$;

revoke execute on function public.vf_session_access_status() from public, anon;
grant execute on function public.vf_session_access_status() to authenticated, service_role;