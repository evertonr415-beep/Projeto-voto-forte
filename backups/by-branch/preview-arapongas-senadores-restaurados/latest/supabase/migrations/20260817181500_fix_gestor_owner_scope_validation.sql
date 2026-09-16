-- Corrige o escopo consolidado do Gestor quando ele ainda nao possui registros
-- proprios no municipio atual. O Gestor pode sempre incluir o proprio e-mail no
-- conjunto solicitado e continua podendo consultar apenas responsaveis que
-- possuam registros no municipio corrente.

create or replace function private.vf_can_view_owner_email(p_owner_email text)
returns boolean
language sql
stable security definer
set search_path to ''
as $function$
  select case
    when private.vf_is_gestor() then
      lower(trim(p_owner_email)) = lower(trim(coalesce((
        select u.email
        from public.vf_users u
        where u.auth_user_id=(select auth.uid())
          and u.status='active'
        limit 1
      ),'')))
      or exists (
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
