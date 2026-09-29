insert into public.vf_arapongas_district_aliases (alias_key, canonical_name, active, updated_at)
values
  ('JARDIM DOS PASS','Jardim dos Pássaros',true,now()),
  ('JARDIM PARONESA','Jardim Baroneza',true,now()),
  ('JS SAO BENTO','Jardim São Bento',true,now()),
  ('P INDUST 3','Parque Industrial III',true,now()),
  ('PRQ IND 2','Parque Industrial II',true,now()),
  ('PRQ IND I','Parque Industrial I',true,now()),
  ('PRQ IND V','Parque Industrial V',true,now()),
  ('PRQ INDL II','Parque Industrial II',true,now()),
  ('PRQ INDL IV','Parque Industrial IV',true,now()),
  ('PRQ INDUSTRIAL2','Parque Industrial II',true,now()),
  ('PRQ INDUTRIAL III','Parque Industrial III',true,now()),
  ('PRQ VENEZAS','Parque Veneza',true,now()),
  ('RESD ARAUCARIAS I','Residencial Araucárias I',true,now())
on conflict (alias_key) do nothing;

select * from public.vf_refresh_arapongas_district_summary();
select * from public.vf_refresh_contact_location_issues();