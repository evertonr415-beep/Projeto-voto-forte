set local role service_role;

do $$
declare
  v_campaign uuid;
  v_cancel_campaign uuid;
  v_claim record;
  v_status text;
  v_sent integer;
  v_failed integer;
  v_cancelled integer;
  v_ok boolean;
begin
  v_campaign := public.vf_whatsapp_queue_create_campaign(
    1,
    'queue-self-test@sistemavotoforte.com.br',
    'teste_sem_envio',
    'pt_BR',
    1,
    '[
      {"contactId":"self-1","name":"Teste Fila 1","phone":"5511000000000","parameters":[]},
      {"contactId":"self-2","name":"Teste Fila 2","phone":"5511000000001","parameters":[]}
    ]'::jsonb,
    '{"self_test":true}'::jsonb
  );

  v_ok := public.vf_whatsapp_queue_campaign_action(v_campaign, 'pause');
  if not v_ok then raise exception 'self-test: pause failed'; end if;

  v_ok := public.vf_whatsapp_queue_campaign_action(v_campaign, 'resume');
  if not v_ok then raise exception 'self-test: resume failed'; end if;

  select * into v_claim from public.vf_whatsapp_queue_claim_next();
  if v_claim.item_id is null or v_claim.campaign_id <> v_campaign then
    raise exception 'self-test: first claim failed';
  end if;

  v_ok := public.vf_whatsapp_queue_finish_item(
    v_claim.item_id,
    v_claim.lock_token,
    'sent',
    'self-test-message-id',
    null,
    null,
    '{"self_test":true}'::jsonb,
    60
  );
  if not v_ok then raise exception 'self-test: first finish failed'; end if;

  update public.vf_whatsapp_campaigns
  set next_dispatch_at = now()
  where id = v_campaign;

  select * into v_claim from public.vf_whatsapp_queue_claim_next();
  if v_claim.item_id is null or v_claim.campaign_id <> v_campaign then
    raise exception 'self-test: second claim failed';
  end if;

  v_ok := public.vf_whatsapp_queue_finish_item(
    v_claim.item_id,
    v_claim.lock_token,
    'failed',
    null,
    'self_test',
    'falha simulada sem envio',
    '{"self_test":true}'::jsonb,
    60
  );
  if not v_ok then raise exception 'self-test: second finish failed'; end if;

  select status, sent_count, failed_count
    into v_status, v_sent, v_failed
  from public.vf_whatsapp_campaigns
  where id = v_campaign;

  if v_status <> 'completed' or v_sent <> 1 or v_failed <> 1 then
    raise exception 'self-test: unexpected final counters: status %, sent %, failed %',
      v_status, v_sent, v_failed;
  end if;

  v_cancel_campaign := public.vf_whatsapp_queue_create_campaign(
    1,
    'queue-self-test@sistemavotoforte.com.br',
    'teste_cancelamento',
    'pt_BR',
    3,
    '[{"contactId":"self-3","name":"Teste Cancelar","phone":"5511000000002","parameters":[]}]'::jsonb,
    '{"self_test":true}'::jsonb
  );

  v_ok := public.vf_whatsapp_queue_campaign_action(v_cancel_campaign, 'cancel');
  if not v_ok then raise exception 'self-test: cancel failed'; end if;

  select status, cancelled_count
    into v_status, v_cancelled
  from public.vf_whatsapp_campaigns
  where id = v_cancel_campaign;

  if v_status <> 'cancelled' or v_cancelled <> 1 then
    raise exception 'self-test: unexpected cancel state: status %, cancelled %',
      v_status, v_cancelled;
  end if;

  delete from public.vf_whatsapp_campaigns
  where id in (v_campaign, v_cancel_campaign);
end;
$$;

reset role;
