insert into public.vf_arapongas_district_aliases (alias_key, canonical_name, active, updated_at)
values
  ('AEROPORTO', 'Jardim Aeroporto', true, now()),
  ('APARECIDA', 'Vila Aparecida', true, now()),
  ('BANDEIRANTES', 'Jardim Bandeirantes', true, now()),
  ('CENTAURO', 'Conjunto Centauro', true, now()),
  ('FLAMINGOS III', 'Conjunto Flamingos III', true, now()),
  ('J INTERLAGOS', 'Jardim Interlagos', true, now()),
  ('MTE CARLO', 'Jardim Monte Carlo', true, now()),
  ('P INDUSTRIAL II', 'Parque Industrial II', true, now()),
  ('PALMARES', 'Conjunto Palmares', true, now()),
  ('S JOSE', 'Vila São José', true, now()),
  ('SAN PABLO', 'Jardim San Pablo', true, now()),
  ('U GUIMARAES', 'Conjunto Ulisses Guimarães', true, now()),
  ('V APARECIDA', 'Vila Aparecida', true, now()),
  ('V INDUST', 'Vila Industrial', true, now()),
  ('V SAMPAIO', 'Vila Sampaio', true, now())
on conflict (alias_key) do nothing;

select * from public.vf_refresh_arapongas_district_summary();
select * from public.vf_refresh_contact_location_issues();
