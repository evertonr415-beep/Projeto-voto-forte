-- Cache request-invariant authorization checks once per statement instead of
-- repeating profile and municipality lookups for every operational record.
-- The role branches preserve the existing vf_can_view_assignment semantics.

drop policy if exists vf_records_select on public.vf_owned_records;

create policy vf_records_select
on public.vf_owned_records
for select
to authenticated
using (
  municipality_id = (select private.vf_current_municipality_id())
  and case (select (private.vf_current_profile()).access_role)
    when 'adm' then true
    when 'gestor' then true
    when 'eleitor' then subject_auth_user_id = (select auth.uid())
    else assigned_user_id in (
      select visible.user_id
      from private.vf_visible_user_ids() as visible
    )
  end
);
