-- O Gestor deve operar toda a base do municipio atual mesmo quando os registros
-- foram originalmente vinculados a uma conta ADM. Isso nao concede visibilidade
-- da linha de usuario ADM nem poderes administrativos sobre essa conta.

create or replace function private.vf_is_gestor()
returns boolean
language sql
stable security definer
set search_path to ''
as $function$
  select exists (
    select 1
    from public.vf_users u
    where u.auth_user_id=(select auth.uid())
      and u.status='active'
      and u.access_role='gestor'
  );
$function$;

create or replace function private.vf_can_view_assignment(
  p_assigned_user_id bigint,
  p_subject_auth_user_id uuid
)
returns boolean
language plpgsql
stable security definer
set search_path to ''
as $function$
declare
  me_role text;
  me_id bigint;
begin
  select u.id,u.access_role
  into me_id,me_role
  from public.vf_users u
  where u.auth_user_id=(select auth.uid())
    and u.status='active'
  limit 1;

  if me_id is null then return false; end if;
  if me_role in ('adm','gestor') then return true; end if;
  if me_role='eleitor' then
    return p_subject_auth_user_id=(select auth.uid());
  end if;

  return exists(
    select 1
    from private.vf_visible_user_ids() v
    where v.user_id=p_assigned_user_id
  );
end;
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
      and (
        me.access_role in ('adm','gestor')
        or (
          me.access_role in ('master','lideranca','liderado')
          and r.assigned_user_id in (
            select v.user_id from private.vf_visible_user_ids() v
          )
        )
      )
  );
$function$;

create or replace function private.vf_can_view_owner_email(p_owner_email text)
returns boolean
language sql
stable security definer
set search_path to ''
as $function$
  select case
    when private.vf_is_gestor() then exists (
      select 1
      from public.vf_owned_records r
      where r.municipality_id=private.vf_current_municipality_id()
        and lower(trim(r.owner_email))=lower(trim(p_owner_email))
    )
    else exists (
      select 1
      from public.vf_users u
      where lower(trim(u.email))=lower(trim(p_owner_email))
        and u.id in (select v.user_id from private.vf_visible_user_ids() v)
    )
  end;
$function$;

create or replace function private.vf_gestor_operational_owner_emails_internal()
returns text[]
language plpgsql
stable security definer
set search_path to ''
as $function$
declare
  actor_role text;
  owner_emails text[];
begin
  select u.access_role into actor_role
  from public.vf_users u
  where u.auth_user_id=(select auth.uid())
    and u.status='active'
  limit 1;

  if actor_role<>'gestor' then
    raise exception 'Acesso exclusivo do Gestor' using errcode='42501';
  end if;

  select coalesce(array_agg(distinct lower(trim(r.owner_email)) order by lower(trim(r.owner_email))),'{}'::text[])
  into owner_emails
  from public.vf_owned_records r
  where r.municipality_id=private.vf_current_municipality_id()
    and nullif(trim(r.owner_email),'') is not null;

  return owner_emails;
end;
$function$;

create or replace function public.vf_gestor_operational_owner_emails()
returns text[]
language sql
stable
set search_path to ''
as $function$
  select private.vf_gestor_operational_owner_emails_internal();
$function$;

revoke all on function public.vf_gestor_operational_owner_emails() from public, anon;
grant execute on function public.vf_gestor_operational_owner_emails() to authenticated;

create or replace function private.vf_contacts_for_district_internal(
  p_owner_emails text[],
  p_district text,
  p_profile text default null,
  p_search text default null,
  p_limit integer default 200,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable security definer
set search_path to ''
as $function$
declare
  v_canonical text;
  v_limit integer := least(greatest(coalesce(p_limit,200),1),500);
  v_offset integer := greatest(coalesce(p_offset,0),0);
  v_search text := trim(coalesce(p_search,''));
  v_total bigint;
  v_contacts jsonb;
  v_current_municipality_id bigint := private.vf_current_municipality_id();
begin
  perform private.vf_contact_dashboard_summary_internal(p_owner_emails);
  v_canonical := public.vf_resolve_arapongas_district(p_district);
  if v_canonical is null then
    raise exception 'Bairro de Arapongas não reconhecido.' using errcode='22023';
  end if;

  with target_keys as (
    select public.vf_normalize_arapongas_district(v_canonical) district_key
    union
    select a.alias_key
    from public.vf_arapongas_district_aliases a
    where a.active and a.canonical_name=v_canonical
  ), filtered as (
    select r.id,r.owner_email,r.payload,r.created_at,r.updated_at
    from public.vf_owned_records r
    where r.kind='contact'
      and r.municipality_id=v_current_municipality_id
      and lower(trim(r.owner_email)) in (
        select lower(trim(x))
        from unnest(coalesce(p_owner_emails,'{}'::text[])) x
      )
      and public.vf_normalize_arapongas_district(r.payload->>'district') in (
        select district_key from target_keys where district_key is not null
      )
      and (p_profile is null or trim(p_profile)='' or r.payload->>'kind'=p_profile)
      and (
        v_search=''
        or position(lower(v_search) in lower(concat_ws(' ',
          coalesce(r.payload->>'name',''),
          coalesce(r.payload->>'phone',''),
          coalesce(r.payload->>'district',''),
          coalesce(r.payload->>'leader',''),
          coalesce(r.owner_email,'')
        )))>0
      )
  )
  select count(*) into v_total from filtered;

  with target_keys as (
    select public.vf_normalize_arapongas_district(v_canonical) district_key
    union
    select a.alias_key
    from public.vf_arapongas_district_aliases a
    where a.active and a.canonical_name=v_canonical
  ), filtered as (
    select r.id,r.owner_email,r.payload,r.created_at,r.updated_at
    from public.vf_owned_records r
    where r.kind='contact'
      and r.municipality_id=v_current_municipality_id
      and lower(trim(r.owner_email)) in (
        select lower(trim(x))
        from unnest(coalesce(p_owner_emails,'{}'::text[])) x
      )
      and public.vf_normalize_arapongas_district(r.payload->>'district') in (
        select district_key from target_keys where district_key is not null
      )
      and (p_profile is null or trim(p_profile)='' or r.payload->>'kind'=p_profile)
      and (
        v_search=''
        or position(lower(v_search) in lower(concat_ws(' ',
          coalesce(r.payload->>'name',''),
          coalesce(r.payload->>'phone',''),
          coalesce(r.payload->>'district',''),
          coalesce(r.payload->>'leader',''),
          coalesce(r.owner_email,'')
        )))>0
      )
    order by r.updated_at desc,r.id desc
    limit v_limit offset v_offset
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',id,
        'ownerEmail',case when private.vf_is_gestor() then '' else owner_email end,
        'createdAt',created_at,
        'updatedAt',updated_at
      ) || coalesce(payload,'{}'::jsonb)
      order by updated_at desc,id desc
    ),
    '[]'::jsonb
  ) into v_contacts
  from filtered;

  return jsonb_build_object(
    'district',v_canonical,
    'total',v_total,
    'contacts',v_contacts
  );
end;
$function$;
