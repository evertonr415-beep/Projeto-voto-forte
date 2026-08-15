create or replace function private.vf_intelligence_contact_metrics_internal()
returns table(
  owner_email text,
  total_contacts bigint,
  voter_contacts bigint,
  contacts_last_7_days bigint,
  contacts_last_30_days bigint,
  voters_last_7_days bigint,
  last_voter_created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $function$
  with visible_users as (
    select lower(trim(u.email)) as owner