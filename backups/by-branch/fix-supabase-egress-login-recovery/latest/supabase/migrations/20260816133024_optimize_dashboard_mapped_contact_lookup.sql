create index if not exists vf_owned_records_mapped_contact_owner_updated_idx
  on public.vf_owned_records (owner_email, updated_at desc, id desc)
  where kind = 'contact'
    and payload->>'latitude' is not null
    and payload->>'longitude' is not null
    and payload->>'latitude' <> ''
    and payload->>'longitude' <> '';
