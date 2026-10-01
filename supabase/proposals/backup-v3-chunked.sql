-- PROPOSTA NÃO APLICADA EM PRODUÇÃO.
--
-- Objetivo: substituir a montagem de um único JSONB de dezenas de MB por
-- segmentos pequenos e independentes, preservando os snapshots v1/v2 atuais.
--
-- Antes de converter este arquivo em migration:
-- 1. criar/testar em uma Supabase Development Branch;
-- 2. validar advisors de segurança e performance;
-- 3. testar criação, download e restauração com dados sintéticos;
-- 4. somente então gerar a migration oficial pelo fluxo Supabase CLI.

begin;

create table if not exists private.vf_backup_chunks (
  snapshot_id bigint not null references public.vf_backup_snapshots(id) on delete cascade,
  section text not null check (
    section in ('users','records','settings','auditLogs','invitations','provenance')
  ),
  chunk_no integer not null check (chunk_no >= 0),
  item_count integer not null check (item_count >= 0),
  checksum text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  primary key (snapshot_id, section, chunk_no)
);

alter table private.vf_backup_chunks enable row level security;
revoke all on table private.vf_backup_chunks from public, anon, authenticated;

create index if not exists vf_backup_chunks_snapshot_section_idx
  on private.vf_backup_chunks (snapshot_id, section, chunk_no);

create or replace function private.vf_backup_chunk_manifest(p_snapshot_id bigint)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  select jsonb_build_object(
    'format', 'voto-forte-backup',
    'version', 3,
    'snapshotId', p_snapshot_id,
    'sections', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'section', x.section,
          'chunks', x.chunk_count,
          'items', x.item_count
        )
        order by x.section
      ),
      '[]'::jsonb
    )
  )
  from (
    select
      c.section,
      count(*)::integer as chunk_count,
      coalesce(sum(c.item_count),0)::integer as item_count
    from private.vf_backup_chunks c
    where c.snapshot_id = p_snapshot_id
    group by c.section
  ) x;
$function$;

revoke execute on function private.vf_backup_chunk_manifest(bigint)
  from public, anon, authenticated;

create or replace function private.vf_insert_backup_chunks_v3(
  p_snapshot_id bigint,
  p_chunk_size integer default 500
)
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_total integer := 0;
begin
  if p_chunk_size is null or p_chunk_size < 100 or p_chunk_size > 2000 then
    raise exception 'Tamanho de chunk inválido.' using errcode = '22023';
  end if;

  -- Usuários
  insert into private.vf_backup_chunks(snapshot_id,section,chunk_no,item_count,checksum,data)
  select
    p_snapshot_id,
    'users',
    q.chunk_no,
    count(*)::integer,
    md5(jsonb_agg(q.row_data order by q.sort_id)::text),
    jsonb_agg(q.row_data order by q.sort_id)
  from (
    select
      ((row_number() over (order by u.id) - 1) / p_chunk_size)::integer as chunk_no,
      u.id as sort_id,
      to_jsonb(u) as row_data
    from public.vf_users u
  ) q
  group by q.chunk_no;
  get diagnostics v_total = row_count;

  -- Registros. Esta é a seção volumosa; cada agregado fica limitado ao chunk.
  insert into private.vf_backup_chunks(snapshot_id,section,chunk_no,item_count,checksum,data)
  select
    p_snapshot_id,
    'records',
    q.chunk_no,
    count(*)::integer,
    md5(jsonb_agg(q.row_data order by q.sort_id)::text),
    jsonb_agg(q.row_data order by q.sort_id)
  from (
    select
      ((row_number() over (order by r.id) - 1) / p_chunk_size)::integer as chunk_no,
      r.id as sort_id,
      to_jsonb(r) as row_data
    from public.vf_owned_records r
  ) q
  group by q.chunk_no;

  -- Configurações
  insert into private.vf_backup_chunks(snapshot_id,section,chunk_no,item_count,checksum,data)
  select
    p_snapshot_id,
    'settings',
    q.chunk_no,
    count(*)::integer,
    md5(jsonb_agg(q.row_data order by q.sort_key)::text),
    jsonb_agg(q.row_data order by q.sort_key)
  from (
    select
      ((row_number() over (order by s.key) - 1) / p_chunk_size)::integer as chunk_no,
      s.key as sort_key,
      to_jsonb(s) as row_data
    from public.vf_settings s
  ) q
  group by q.chunk_no;

  -- Auditoria
  insert into private.vf_backup_chunks(snapshot_id,section,chunk_no,item_count,checksum,data)
  select
    p_snapshot_id,
    'auditLogs',
    q.chunk_no,
    count(*)::integer,
    md5(jsonb_agg(q.row_data order by q.sort_id)::text),
    jsonb_agg(q.row_data order by q.sort_id)
  from (
    select
      ((row_number() over (order by a.id) - 1) / p_chunk_size)::integer as chunk_no,
      a.id as sort_id,
      to_jsonb(a) as row_data
    from public.vf_audit_logs a
  ) q
  group by q.chunk_no;

  -- Convites
  insert into private.vf_backup_chunks(snapshot_id,section,chunk_no,item_count,checksum,data)
  select
    p_snapshot_id,
    'invitations',
    q.chunk_no,
    count(*)::integer,
    md5(jsonb_agg(q.row_data order by q.sort_id)::text),
    jsonb_agg(q.row_data order by q.sort_id)
  from (
    select
      ((row_number() over (order by i.id) - 1) / p_chunk_size)::integer as chunk_no,
      i.id as sort_id,
      to_jsonb(i) as row_data
    from public.vf_user_invitations i
  ) q
  group by q.chunk_no;

  -- Proveniência
  insert into private.vf_backup_chunks(snapshot_id,section,chunk_no,item_count,checksum,data)
  select
    p_snapshot_id,
    'provenance',
    q.chunk_no,
    count(*)::integer,
    md5(jsonb_agg(q.row_data order by q.sort_id)::text),
    jsonb_agg(q.row_data order by q.sort_id)
  from (
    select
      ((row_number() over (order by p.record_id) - 1) / p_chunk_size)::integer as chunk_no,
      p.record_id as sort_id,
      to_jsonb(p) as row_data
    from private.vf_record_provenance p
  ) q
  group by q.chunk_no;

  select coalesce(sum(c.item_count),0)::integer
    into v_total
  from private.vf_backup_chunks c
  where c.snapshot_id = p_snapshot_id;

  return v_total;
end;
$function$;

revoke execute on function private.vf_insert_backup_chunks_v3(bigint,integer)
  from public, anon, authenticated;

create or replace function private.vf_create_automatic_backup_v3()
returns bigint
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_snapshot_id bigint;
  v_total integer;
  v_manifest jsonb;
begin
  insert into public.vf_backup_snapshots(
    created_by,
    backup_version,
    data,
    checksum,
    item_count
  )
  values (
    'automatic',
    3,
    jsonb_build_object('format','voto-forte-backup','version',3,'state','building'),
    md5('building'),
    0
  )
  returning id into v_snapshot_id;

  begin
    v_total := private.vf_insert_backup_chunks_v3(v_snapshot_id, 500);
    v_manifest := private.vf_backup_chunk_manifest(v_snapshot_id);

    update public.vf_backup_snapshots
    set data = v_manifest,
        checksum = md5(v_manifest::text),
        item_count = v_total
    where id = v_snapshot_id;
  exception when others then
    -- Mantém o snapshot como evidência de falha, mas remove chunks parciais.
    delete from private.vf_backup_chunks where snapshot_id = v_snapshot_id;
    update public.vf_backup_snapshots
    set data = jsonb_build_object(
          'format','voto-forte-backup',
          'version',3,
          'state','failed'
        ),
        checksum = md5('failed'),
        item_count = 0
    where id = v_snapshot_id;
    raise;
  end;

  -- A retenção antiga deve ser migrada separadamente e só depois de validar v3.
  return v_snapshot_id;
end;
$function$;

revoke execute on function private.vf_create_automatic_backup_v3()
  from public, anon, authenticated;

-- Não substitui o cron atual neste arquivo de proposta.
-- Não altera private.vf_create_automatic_backup().
-- Não altera private.vf_restore_backup_v1/v2().
-- Não apaga snapshots existentes.

rollback;
