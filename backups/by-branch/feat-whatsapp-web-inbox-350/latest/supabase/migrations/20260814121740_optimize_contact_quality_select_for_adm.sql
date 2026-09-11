drop policy if exists vf_contact_quality_visible_records on public.vf_contact_quality;

create policy vf_contact_quality_visible_records
on public.vf_contact_quality
for select
to authenticated
using (
  (select private.vf_is_adm())
  or (select private.vf_can_view_record(vf_contact_quality.record_id))
);
