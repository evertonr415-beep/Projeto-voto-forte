begin;

create or replace function private.vf_current_municipality_id()
returns bigint
language sql
stable
set search_path=''
as $$
  select coalesce(
    (
      select um.municipality_id
      from public.vf_users u
      join public.vf_user_municipalities um on um.user_id=u.id
      where u.auth_user_id=(select auth.uid()) and u.status='active' and um.status='active'
      order by um.is_default desc, um.created_at
      limit 1
    ),
    private.vf_default_municipality_id()
  );
$$;

alter table public.vf_owned_records alter column municipality_id set default private.vf_current_municipality_id();
alter table public.vf_contact_exports alter column municipality_id set default private.vf_current_municipality_id();
alter table public.vf_audit_logs alter column municipality_id set default private.vf_current_municipality_id();
alter table public.vf_user_invitations alter column municipality_id set default private.vf_current_municipality_id();

create or replace function private.vf_claim_user_invitation_internal()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
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
  select lower(trim(email)), email_confirmed_at into auth_email,confirmed_at from auth.users where id=uid;
  if auth_email is null then raise exception 'Conta Auth não encontrada'; end if;
  if confirmed_at is null then raise exception 'Confirme seu e-mail antes de ativar a conta'; end if;

  if exists(select 1 from public.vf_users where auth_user_id=uid) then
    select * into created_user from public.vf_users where auth_user_id=uid;
    return jsonb_build_object('id',created_user.id,'email',created_user.email,'name',created_user.name,'accessRole',created_user.access_role);
  end if;

  update public.vf_user_invitations set status='expired' where status='pending' and expires_at<=now();
  select * into inv from public.vf_user_invitations where lower(email)=auth_email and status='pending' order by created_at desc limit 1 for update;
  if inv.id is null then raise exception 'Esta conta não possui convite VotoForte ativo'; end if;

  if inv.access_role='adm' then
    perform pg_catalog.pg_advisory_xact_lock(9420021::bigint);
    select count(*)::integer into active_adm_count from public.vf_users where access_role='adm' and status='active';
    if active_adm_count>=2 then raise exception 'O limite de 2 ADMs ativos já foi atingido.'; end if;
  end if;

  legacy_role:=case inv.access_role when 'adm' then 'master' when 'master' then 'master' when 'lideranca' then 'lider' else 'liderado' end;

  insert into public.vf_users(auth_user_id,email,name,role,access_role,status,parent_user_id)
  values(uid,auth_email,inv.name,legacy_role,inv.access_role,'active',case when inv.access_role='adm' then null else inv.parent_user_id end)
  returning * into created_user;

  insert into public.vf_user_municipalities(user_id,municipality_id,access_role,status,is_default)
  values(created_user.id,coalesce(inv.municipality_id,private.vf_default_municipality_id()),inv.access_role,'active',true)
  on conflict(user_id,municipality_id) do update set access_role=excluded.access_role,status='active',is_default=true;

  update public.vf_user_invitations set status='claimed',claimed_auth_user_id=uid,claimed_at=now() where id=inv.id;

  insert into public.vf_audit_logs(actor_id,actor_email,action,detail,municipality_id)
  values(uid,auth_email,case when inv.access_role='adm' then 'Convite de ADM aceito' else 'Convite de usuário aceito' end,
    format('%s · superior #%s',inv.access_role,inv.parent_user_id),coalesce(inv.municipality_id,private.vf_default_municipality_id()));

  return jsonb_build_object('id',created_user.id,'email',created_user.email,'name',created_user.name,'accessRole',created_user.access_role,'municipalityId',coalesce(inv.municipality_id,private.vf_default_municipality_id()));
end;
$$;

create or replace function private.vf_session_access_status_internal()
returns jsonb
language plpgsql
stable security definer
set search_path=''
as $$
declare
  uid uuid := (select auth.uid());
  auth_email text;
  email_confirmed_at timestamptz;
  profile public.vf_users;
  inv public.vf_user_invitations;
  req public.vf_signup_requests;
  state_code text;
  message_text text;
  suggested_action text;
begin
  if uid is null then raise exception 'Não autenticado' using errcode='42501'; end if;
  select lower(trim(u.email)),u.email_confirmed_at into auth_email,email_confirmed_at from auth.users u where u.id=uid;
  if auth_email is null then raise exception 'Conta Auth não encontrada' using errcode='42501'; end if;
  select * into profile from public.vf_users u where u.auth_user_id=uid limit 1;
  select * into inv from public.vf_user_invitations i where lower(trim(i.email))=auth_email and i.status='pending' and i.expires_at>now() order by i.created_at desc limit 1;
  select * into req from public.vf_signup_requests r where r.auth_user_id=uid order by r.requested_at desc limit 1;

  if profile.id is not null and profile.status='active' then state_code:='active';message_text:='Acesso Voto Forte liberado.';suggested_action:='enter_application';
  elsif profile.id is not null then state_code:='profile_inactive';message_text:='Seu perfil Voto Forte está inativo. Procure o ADM responsável.';suggested_action:='contact_adm';
  elsif email_confirmed_at is null then state_code:='email_unconfirmed';message_text:='Confirme seu e-mail antes de ativar o acesso ao Voto Forte.';suggested_action:='confirm_email';
  elsif inv.id is not null then state_code:='invitation_ready';message_text:='Existe um convite Voto Forte válido para esta conta. Ative o convite para concluir seu acesso.';suggested_action:='claim_invitation';
  elsif req.id is not null and req.status='pending' then state_code:='awaiting_adm_activation';message_text:=format('Solicitação para %s/%s enviada. Aguarde a aprovação do ADM.',req.municipality_name,req.state);suggested_action:='wait_for_adm';
  elsif req.id is not null and req.status='rejected' then state_code:='awaiting_adm_activation';message_text:='Sua solicitação municipal não foi aprovada. Procure o ADM responsável.';suggested_action:='contact_adm';
  else state_code:='awaiting_adm_activation';message_text:='Sua conta foi autenticada, mas ainda não foi habilitada no Voto Forte.';suggested_action:='wait_for_adm'; end if;

  return jsonb_build_object('state',state_code,'message',message_text,'suggestedAction',suggested_action,'canEnterApplication',state_code='active','canClaimInvitation',state_code='invitation_ready','requiresAdmReview',state_code in ('awaiting_adm_activation','profile_inactive'),'email',auth_email,'emailConfirmed',email_confirmed_at is not null,
    'signupRequest',case when req.id is null then null else jsonb_build_object('id',req.id,'municipalityName',req.municipality_name,'state',req.state,'status',req.status) end);
end;
$$;

commit;