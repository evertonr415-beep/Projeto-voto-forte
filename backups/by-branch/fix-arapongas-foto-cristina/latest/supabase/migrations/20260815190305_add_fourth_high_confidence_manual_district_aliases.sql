insert into public.vf_arapongas_district_aliases (alias_key, canonical_name, active, updated_at)
values
  ('JDM AEROPORTO','Jardim Aeroporto',true,now()),
  ('JDM CARAVELE','Jardim Caravelle',true,now()),
  ('JDM PETROPOLIS','Jardim Petrópolis',true,now()),
  ('PE BERNARDO MERCKEL','Conjunto Padre Bernardo Merckel',true,now()),
  ('PE CHICO','Conjunto Padre Chico',true,now()),
  ('RESIDENCIAL ARAUCARIA','Residencial Araucárias',true,now()),
  ('S RAFAEL','Jardim San Raphael',true,now()),
  ('S RAFAEL II','Jardim San Raphael II',true,now()),
  ('SAN RAFAEL','Jardim San Raphael',true,now()),
  ('SAN RAFAEL II','Jardim San Raphael II',true,now()),
  ('JARDIM SAN RAFA','Jardim San Raphael',true,now()),
  ('STO ANTONIO','Jardim Santo Antônio',true,now())
on conflict (alias_key) do nothing;

select * from public.vf_refresh_arapongas_district_summary();
select * from public.vf_refresh_contact_location_issues();