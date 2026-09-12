begin;

-- Normaliza os telefones dos contatos já existentes.
update public.vf_owned_records
set payload = jsonb_set(
  payload,
  '{phoneNormalized}',
  to_jsonb(regexp_replace(coalesce(payload->>'phone', ''), '\D', '', 'g')),
  true
)
where kind = 'contact'
  and coalesce(payload->>'phone', '') <> ''
  and coalesce(payload->>'phoneNormalized', '') = '';

-- Remove duplicados antigos, preservando o registro mais antigo de cada telefone
-- dentro do mesmo ambiente de usuário.
with ranked as (
  select
    id,
    row_number() over (
      partition by owner_email, payload->>'phoneNormalized'
      order by id asc
    ) as position
  from public.vf_owned_records
  where kind = 'contact'
    and coalesce(payload->>'phoneNormalized', '') <> ''
)
delete from public.vf_owned_records target
using ranked
where target.id = ranked.id
  and ranked.position > 1;

-- Impede definitivamente dois contatos com o mesmo telefone normalizado
-- no mesmo ambiente, inclusive em importações simultâneas ou repetidas.
create unique index if not exists vf_owned_records_contact_phone_unique
on public.vf_owned_records (
  owner_email,
  (payload->>'phoneNormalized')
)
where kind = 'contact'
  and coalesce(payload->>'phoneNormalized', '') <> '';

-- Acelera a confirmação de lotes repetidos.
create index if not exists vf_owned_records_import_batch_idx
on public.vf_owned_records (
  owner_email,
  (payload->>'importBatchId')
)
where kind = 'contact'
  and coalesce(payload->>'importBatchId', '') <> '';

commit;
