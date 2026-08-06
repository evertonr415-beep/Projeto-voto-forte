begin;

alter table public.vf_users
  alter column role set default 'liderado';

create or replace function private.vf_owner_user_id()
returns bigint
language sql
stable
security definer
set search_path to ''
as $$
  select u.id
  from public.vf_users u
  where lower(u.email) = 'evertonr415@gmail.com'
    and u.role = 'master'
    and u.status = 'active'
  limit 1;
$$;

revoke all on function private.vf_owner_user_id() from public, anon;
grant execute on function private.vf_owner_user_id() to authenticated;

create or replace function private.vf_is_admin(require_master boolean default false)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1
    from public.vf_users u
    where u.auth_user_id = (select auth.uid())
      and u.status = 'active'
      and (
        case
          when require_master then u.role = 'master'
          else u.role in ('master', 'gestor', 'lider')
        end
      )
  );
$$;

revoke all on function private.vf_is_admin(boolean) from public, anon;
grant execute on function private.vf_is_admin(boolean) to authenticated;

create or replace function private.vf_can_access_user(target_user_id bigint)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  with recursive actor as (
    select u.id, u.role
    from public.vf_users u
    where u.auth_user_id = (select auth.uid())
      and u.status = 'active'
    limit 1
  ), descendants as (
    select a.id
    from actor a
    union all
    select child.id
    from public.vf_users child
    join descendants d on child.parent_user_id = d.id
    where child.status = 'active'
  )
  select coalesce(
    (
      select
        a.role = 'master'
        or target_user_id = a.id
        or (
          a.role in ('gestor', 'lider')
          and exists (select 1 from descendants d where d.id = target_user_id)
        )
      from actor a
    ),
    false
  );
$$;

revoke all on function private.vf_can_access_user(bigint) from public, anon;
grant execute on function private.vf_can_access_user(bigint) to authenticated;

create or replace function private.vf_can_access_owner(target_auth_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1
    from public.vf_users target
    where target.auth_user_id = target_auth_user_id
      and private.vf_can_access_user(target.id)
  );
$$;

revoke all on function private.vf_can_access_owner(uuid) from public, anon;
grant execute on function private.vf_can_access_owner(uuid) to authenticated;

create or replace function private.vf_user_update_allowed(
  target_user_id bigint,
  next_auth_user_id uuid,
  next_email text,
  next_role text,
  next_status text,
  next_parent_user_id bigint
)
returns boolean
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  actor public.vf_users%rowtype;
  previous public.vf_users%rowtype;
  parent_row public.vf_users%rowtype;
  role_allowed boolean := false;
  creates_cycle boolean := false;
begin
  select * into actor
  from public.vf_users u
  where u.auth_user_id = (select auth.uid())
    and u.status = 'active'
  limit 1;

  if not found then
    return false;
  end if;

  select * into previous
  from public.vf_users u
  where u.id = target_user_id;

  if not found then
    return false;
  end if;

  if next_auth_user_id is distinct from previous.auth_user_id
     or lower(next_email) is distinct from lower(previous.email)
     or next_status not in ('active', 'blocked') then
    return false;
  end if;

  if actor.id = previous.id then
    return next_role = previous.role
      and next_status = previous.status
      and next_parent_user_id is not distinct from previous.parent_user_id;
  end if;

  if lower(previous.email) = 'evertonr415@gmail.com'
     or not private.vf_can_access_user(previous.id) then
    return false;
  end if;

  role_allowed := case actor.role
    when 'master' then next_role in ('master', 'gestor', 'lider', 'liderado')
    when 'gestor' then next_role in ('lider', 'liderado')
    when 'lider' then next_role = 'liderado'
    else false
  end;

  if not role_allowed then
    return false;
  end if;

  if next_role = 'master' then
    return actor.role = 'master' and next_parent_user_id is null;
  end if;

  if next_parent_user_id is null
     or next_parent_user_id = previous.id
     or (
       actor.role <> 'master'
       and not private.vf_can_access_user(next_parent_user_id)
     ) then
    return false;
  end if;

  select * into parent_row
  from public.vf_users u
  where u.id = next_parent_user_id
    and u.status = 'active';

  if not found then
    return false;
  end if;

  if (next_role = 'gestor' and parent_row.role <> 'master')
     or (next_role = 'lider' and parent_row.role not in ('master', 'gestor'))
     or (next_role = 'liderado' and parent_row.role not in ('master', 'gestor', 'lider')) then
    return false;
  end if;

  with recursive descendants as (
    select u.id
    from public.vf_users u
    where u.parent_user_id = previous.id
    union all
    select child.id
    from public.vf_users child
    join descendants d on child.parent_user_id = d.id
  )
  select exists (
    select 1 from descendants d where d.id = next_parent_user_id
  ) into creates_cycle;

  return not creates_cycle;
end;
$$;

revoke all on function private.vf_user_update_allowed(bigint, uuid, text, text, text, bigint) from public, anon;
grant execute on function private.vf_user_update_allowed(bigint, uuid, text, text, text, bigint) to authenticated;

create or replace function public.vf_prevent_invalid_hierarchy()
returns trigger
language plpgsql
set search_path to ''
as $$
declare
  parent_role text;
  parent_status text;
  master_count integer;
  creates_cycle boolean := false;
begin
  if new.role = 'master' then
    new.parent_user_id := null;

    select count(*) into master_count
    from public.vf_users u
    where u.role = 'master'
      and u.status = 'active'
      and u.id <> coalesce(new.id, -1);

    if new.status = 'active' and master_count >= 9 then
      raise exception 'O sistema permite no máximo 9 usuários Master ativos.';
    end if;

    return new;
  end if;

  if new.parent_user_id is null and tg_op = 'INSERT' and new.role = 'liderado' then
    new.parent_user_id := private.vf_owner_user_id();
  end if;

  if new.parent_user_id is null then
    raise exception 'Usuários Gestor, Líder e Liderado precisam de um superior.';
  end if;

  if new.parent_user_id = new.id then
    raise exception 'Um usuário não pode ser superior de si mesmo.';
  end if;

  if tg_op = 'UPDATE' then
    with recursive descendants as (
      select u.id
      from public.vf_users u
      where u.parent_user_id = new.id
      union all
      select child.id
      from public.vf_users child
      join descendants d on child.parent_user_id = d.id
    )
    select exists (
      select 1 from descendants d where d.id = new.parent_user_id
    ) into creates_cycle;

    if creates_cycle then
      raise exception 'O vínculo informado criaria um ciclo na hierarquia.';
    end if;
  end if;

  select u.role, u.status
    into parent_role, parent_status
  from public.vf_users u
  where u.id = new.parent_user_id;

  if parent_role is null then
    raise exception 'Superior não encontrado.';
  end if;

  if parent_status <> 'active' then
    raise exception 'O superior selecionado está bloqueado.';
  end if;

  if new.role = 'gestor' and parent_role <> 'master' then
    raise exception 'Gestor deve estar vinculado a um Master.';
  elsif new.role = 'lider' and parent_role not in ('master', 'gestor') then
    raise exception 'Líder deve estar vinculado a um Master ou Gestor.';
  elsif new.role = 'liderado' and parent_role not in ('master', 'gestor', 'lider') then
    raise exception 'Liderado deve estar vinculado a um Master, Gestor ou Líder.';
  end if;

  return new;
end;
$$;

revoke all on function public.vf_prevent_invalid_hierarchy() from public, anon, authenticated;

-- User visibility and management are constrained to self and descendants.
drop policy if exists vf_users_insert_self on public.vf_users;
create policy vf_users_insert_self
on public.vf_users
for insert
to authenticated
with check (
  auth_user_id = (select auth.uid())
  and lower(email) = lower(coalesce((select auth.jwt()) ->> 'email', ''))
  and status = 'active'
  and (
    (
      lower(email) = 'evertonr415@gmail.com'
      and role = 'master'
      and parent_user_id is null
    )
    or (
      lower(email) <> 'evertonr415@gmail.com'
      and role = 'liderado'
      and parent_user_id = private.vf_owner_user_id()
    )
  )
);

drop policy if exists vf_users_select on public.vf_users;
create policy vf_users_select
on public.vf_users
for select
to authenticated
using (private.vf_can_access_user(id));

drop policy if exists vf_users_update on public.vf_users;
create policy vf_users_update
on public.vf_users
for update
to authenticated
using (private.vf_can_access_user(id))
with check (
  private.vf_user_update_allowed(
    id,
    auth_user_id,
    email,
    role,
    status,
    parent_user_id
  )
);

-- Records and audit logs follow the same hierarchy boundary.
drop policy if exists vf_records_select on public.vf_owned_records;
create policy vf_records_select
on public.vf_owned_records
for select
to authenticated
using (private.vf_can_access_owner(owner_id));

drop policy if exists vf_records_insert on public.vf_owned_records;
create policy vf_records_insert
on public.vf_owned_records
for insert
to authenticated
with check (private.vf_can_access_owner(owner_id));

drop policy if exists vf_records_update on public.vf_owned_records;
create policy vf_records_update
on public.vf_owned_records
for update
to authenticated
using (private.vf_can_access_owner(owner_id))
with check (private.vf_can_access_owner(owner_id));

drop policy if exists vf_records_delete on public.vf_owned_records;
create policy vf_records_delete
on public.vf_owned_records
for delete
to authenticated
using (private.vf_can_access_owner(owner_id));

drop policy if exists vf_audit_select on public.vf_audit_logs;
create policy vf_audit_select
on public.vf_audit_logs
for select
to authenticated
using (private.vf_can_access_owner(actor_id));

-- Notification administration is limited to the same hierarchy scope.
drop policy if exists notifications_select_own_or_admin on public.vf_notifications;
create policy notifications_select_own_or_admin
on public.vf_notifications
for select
to authenticated
using (private.vf_can_access_owner(user_id));

drop policy if exists notifications_insert_own_or_admin on public.vf_notifications;
create policy notifications_insert_own_or_admin
on public.vf_notifications
for insert
to authenticated
with check (private.vf_can_access_owner(user_id));

drop policy if exists notifications_update_own_or_admin on public.vf_notifications;
create policy notifications_update_own_or_admin
on public.vf_notifications
for update
to authenticated
using (private.vf_can_access_owner(user_id))
with check (private.vf_can_access_owner(user_id));

drop policy if exists notifications_delete_own_or_admin on public.vf_notifications;
create policy notifications_delete_own_or_admin
on public.vf_notifications
for delete
to authenticated
using (private.vf_can_access_owner(user_id));

commit;
