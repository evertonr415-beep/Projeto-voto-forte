begin;

grant usage on schema private to authenticated, service_role;

create or replace function private.vf_can_view_owner_email(p_owner_email text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  with recursive current_account as (
    select u.id, u.email, u.role
    from public.vf_users u
    where u.auth_user_id = (select auth.uid())
      and u.status = 'active'
    limit 1
  ), visible_users as (
    select u.id, lower(trim(u.email)) as email, u.parent_user_id
    from public.vf_users u
    join current_account account on u.id = account.id
    where u.status = 'active'

    union all

    select child.id, lower(trim(child.email)) as email, child.parent_user_id
    from public.vf_users child
    join visible_users parent on child.parent_user_id = parent.id
    where child.status = 'active'
  )
  select exists (
    select 1
    from current_account account
    where account.role = 'master'
      or lower(trim(p_owner_email)) in (select visible_users.email from visible_users)
  );
$$;

revoke all on function private.vf_can_view_owner_email(text) from public, anon;
grant execute on function private.vf_can_view_owner_email(text) to authenticated, service_role;

drop policy if exists vf_contact_quality_visible_records on public.vf_contact_quality;

create policy vf_contact_quality_visible_records
on public.vf_contact_quality
for select
to authenticated
using (private.vf_can_view_owner_email(owner_email));

commit;
