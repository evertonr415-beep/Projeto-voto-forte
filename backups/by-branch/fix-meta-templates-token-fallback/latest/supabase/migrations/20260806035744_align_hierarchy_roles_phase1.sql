begin;

alter table public.vf_users
  alter column role set default 'liderado';

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
      and case
        when require_master then u.role = 'master'
        else u.role in ('master', 'gestor', 'lider')
      end
  );
$$;

revoke all on function private.vf_is_admin(boolean) from public, anon;
grant execute on function private.vf_is_admin(boolean) to authenticated;

drop policy if exists vf_users_select on public.vf_users;
create policy vf_users_select
on public.vf_users
for select
to authenticated
using (
  auth_user_id = (select auth.uid())
  or private.vf_is_admin(false)
);

commit;
