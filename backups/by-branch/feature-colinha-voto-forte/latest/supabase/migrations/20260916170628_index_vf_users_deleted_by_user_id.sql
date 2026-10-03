-- Índice de suporte à FK vf_users_deleted_by_user_id_fkey.
create index if not exists vf_users_deleted_by_user_id_idx
  on public.vf_users (deleted_by_user_id);
