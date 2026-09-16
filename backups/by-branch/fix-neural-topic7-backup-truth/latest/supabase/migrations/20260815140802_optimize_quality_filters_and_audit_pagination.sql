create index if not exists vf_audit_created_id_idx
  on public.vf_audit_logs (created_at desc, id desc);

create or replace function private.vf_contact_quality_filter_summary_internal()
returns table(
  filter_code text,
  label text,
  category text,
  total bigint
)
language sql
stable
security definer
set search_path to ''
as $function$
  with me as materialized (
    select u.id, u.access_role, u.auth_user_id
    from public.vf_users u
    where u.auth_user_id = (select auth.uid())
      and u.status = 'active'
    limit 1
  ),
  visible as materialized (
    select v.user_id
    from private.vf_visible_user_ids() v
    where exists (select 1 from me where access_role not in ('adm','eleitor'))
  ),
  base as materialized (
    select
      q.record_id,
      q.district_original,
      q.cep,
      q.street_number,
      q.has_missing_street,
      q.has_invalid_phone,
      q.has_duplicate_phone,
      q.has_missing_name,
      q.has_incomplete_name,
      q.has_missing_district,
      q.has_location_divergence,
      q.is_rural,
      q.severity,
      r.payload,
      public.vf_map_coordinate(r.payload->>'latitude') as latitude,
      public.vf_map_coordinate(r.payload->>'longitude') as longitude
    from public.vf_contact_quality q
    join public.vf_owned_records r
      on r.id = q.record_id
     and r.kind = 'contact'
    cross join me
    where
      me.access_role = 'adm'
      or (me.access_role = 'eleitor' and r.subject_auth_user_id = me.auth_user_id)
      or (me.access_role <> 'eleitor' and r.assigned_user_id in (select user_id from visible))
  ),
  stats as (
    select
      count(*)::bigint as all_contacts,
      count(*) filter (
        where (latitude is null or longitude is null)
          and district_original <> ''
          and not is_rural
          and not has_location_divergence
      )::bigint as district_only,
      count(*) filter (where latitude is not null and longitude is not null)::bigint as exact_location,
      count(*) filter (
        where latitude is not null and longitude is not null
          and payload->>'kind' = 'Liderança'
      )::bigint as leadership_exact,
      count(*) filter (where has_missing_street)::bigint as missing_street,
      count(*) filter (where nullif(btrim(cep), '') is null)::bigint as missing_cep,
      count(*) filter (where nullif(btrim(street_number), '') is null)::bigint as missing_number,
      count(*) filter (where has_invalid_phone)::bigint as invalid_phone,
      count(*) filter (where has_duplicate_phone)::bigint as duplicate_phone,
      count(*) filter (where has_missing_name)::bigint as missing_name,
      count(*) filter (where has_incomplete_name)::bigint as incomplete_name,
      count(*) filter (where has_missing_district)::bigint as missing_district,
      count(*) filter (where has_location_divergence)::bigint as location_divergence,
      count(*) filter (where is_rural)::bigint as rural_location,
      count(*) filter (where severity in ('warning','critical'))::bigint as needs_review
    from base
  )
  select v.filter_code, v.label, v.category, v.total
  from stats s
  cross join lateral (
    values
      ('all'::text, 'Todos os contatos'::text, 'geral'::text, s.all_contacts),
      ('district_only'::text, 'Localização somente por bairro'::text, 'mapa'::text, s.district_only),
      ('exact_location'::text, 'Localização exata'::text, 'mapa'::text, s.exact_location),
      ('leadership_exact'::text, 'Lideranças com localização exata'::text, 'mapa'::text, s.leadership_exact),
      ('missing_street'::text, 'Sem rua'::text, 'completude'::text, s.missing_street),
      ('missing_cep'::text, 'Sem CEP'::text, 'completude'::text, s.missing_cep),
      ('missing_number'::text, 'Sem número'::text, 'completude'::text, s.missing_number),
      ('invalid_phone'::text, 'Telefone inválido'::text, 'correcao'::text, s.invalid_phone),
      ('duplicate_phone'::text, 'Telefone duplicado'::text, 'correcao'::text, s.duplicate_phone),
      ('missing_name'::text, 'Sem nome'::text, 'correcao'::text, s.missing_name),
      ('incomplete_name'::text, 'Nome incompleto'::text, 'correcao'::text, s.incomplete_name),
      ('missing_district'::text, 'Sem bairro'::text, 'territorial'::text, s.missing_district),
      ('location_divergence'::text, 'Bairro não reconhecido ou divergente'::text, 'territorial'::text, s.location_divergence),
      ('rural_location'::text, 'Localidade rural'::text, 'territorial'::text, s.rural_location),
      ('needs_review'::text, 'Requer revisão'::text, 'correcao'::text, s.needs_review)
  ) as v(filter_code,label,category,total);
$function$;

revoke execute on function private.vf_contact_quality_filter_summary_internal() from public, anon;
grant execute on function private.vf_contact_quality_filter_summary_internal() to authenticated, service_role;

create or replace function public.vf_contact_quality_filter_summary()
returns table(filter_code text,label text,category text,total bigint)
language sql
stable
security invoker
set search_path to ''
as $function$
  select * from private.vf_contact_quality_filter_summary_internal();
$function$;

revoke execute on function public.vf_contact_quality_filter_summary() from public, anon;
grant execute on function public.vf_contact_quality_filter_summary() to authenticated, service_role;

create or replace function private.vf_contact_quality_filtered_internal(
  p_filter_code text,
  p_limit integer default 100,
  p_offset integer default 0
)
returns table(
  record_id bigint,
  contact_name text,
  phone text,
  district text,
  street text,
  street_number text,
  cep text,
  severity text,
  issue_codes text[],
  profile text,
  map_location_type text,
  source_type text,
  import_batch_id text,
  assigned_user_id bigint,
  owner_email text,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if p_filter_code is null or p_filter_code not in (
    'all','district_only','exact_location','leadership_exact',
    'missing_street','missing_cep','missing_number','invalid_phone','duplicate_phone',
    'missing_name','incomplete_name','missing_district','location_divergence','rural_location','needs_review'
  ) then
    raise exception 'Filtro de qualidade inválido.' using errcode='22023';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 500 then
    raise exception 'O limite deve estar entre 1 e 500.' using errcode='22023';
  end if;
  if p_offset is null or p_offset < 0 then
    raise exception 'O deslocamento não pode ser negativo.' using errcode='22023';
  end if;

  return query
  with me as materialized (
    select u.id, u.access_role, u.auth_user_id
    from public.vf_users u
    where u.auth_user_id=(select auth.uid()) and u.status='active'
    limit 1
  ),
  visible as materialized (
    select v.user_id from private.vf_visible_user_ids() v
    where exists (select 1 from me where access_role not in ('adm','eleitor'))
  ),
  base as materialized (
    select
      q.record_id,q.contact_name,q.phone,q.district_original,q.street,q.street_number,q.cep,
      q.severity,q.issue_codes,q.has_missing_street,q.has_invalid_phone,q.has_duplicate_phone,
      q.has_missing_name,q.has_incomplete_name,q.has_missing_district,q.has_location_divergence,
      q.is_rural,q.updated_at,r.payload,r.assigned_user_id,r.owner_email,
      public.vf_map_coordinate(r.payload->>'latitude') as latitude,
      public.vf_map_coordinate(r.payload->>'longitude') as longitude
    from public.vf_contact_quality q
    join public.vf_owned_records r on r.id=q.record_id and r.kind='contact'
    cross join me
    where
      me.access_role='adm'
      or (me.access_role='eleitor' and r.subject_auth_user_id=me.auth_user_id)
      or (me.access_role<>'eleitor' and r.assigned_user_id in (select user_id from visible))
  )
  select
    b.record_id,b.contact_name,b.phone,b.district_original,b.street,b.street_number,b.cep,
    b.severity,b.issue_codes,
    case when b.payload->>'kind'='Liderança' then 'Liderança' else 'Eleitor' end::text,
    case
      when b.latitude is not null and b.longitude is not null and b.payload->>'kind'='Liderança' then 'leadership_exact'
      when b.latitude is not null and b.longitude is not null then 'exact_location'
      when b.is_rural then 'rural_location'
      when b.district_original<>'' and not b.has_location_divergence then 'district_only'
      else 'needs_review'
    end::text,
    case when nullif(btrim(b.payload->>'importBatchId'),'') is not null then 'imported' else 'manual' end::text,
    nullif(btrim(b.payload->>'importBatchId'),'')::text,
    b.assigned_user_id,b.owner_email,b.updated_at
  from base b
  where case p_filter_code
    when 'all' then true
    when 'district_only' then (b.latitude is null or b.longitude is null) and b.district_original<>'' and not b.is_rural and not b.has_location_divergence
    when 'exact_location' then b.latitude is not null and b.longitude is not null
    when 'leadership_exact' then b.latitude is not null and b.longitude is not null and b.payload->>'kind'='Liderança'
    when 'missing_street' then b.has_missing_street
    when 'missing_cep' then nullif(btrim(b.cep),'') is null
    when 'missing_number' then nullif(btrim(b.street_number),'') is null
    when 'invalid_phone' then b.has_invalid_phone
    when 'duplicate_phone' then b.has_duplicate_phone
    when 'missing_name' then b.has_missing_name
    when 'incomplete_name' then b.has_incomplete_name
    when 'missing_district' then b.has_missing_district
    when 'location_divergence' then b.has_location_divergence
    when 'rural_location' then b.is_rural
    when 'needs_review' then b.severity in ('warning','critical')
    else false
  end
  order by b.updated_at desc,b.record_id desc
  limit p_limit offset p_offset;
end;
$function$;

revoke execute on function private.vf_contact_quality_filtered_internal(text,integer,integer) from public, anon;
grant execute on function private.vf_contact_quality_filtered_internal(text,integer,integer) to authenticated, service_role;

create or replace function public.vf_contact_quality_filtered(
  p_filter_code text,p_limit integer default 100,p_offset integer default 0
)
returns table(
  record_id bigint,contact_name text,phone text,district text,street text,street_number text,cep text,
  severity text,issue_codes text[],profile text,map_location_type text,source_type text,import_batch_id text,
  assigned_user_id bigint,owner_email text,updated_at timestamptz
)
language sql
stable
security invoker
set search_path to ''
as $function$
  select * from private.vf_contact_quality_filtered_internal(p_filter_code,p_limit,p_offset);
$function$;

revoke execute on function public.vf_contact_quality_filtered(text,integer,integer) from public, anon;
grant execute on function public.vf_contact_quality_filtered(text,integer,integer) to authenticated, service_role;

create or replace function private.vf_audit_logs_page_internal(
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_action text default null,
  p_limit integer default 100,
  p_before_created_at timestamptz default null,
  p_before_id bigint default null
)
returns table(id bigint,actor_id uuid,actor_email text,action text,detail text,created_at timestamptz)
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if p_limit is null or p_limit < 1 or p_limit > 500 then
    raise exception 'O limite deve estar entre 1 e 500.' using errcode='22023';
  end if;
  if (p_before_created_at is null) <> (p_before_id is null) then
    raise exception 'Cursor de paginação incompleto.' using errcode='22023';
  end if;

  return query
  with me as materialized (
    select u.id,u.access_role
    from public.vf_users u
    where u.auth_user_id=(select auth.uid()) and u.status='active'
    limit 1
  ),
  visible_actor_ids as materialized (
    select u.auth_user_id
    from public.vf_users u
    where u.id in (select v.user_id from private.vf_visible_user_ids() v)
      and exists (select 1 from me where access_role<>'adm')
  )
  select l.id,l.actor_id,l.actor_email,l.action,l.detail,l.created_at
  from public.vf_audit_logs l
  cross join me
  where (me.access_role='adm' or l.actor_id in (select auth_user_id from visible_actor_ids))
    and (p_from is null or l.created_at>=p_from)
    and (p_to is null or l.created_at<p_to)
    and (p_action is null or l.action=p_action)
    and (p_before_created_at is null or (l.created_at,l.id)<(p_before_created_at,p_before_id))
  order by l.created_at desc,l.id desc
  limit p_limit;
end;
$function$;

revoke execute on function private.vf_audit_logs_page_internal(timestamptz,timestamptz,text,integer,timestamptz,bigint) from public, anon;
grant execute on function private.vf_audit_logs_page_internal(timestamptz,timestamptz,text,integer,timestamptz,bigint) to authenticated, service_role;

create or replace function public.vf_audit_logs_page(
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_action text default null,
  p_limit integer default 100,
  p_before_created_at timestamptz default null,
  p_before_id bigint default null
)
returns table(id bigint,actor_id uuid,actor_email text,action text,detail text,created_at timestamptz)
language sql
stable
security invoker
set search_path to ''
as $function$
  select * from private.vf_audit_logs_page_internal(p_from,p_to,p_action,p_limit,p_before_created_at,p_before_id);
$function$;

revoke execute on function public.vf_audit_logs_page(timestamptz,timestamptz,text,integer,timestamptz,bigint) from public, anon;
grant execute on function public.vf_audit_logs_page(timestamptz,timestamptz,text,integer,timestamptz,bigint) to authenticated, service_role;

create or replace function private.vf_audit_action_summary_internal(
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns table(action text,total bigint,last_at timestamptz)
language sql
stable
security definer
set search_path to ''
as $function$
  with me as materialized (
    select u.id,u.access_role
    from public.vf_users u
    where u.auth_user_id=(select auth.uid()) and u.status='active'
    limit 1
  ),
  visible_actor_ids as materialized (
    select u.auth_user_id
    from public.vf_users u
    where u.id in (select v.user_id from private.vf_visible_user_ids() v)
      and exists (select 1 from me where access_role<>'adm')
  )
  select l.action,count(*)::bigint,max(l.created_at)
  from public.vf_audit_logs l
  cross join me
  where (me.access_role='adm' or l.actor_id in (select auth_user_id from visible_actor_ids))
    and (p_from is null or l.created_at>=p_from)
    and (p_to is null or l.created_at<p_to)
  group by l.action
  order by count(*) desc,l.action;
$function$;

revoke execute on function private.vf_audit_action_summary_internal(timestamptz,timestamptz) from public, anon;
grant execute on function private.vf_audit_action_summary_internal(timestamptz,timestamptz) to authenticated, service_role;

create or replace function public.vf_audit_action_summary(
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns table(action text,total bigint,last_at timestamptz)
language sql
stable
security invoker
set search_path to ''
as $function$
  select * from private.vf_audit_action_summary_internal(p_from,p_to);
$function$;

revoke execute on function public.vf_audit_action_summary(timestamptz,timestamptz) from public, anon;
grant execute on function public.vf_audit_action_summary(timestamptz,timestamptz) to authenticated, service_role;