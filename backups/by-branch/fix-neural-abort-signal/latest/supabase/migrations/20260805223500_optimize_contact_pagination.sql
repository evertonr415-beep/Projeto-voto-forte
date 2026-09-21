begin;

create index if not exists vf_owned_records_contact_owner_updated_idx
  on public.vf_owned_records(owner_email, updated_at desc, id desc)
  where kind = 'contact';

create index if not exists vf_owned_records_contact_updated_idx
  on public.vf_owned_records(updated_at desc, id desc)
  where kind = 'contact';

commit;
