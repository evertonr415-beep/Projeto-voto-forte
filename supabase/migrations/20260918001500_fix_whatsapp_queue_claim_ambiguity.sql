create or replace function public.vf_whatsapp_queue_claim_next()
returns table (
  item_id bigint,
  campaign_id uuid,
  lock_token uuid,
  phone text,
  contact_name text,
  parameters jsonb,
  item_metadata jsonb,
  template_name text,
  template_language text,
  delay_seconds integer,
  attempt_count integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_campaign public.vf_whatsapp_campaigns%rowtype;
  v_item public.vf_whatsapp_campaign_items%rowtype;
  v_lock uuid;
begin
  perform public.vf_whatsapp_queue_recover_stale();

  select c.*
    into v_campaign
  from public.vf_whatsapp_campaigns as c
  where c.status = 'running'
    and c.next_dispatch_at <= now()
    and exists (
      select 1
      from public.vf_whatsapp_campaign_items as i
      where i.campaign_id = c.id
        and i.status = 'waiting'
        and i.next_attempt_at <= now()
    )
  order by c.created_at, c.id
  for update skip locked
  limit 1;

  if not found then
    return;
  end if;

  select i.*
    into v_item
  from public.vf_whatsapp_campaign_items as i
  where i.campaign_id = v_campaign.id
    and i.status = 'waiting'
    and i.next_attempt_at <= now()
  order by i.sequence, i.id
  for update skip locked
  limit 1;

  if not found then
    return;
  end if;

  v_lock := gen_random_uuid();

  update public.vf_whatsapp_campaign_items as qi
  set
    status = 'sending',
    attempt_count = qi.attempt_count + 1,
    lock_token = v_lock,
    locked_at = now(),
    lock_expires_at = now() + interval '2 minutes',
    error_code = null,
    error_message = null,
    updated_at = now()
  where qi.id = v_item.id;

  update public.vf_whatsapp_campaigns as qc
  set
    waiting_count = greatest(0, qc.waiting_count - 1),
    sending_count = qc.sending_count + 1,
    next_dispatch_at =
      clock_timestamp() + make_interval(secs => qc.delay_seconds),
    last_worker_at = now(),
    updated_at = now()
  where qc.id = v_campaign.id;

  return query
  select
    v_item.id,
    v_campaign.id,
    v_lock,
    v_item.phone,
    v_item.contact_name,
    v_item.parameters,
    v_item.metadata,
    v_campaign.template_name,
    v_campaign.template_language,
    v_campaign.delay_seconds,
    v_item.attempt_count + 1;
end;
$$;

revoke all on function public.vf_whatsapp_queue_claim_next() from public, anon, authenticated;
grant execute on function public.vf_whatsapp_queue_claim_next() to service_role;
