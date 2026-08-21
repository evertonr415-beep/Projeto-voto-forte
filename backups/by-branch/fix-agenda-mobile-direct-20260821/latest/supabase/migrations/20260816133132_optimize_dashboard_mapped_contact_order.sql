create index if not exists vf_owned_records_mapped_contact_updated_owner_idx
  on public.vf_owned_records (updated_at desc, id desc, owner_email)
  where kind = 'contact'
    and payload->>'latitude' is not null
    and payload->>'longitude' is not null
    and payload->>'latitude' <> ''
    and payload->>'longitude' <> '';
