insert into public.vf_arapongas_district_aliases (alias_key, canonical_name, active, updated_at)
values
  ('PRIMAVERA', 'Jardim Primavera', true, now()),
  ('TROPICAL', 'Conjunto Tropical', true, now()),
  ('ULISSES GUIMARAES', 'Conjunto Ulisses Guimarães', true, now()),
  ('SAMPAIO', 'Vila Sampaio', true, now()),
  ('SAO BENTO', 'Jardim São Bento', true, now()),
  ('BUSSADORI', 'Conjunto Bussadori', true, now()),
  ('COLUMBIA IV', 'Jardim Colúmbia IV', true, now()),
  ('DONA MARTINHA', 'Jardim Dona Martinha', true, now()),
  ('MARIO REZENDE', 'Conjunto Mário Rezende', true, now()),
  ('MORUMBI', 'Jardim Morumbi', true, now()),
  ('NOVO HORIZONTE', 'Jardim Novo Horizonte', true, now()),
  ('PANORAMA', 'Jardim Panorama', true, now()),
  ('J PRIMAVERA', 'Jardim Primavera', true, now()),
  ('V BERNARDES', 'Vila Bernardes', true, now()),
  ('V NOVA', 'Vila Nova', true, now()),
  ('J AEROPORTO', 'Jardim Aeroporto', true, now()),
  ('J BONONI', 'Jardim Bononi', true, now()),
  ('J PANORAMA', 'Jardim Panorama', true, now()),
  ('V EDIO', 'Vila Édio', true, now()),
  ('V NATAL', 'Vila Natal', true, now()),
  ('V TRIANGULO', 'Vila Triângulo', true, now())
on conflict (alias_key) do nothing;

select * from public.vf_refresh_arapongas_district_summary();
select * from public.vf_refresh_contact_location_issues();
