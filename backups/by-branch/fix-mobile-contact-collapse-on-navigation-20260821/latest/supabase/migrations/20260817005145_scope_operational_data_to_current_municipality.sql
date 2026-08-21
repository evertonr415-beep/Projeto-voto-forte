begin;

create or replace function private.vf_visible_user_ids()
returns table(user_id bigint)
language sql
stable
security definer
set search_path=''
as $$
  with recursive me as (
    select
      u.id,
      u.access_role,
      private.vf_current_municipality_id() as municipality_id
    from public.vf_users u
    where u.auth_user_id=(select auth.uid())
      and u.status='active'
    limit 1
  ), tree as (
    select u.id, array[u.id]::bigint[] as path
    from public.vf_users u
    join me on me.id=u.id

    union all

    select child.id, tree.path || child.id
    from public.vf_users child
    join tree on child.parent_user_id=tree.id
    where not child.id=any(tree.path)
  )
  select um.user_id
  from me
  join public.vf_user_municipalities um
    on um.municipality_id=me.municipality_id
   and um.status='active'
  where me.access_role='adm'

  union

  select tree.id
  from tree
  join me on true
  join public.vf_user_municipalities um
    on um.user_id=tree.id
   and um.municipality_id=me.municipality_id
   and um.status='active'
  where me.access_role<>'adm';
$$;

create or replace function private.vf_can_assign_to_user(p_user_id bigint)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select exists (
    select 1
    from public.vf_users me
    join public.vf_users target on target.id=p_user_id
    where me.auth_user_id=(select auth.uid())
      and me.status='active'
      and me.access_role<>'eleitor'
      and target.status='active'
      and target.access_role<>'eleitor'
      and target.id in (select v.user_id from private.vf_visible_user_ids() v)
  );
$$;

create or replace function private.vf_can_view_assignment(
  p_assigned_user_id bigint,
  p_subject_auth_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select exists (
    select 1
    from public.vf_users me
    where me.auth_user_id=(select auth.uid())
      and me.status='active'
      and (
        (
          me.access_role='eleitor'
          and p_subject_auth_user_id=(select auth.uid())
          and me.id in (select v.user_id from private.vf_visible_user_ids() v)
        )
        or (
          me.access_role<>'eleitor'
          and p_assigned_user_id in (select v.user_id from private.vf_visible_user_ids() v)
        )
      )
  );
$$;

create or replace function private.vf_can_manage_record(p_record_id bigint)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select exists (
    select 1
    from public.vf_owned_records r
    join public.vf_users me
      on me.auth_user_id=(select auth.uid())
     and me.status='active'
    where r.id=p_record_id
      and r.municipality_id=private.vf_current_municipality_id()
      and me.access_role in ('adm','master','lideranca','liderado')
      and r.assigned_user_id in (select v.user_id from private.vf_visible_user_ids() v)
  );
$$;

create or replace function private.vf_can_view_record(p_record_id bigint)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select exists (
    select 1
    from public.vf_owned_records r
    where r.id=p_record_id
      and r.municipality_id=private.vf_current_municipality_id()
      and private.vf_can_view_assignment(r.assigned_user_id,r.subject_auth_user_id)
  );
$$;

drop policy if exists vf_records_select on public.vf_owned_records;
create policy vf_records_select on public.vf_owned_records
for select to authenticated
using (
  municipality_id=private.vf_current_municipality_id()
  and private.vf_can_view_assignment(assigned_user_id,subject_auth_user_id)
);

drop policy if exists vf_records_insert on public.vf_owned_records;
create policy vf_records_insert on public.vf_owned_records
for insert to authenticated
with check (
  municipality_id=private.vf_current_municipality_id()
  and assigned_user_id is not null
  and private.vf_can_assign_to_user(assigned_user_id)
  and exists (
    select 1
    from public.vf_users target
    where target.id=vf_owned_records.assigned_user_id
      and target.auth_user_id=vf_owned_records.owner_id
      and target.status='active'
      and target.access_role<>'eleitor'
  )
);

drop policy if exists vf_records_update on public.vf_owned_records;
create policy vf_records_update on public.vf_owned_records
for update to authenticated
using (
  municipality_id=private.vf_current_municipality_id()
  and private.vf_can_manage_record(id)
)
with check (
  municipality_id=private.vf_current_municipality_id()
  and assigned_user_id is not null
  and private.vf_can_assign_to_user(assigned_user_id)
);

drop policy if exists vf_records_delete on public.vf_owned_records;
create policy vf_records_delete on public.vf_owned_records
for delete to authenticated
using (
  municipality_id=private.vf_current_municipality_id()
  and private.vf_can_manage_record(id)
);

drop policy if exists vf_contact_quality_visible_records on public.vf_contact_quality;
create policy vf_contact_quality_visible_records on public.vf_contact_quality
for select to authenticated
using (private.vf_can_view_record(record_id));

drop policy if exists vf_contact_exports_select on public.vf_contact_exports;
create policy vf_contact_exports_select on public.vf_contact_exports
for select to authenticated
using (
  municipality_id=private.vf_current_municipality_id()
  and (
    actor_id=(select auth.uid())
    or private.vf_can_view_auth_user(actor_id)
  )
);

drop policy if exists vf_contact_exports_insert on public.vf_contact_exports;
create policy vf_contact_exports_insert on public.vf_contact_exports
for insert to authenticated
with check (
  actor_id=(select auth.uid())
  and municipality_id=private.vf_current_municipality_id()
);

drop policy if exists vf_contact_exports_update_count on public.vf_contact_exports;
create policy vf_contact_exports_update_count on public.vf_contact_exports
for update to authenticated
using (
  actor_id=(select auth.uid())
  and municipality_id=private.vf_current_municipality_id()
)
with check (
  actor_id=(select auth.uid())
  and municipality_id=private.vf_current_municipality_id()
);

drop policy if exists vf_audit_select on public.vf_audit_logs;
create policy vf_audit_select on public.vf_audit_logs
for select to authenticated
using (
  municipality_id=private.vf_current_municipality_id()
  and (
    actor_id=(select auth.uid())
    or private.vf_can_view_auth_user(actor_id)
  )
);

drop policy if exists vf_audit_insert on public.vf_audit_logs;
create policy vf_audit_insert on public.vf_audit_logs
for insert to authenticated
with check (
  actor_id=(select auth.uid())
  and municipality_id=private.vf_current_municipality_id()
);

revoke all on function public.vf_activate_municipality(bigint) from public, anon;
grant execute on function public.vf_activate_municipality(bigint) to authenticated;

revoke all on function public.vf_admin_municipalities() from public, anon;
grant execute on function public.vf_admin_municipalities() to authenticated;

revoke all on function public.vf_invite_configuring_municipality_master(bigint,text,text) from public, anon;
grant execute on function public.vf_invite_configuring_municipality_master(bigint,text,text) to authenticated;

commit;