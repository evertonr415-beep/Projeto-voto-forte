begin;

create index if not exists vf_owned_records_owner_kind_idx
on public.vf_owned_records (owner_email, kind);

create or replace function public.vf_contact_dashboard_summary(p_owner_emails text[])
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with contacts as (
    select
      coalesce(payload->>'kind', 'Eleitor') as profile,
      nullif(trim(payload->>'district'), '') as district
    from public.vf_owned_records
    where kind = 'contact'
      and owner_email = any(p_owner_emails)
  ),
  district_counts as (
    select district, count(*)::bigint as total
    from contacts
    where district is not null
    group by district
  ),
  contact_totals as (
    select
      count(*)::bigint as total,
      count(*) filter (where profile = 'Eleitor')::bigint as voters,
      count(*) filter (where profile = 'Liderança')::bigint as leaders,
      count(distinct district)::bigint as districts_reached
    from contacts
  ),
  meeting_totals as (
    select count(*)::bigint as meetings
    from public.vf_owned_records
    where kind = 'meeting'
      and owner_email = any(p_owner_emails)
  )
  select jsonb_build_object(
    'total', contact_totals.total,
    'voters', contact_totals.voters,
    'leaders', contact_totals.leaders,
    'meetings', meeting_totals.meetings,
    'districtsReached', contact_totals.districts_reached,
    'districts', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object('district', district, 'total', total)
          order by total desc, district asc
        )
        from district_counts
      ),
      '[]'::jsonb
    )
  )
  from contact_totals
  cross join meeting_totals;
$$;

commit;
