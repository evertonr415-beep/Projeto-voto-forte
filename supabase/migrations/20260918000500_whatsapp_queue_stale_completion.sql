create or replace function public.vf_whatsapp_queue_recover_stale()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer := 0;
begin
  select count(*)::integer
    into v_count
  from public.vf_whatsapp_campaign_items
  where status = 'sending'
    and lock_expires_at is not null
    and lock_expires_at < now();

  with stale as (
    update public.vf_whatsapp_campaign_items
    set
      status = 'uncertain',
      uncertain_at = now(),
      error_code = coalesce(error_code, 'worker_lease_expired'),
      error_message = coalesce(
        error_message,
        'Envio ficou sem confirmação após interrupção do worker. Requer conferência antes de reenviar.'
      ),
      lock_token = null,
      locked_at = null,
      lock_expires_at = null,
      updated_at = now()
    where status = 'sending'
      and lock_expires_at is not null
      and lock_expires_at < now()
    returning campaign_id
  ),
  grouped as (
    select campaign_id, count(*)::integer as qty
    from stale
    group by campaign_id
  )
  update public.vf_whatsapp_campaigns c
  set
    sending_count = greatest(0, c.sending_count - g.qty),
    uncertain_count = c.uncertain_count + g.qty,
    updated_at = now()
  from grouped g
  where c.id = g.campaign_id;

  update public.vf_whatsapp_campaigns c
  set
    status = 'completed',
    completed_at = coalesce(c.completed_at, now()),
    updated_at = now()
  where c.status in ('running', 'queued')
    and not exists (
      select 1
      from public.vf_whatsapp_campaign_items i
      where i.campaign_id = c.id
        and i.status in ('waiting', 'sending')
    );

  return v_count;
end;
$$;

revoke all on function public.vf_whatsapp_queue_recover_stale() from public, anon, authenticated;
grant execute on function public.vf_whatsapp_queue_recover_stale() to service_role;
