begin;

create table if not exists public.vf_arapongas_district_summary (
  owner_email text not null,
  district_name text not null,
  total bigint not null check (total >= 0),
  updated_at timestamptz not null default now(),
  primary key (owner_email, district_name)
);

create index if not exists vf_arapongas_district_summary_owner_idx
  on public.vf_arapongas_district_summary (owner_email);

grant select on public.vf_arapongas_district_summary
  to authenticated, anon, service_role;

create or replace function public.vf_refresh_arapongas_district_summary()
returns table (
  contacts_recognized bigint,
  districts_recognized bigint,
  owners_recognized bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('statement_timeout', '0', true);

  truncate table public.vf_arapongas_district_summary;

  insert into public.vf_arapongas_district_summary (
    owner_email,
    district_name,
    total,
    updated_at
  )
  select
    r.owner_email,
    a.canonical_name,
    count(*)::bigint,
    now()
  from public.vf_owned_records r
  join public.vf_arapongas_district_aliases a
    on a.alias_key = public.vf_normalize_arapongas_district(
      r.payload->>'district'
    )
   and a.active = true
  where r.kind = 'contact'
    and r.owner_email is not null
    and (
      coalesce(trim(r.payload->>'city'), '') = ''
      or upper(unaccent(trim(r.payload->>'city'))) = 'ARAPONGAS'
    )
  group by r.owner_email, a.canonical_name;

  return query
  select
    coalesce(sum(s.total), 0)::bigint,
    count(distinct s.district_name)::bigint,
    count(distinct s.owner_email)::bigint
  from public.vf_arapongas_district_summary s;
end;
$$;

grant execute on function public.vf_refresh_arapongas_district_summary()
  to authenticated, service_role;

create or replace function public.vf_adjust_arapongas_district_summary(
  p_owner_email text,
  p_district_name text,
  p_delta integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_owner_email is null
     or p_district_name is null
     or p_delta = 0 then
    return;
  end if;

  insert into public.vf_arapongas_district_summary (
    owner_email,
    district_name,
    total,
    updated_at
  )
  values (
    p_owner_email,
    p_district_name,
    greatest(p_delta, 0),
    now()
  )
  on conflict (owner_email, district_name)
  do update set
    total = greatest(
      public.vf_arapongas_district_summary.total + p_delta,
      0
    ),
    updated_at = now();

  delete from public.vf_arapongas_district_summary
  where owner_email = p_owner_email
    and district_name = p_district_name
    and total = 0;
end;
$$;

create or replace function public.vf_sync_arapongas_district_summary()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_district text;
  new_district text;
  old_is_arapongas boolean;
  new_is_arapongas boolean;
begin
  if tg_op in ('UPDATE', 'DELETE') and old.kind = 'contact' then
    old_is_arapongas := (
      coalesce(trim(old.payload->>'city'), '') = ''
      or upper(unaccent(trim(old.payload->>'city'))) = 'ARAPONGAS'
    );

    if old_is_arapongas then
      old_district := public.vf_canonical_arapongas_district(
        old.payload->>'district'
      );
      perform public.vf_adjust_arapongas_district_summary(
        old.owner_email,
        old_district,
        -1
      );
    end if;
  end if;

  if tg_op in ('INSERT', 'UPDATE') and new.kind = 'contact' then
    new_is_arapongas := (
      coalesce(trim(new.payload->>'city'), '') = ''
      or upper(unaccent(trim(new.payload->>'city'))) = 'ARAPONGAS'
    );

    if new_is_arapongas then
      new_district := public.vf_canonical_arapongas_district(
        new.payload->>'district'
      );
      perform public.vf_adjust_arapongas_district_summary(
        new.owner_email,
        new_district,
        1
      );
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists vf_sync_arapongas_district_summary_trigger
  on public.vf_owned_records;

create trigger vf_sync_arapongas_district_summary_trigger
after insert or update or delete on public.vf_owned_records
for each row
execute function public.vf_sync_arapongas_district_summary();

create or replace function public.vf_contact_dashboard_summary_cached(
  p_owner_emails text[]
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with contacts_all as (
    select coalesce(payload->>'kind', 'Eleitor') as profile
    from public.vf_owned_records
    where kind = 'contact'
      and owner_email = any(p_owner_emails)
  ),
  district_counts as (
    select
      district_name,
      sum(total)::bigint as total
    from public.vf_arapongas_district_summary
    where owner_email = any(p_owner_emails)
    group by district_name
  ),
  contact_totals as (
    select
      count(*)::bigint as total,
      count(*) filter (where profile = 'Eleitor')::bigint as voters,
      count(*) filter (where profile = 'Liderança')::bigint as leaders
    from contacts_all
  ),
  district_totals as (
    select count(*)::bigint as districts_reached
    from district_counts
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
    'districtsReached', district_totals.districts_reached,
    'districts', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'district', district_name,
            'total', total
          )
          order by total desc, district_name asc
        )
        from district_counts
      ),
      '[]'::jsonb
    )
  )
  from contact_totals
  cross join district_totals
  cross join meeting_totals;
$$;

grant execute on function public.vf_contact_dashboard_summary_cached(text[])
  to authenticated, anon, service_role;

commit;
