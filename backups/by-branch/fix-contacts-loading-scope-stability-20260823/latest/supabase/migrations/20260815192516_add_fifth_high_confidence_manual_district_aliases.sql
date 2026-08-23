insert into public.vf_arapongas_district_aliases (alias_key, canonical_name, active, updated_at)
values
  ('JARDIM S RAFAEL III','Jardim San Raphael III',true,now()),
  ('JARDIM SAN RAFHAEL','Jardim San Raphael',true,now()),
  ('JARDIM SAN RAPHAEL','Jardim San Raphael',true,now()),
  ('JARDIM SAN RAPHAEL III','Jardim San Raphael III',true,now()),
  ('JARDIM SANRAPHAEL','Jardim San Raphael',true,now()),
  ('SAN RAPHAEL II','Jardim San Raphael II',true,now()),
  ('JDIM COLUMBIA III','Jardim Colúmbia III',true,now()),
  ('JDIM LORENA','Jardim Lorena',true,now()),
  ('JRDM COROADOS','Jardim Coroados',true,now()),
  ('MORCIANI BONONI','Residencial Tereza Morciani Bononi',true,now()),
  ('MTE CARLO II','Jardim Monte Carlo II',true,now()),
  ('MTE CARLOS II','Jardim Monte Carlo II',true,now()),
  ('RESIDENCIAL TEREZA M','Residencial Tereza Morciani Bononi',true,now())
on conflict (alias_key) do nothing;

select * from public.vf_refresh_arapongas_district_summary();
select * from public.vf_refresh_contact_location_issues();