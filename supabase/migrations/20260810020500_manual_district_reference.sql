begin;

create or replace function public.vf_set_district_territorial_reference(
  p_district text,
  p_latitude double precision,
  p_longitude double precision
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_actor_user_id bigint;
  v_actor_auth_user_id uuid;
  v_actor_email text;
  v_actor_role text;
  v_canonical text;
  v_now timestamptz := now();
begin
  if (select auth.uid()) is null then
    raise exception 'Usuário não autenticado.' using errcode = '42501';
  end if;

  select u.id, u.auth_user_id, lower(trim(u.email)), u.role
    into v_actor_user_id, v_actor_auth_user_id, v_actor_email, v_actor_role
  from public.vf_users u
  where u.auth_user_id = (select auth.uid())
    and u.status = 'active'
  limit 1;

  if v_actor_user_id is null then
    raise exception 'Usuário sem acesso ativo.' using errcode = '42501';
  end if;

  if v_actor_role <> 'master' then
    raise exception 'Somente o Administrador Master pode definir referências territoriais globais.'
      using errcode = '42501';
  end if;

  v_canonical := public.vf_resolve_arapongas_district(trim(coalesce(p_district, '')));
  if v_canonical is null then
    raise exception 'Bairro territorial não reconhecido.' using errcode = '22023';
  end if;

  if p_latitude is null or p_longitude is null
     or p_latitude < -23.55 or p_latitude > -23.25
     or p_longitude < -51.60 or p_longitude > -51.30 then
    raise exception 'O ponto selecionado está fora da área esperada de Arapongas.'
      using errcode = '22023';
  end if;

  insert into public.vf_arapongas_district_geocodes(
    canonical_name,
    latitude,
    longitude,
    source,
    reference_cep,
    matched_neighborhood,
    confidence,
    reference_street,
    geocode_attempted_at,
    geocode_error,
    updated_at
  ) values (
    v_canonical,
    p_latitude,
    p_longitude,
    'Referência territorial validada manualmente no Mapa Eleitoral',
    null,
    v_canonical,
    'manual_reference',
    null,
    v_now,
    null,
    v_now
  )
  on conflict (canonical_name) do update set
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    source = excluded.source,
    reference_cep = excluded.reference_cep,
    matched_neighborhood = excluded.matched_neighborhood,
    confidence = excluded.confidence,
    reference_street = excluded.reference_street,
    geocode_attempted_at = excluded.geocode_attempted_at,
    geocode_error = excluded.geocode_error,
    updated_at = excluded.updated_at;

  insert into public.vf_audit_logs(
    actor_id,
    actor_email,
    action,
    detail
  ) values (
    v_actor_auth_user_id,
    v_actor_email,
    'Referência territorial definida',
    v_canonical || ' · ponto territorial manual validado no Mapa Eleitoral'
  );

  return jsonb_build_object(
    'ok', true,
    'district', v_canonical,
    'latitude', p_latitude,
    'longitude', p_longitude
  );
end;
$function$;

revoke all on function public.vf_set_district_territorial_reference(text, double precision, double precision)
from public, anon;
grant execute on function public.vf_set_district_territorial_reference(text, double precision, double precision)
to authenticated;

commit;
