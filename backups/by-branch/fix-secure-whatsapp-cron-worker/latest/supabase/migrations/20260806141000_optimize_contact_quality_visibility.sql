begin;

create or replace function private.vf_visible_owner_email_set()
returns table(email text)
language sql
stable
security definer
set search_path to ''
as $$
  with recursive current_account as (
    select u.id, u.role
    from public.vf_users u
    where u.auth_user_id = (select auth.uid())
      and u.status = 'active'
    limit 1
  ), visible_users as (
    select
      u.id,
      lower(trim(u.email)) as email,
      array[u.id]::bigint[] as visited_ids
    from public.vf_users u
    join current_account account on account.id = u.id
    where u.status = 'active'

    union all

    select
      child.id,
      lower(trim(child.email)) as email,
      parent.visited_ids || child.id
    from public.vf_users child
    join visible_users parent on child.parent_user_id = parent.id
    where child.status = 'active'
      and not child.id = any(parent.visited_ids)
  )
  select lower(trim(u.email))
  from public.vf_users u
  where u.status = 'active'
    and exists (select 1 from current_account where role = 'master')

  union

  select visible_users.email
  from visible_users
  where not exists (select 1 from current_account where role = 'master');
$$;

revoke all on function private.vf_visible_owner_email_set() from public, anon;
grant execute on function private.vf_visible_owner_email_set() to authenticated, service_role;

drop policy if exists vf_contact_quality_visible_records on public.vf_contact_quality;

create policy vf_contact_quality_visible_records
on public.vf_contact_quality
for select
to authenticated
using (
  lower(trim(owner_email)) in (
    select visible.email
    from private.vf_visible_owner_email_set() visible
  )
);

commit;
