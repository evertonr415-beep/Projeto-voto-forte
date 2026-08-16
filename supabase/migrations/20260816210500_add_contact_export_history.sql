create table if not exists public.vf_contact_exports (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null,
  actor_email text not null,
  owner_scope text not null,
  format text not null check (format in ('csv', 'xlsx', 'vcf')),
  item_count integer not null default 0 check (item_count >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.vf_contact_export_items (
  id bigint generated always as identity primary key,
  export_id uuid not null references public.vf_contact_exports(id) on delete cascade,
  record_id bigint not null,
  owner_email text not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  unique (export_id, record_id)
);

create index if not exists vf_contact_exports_actor_created_idx
  on public.vf_contact_exports (actor_id, created_at desc);
create index if not exists vf_contact_export_items_export_id_idx
  on public.vf_contact_export_items (export_id, id);

alter table public.vf_contact_exports enable row level security;
alter table public.vf_contact_export_items enable row level security;

revoke all on public.vf_contact_exports from anon, authenticated;
revoke all on public.vf_contact_export_items from anon, authenticated;
grant select, insert on public.vf_contact_exports to authenticated;
grant select, insert on public.vf_contact_export_items to authenticated;
grant usage, select on sequence public.vf_contact_export_items_id_seq to authenticated;

drop policy if exists vf_contact_exports_select on public.vf_contact_exports;
create policy vf_contact_exports_select
on public.vf_contact_exports
for select
to authenticated
using (
  actor_id = (select auth.uid())
  or (select private.vf_is_adm())
  or (select private.vf_can_view_auth_user(actor_id))
);

drop policy if exists vf_contact_exports_insert on public.vf_contact_exports;
create policy vf_contact_exports_insert
on public.vf_contact_exports
for insert
to authenticated
with check (actor_id = (select auth.uid()));

drop policy if exists vf_contact_export_items_select on public.vf_contact_export_items;
create policy vf_contact_export_items_select
on public.vf_contact_export_items
for select
to authenticated
using (
  exists (
    select 1
    from public.vf_contact_exports e
    where e.id = export_id
  )
);

drop policy if exists vf_contact_export_items_insert on public.vf_contact_export_items;
create policy vf_contact_export_items_insert
on public.vf_contact_export_items
for insert
to authenticated
with check (
  exists (
    select 1
    from public.vf_contact_exports e
    where e.id = export_id
      and e.actor_id = (select auth.uid())
  )
);

create or replace function public.vf_create_contact_export(
  p_owner_scope text,
  p_format text
)
returns table(export_id uuid, item_count integer)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_export_id uuid;
  v_count integer;
  v_actor_email text;
  v_scope text;
begin
  if auth.uid() is null then
    raise exception 'Não autenticado';
  end if;

  if lower(coalesce(p_format, '')) not in ('csv', 'xlsx', 'vcf') then
    raise exception 'Formato de exportação inválido';
  end if;

  v_actor_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  if v_actor_email = '' then
    raise exception 'E-mail autenticado indisponível';
  end if;

  v_scope := lower(trim(coalesce(nullif(p_owner_scope, ''), v_actor_email)));

  insert into public.vf_contact_exports (
    actor_id,
    actor_email,
    owner_scope,
    format
  ) values (
    auth.uid(),
    v_actor_email,
    v_scope,
    lower(p_format)
  )
  returning id into v_export_id;

  insert into public.vf_contact_export_items (
    export_id,
    record_id,
    owner_email,
    snapshot
  )
  select
    v_export_id,
    r.id,
    r.owner_email,
    jsonb_build_object(
      'name', coalesce(r.payload ->> 'name', ''),
      'phone', coalesce(r.payload ->> 'phone', ''),
      'kind', coalesce(r.payload ->> 'kind', 'Eleitor'),
      'district', coalesce(r.payload ->> 'district', ''),
      'cep', coalesce(r.payload ->> 'cep', ''),
      'street', coalesce(r.payload ->> 'street', ''),
      'number', coalesce(r.payload ->> 'number', ''),
      'leader', coalesce(r.payload ->> 'leader', ''),
      'city', coalesce(r.payload ->> 'city', ''),
      'state', coalesce(r.payload ->> 'state', '')
    )
  from public.vf_owned_records r
  where r.kind = 'contact'
    and (v_scope = 'all' or lower(r.owner_email) = v_scope)
  order by r.id;

  get diagnostics v_count = row_count;

  update public.vf_contact_exports
  set item_count = v_count
  where id = v_export_id;

  insert into public.vf_audit_logs (
    actor_id,
    actor_email,
    action,
    detail
  ) values (
    auth.uid(),
    v_actor_email,
    'Exportação de contatos',
    upper(p_format) || ' · ' || v_count || ' contatos · lote ' || v_export_id::text
  );

  return query select v_export_id, v_count;
end;
$$;

revoke all on function public.vf_create_contact_export(text, text) from public, anon;
grant execute on function public.vf_create_contact_export(text, text) to authenticated;
