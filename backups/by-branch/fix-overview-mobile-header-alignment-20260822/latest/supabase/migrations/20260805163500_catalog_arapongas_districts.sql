begin;

create table if not exists public.vf_arapongas_district_aliases (
  alias_key text primary key,
  canonical_name text not null,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

truncate table public.vf_arapongas_district_aliases;

insert into public.vf_arapongas_district_aliases (alias_key, canonical_name)
values
('ARAPONGUINHA', 'Vila Araponguinha'),
('ARAUCARIA', 'Residencial Araucárias'),
('ARAUCARIA II', 'Residencial Araucárias II'),
('ARICANDUVA', 'Aricanduva'),
('ARICANDUVAS', 'Aricanduva'),
('ARINCANDUVA', 'Aricanduva'),
('C RES ULIANA', 'Conjunto Residencial Uliana'),
('CAIS P BERNARDO MERCKEL', 'Conjunto Padre Bernardo Merckel'),
('CAMPINHO', 'Campinho'),
('CARPE DIEM', 'Carpe Diem'),
('CASA FAMILIA APS IV', 'Casa Família Arapongas IV'),
('CASA FAMILIA ARAPONG', 'Casa Família Arapongas IV'),
('CASA FAMILIA ARAPONGAS I', 'Casa Família Arapongas I'),
('CASA FAMILIA ARAPONGAS II', 'Casa Família Arapongas II'),
('CASA FAMILIA ARAPONGAS IV', 'Casa Família Arapongas IV'),
('CENTRO', 'Centro'),
('COLUMBIA III', 'Jardim Colúmbia III'),
('CONDOMINIO RESIDENCIAL ITALIAN VILLE', 'Condomínio Residencial Italian Ville'),
('CONJUNTO AGUIAS', 'Conjunto Águias'),
('CONJUNTO BUSSADORI', 'Conjunto Bussadori'),
('CONJUNTO CENTAURO', 'Conjunto Centauro'),
('CONJUNTO DEL CONDOR', 'Conjunto Del Condor'),
('CONJUNTO FLAMIN', 'Conjunto Flamingos'),
('CONJUNTO FLAMINGOS', 'Conjunto Flamingos'),
('CONJUNTO FLAMINGOS III', 'Conjunto Flamingos III'),
('CONJUNTO MARIO REZENDE', 'Conjunto Mário Rezende'),
('CONJUNTO NOVO C', 'Conjunto Novo Centauro'),
('CONJUNTO NOVO CENTA', 'Conjunto Novo Centauro'),
('CONJUNTO NOVO CENTAU', 'Conjunto Novo Centauro'),
('CONJUNTO NOVO CENTAURO', 'Conjunto Novo Centauro'),
('CONJUNTO NOVO CENTAURO II', 'Conjunto Novo Centauro II'),
('CONJUNTO NS DAS GRACAS', 'Conjunto Nossa Senhora das Graças'),
('CONJUNTO PALMAR', 'Conjunto Palmares'),
('CONJUNTO PALMARES', 'Conjunto Palmares'),
('CONJUNTO PE BERNA', 'Conjunto Padre Bernardo Merckel'),
('CONJUNTO PE BERNARDO MERCKEL', 'Conjunto Padre Bernardo Merckel'),
('CONJUNTO PE CHICO', 'Conjunto Padre Chico'),
('CONJUNTO RESIDENCIAL PIACENZA', 'Conjunto Residencial Piacenza'),
('CONJUNTO TROPIC', 'Conjunto Tropical'),
('CONJUNTO TROPICAL', 'Conjunto Tropical'),
('CONJUNTO U GUIMARAES', 'Conjunto Ulisses Guimarães'),
('CONJUNTO ULISSES GUIMARAES', 'Conjunto Ulisses Guimarães'),
('D MARTINHA', 'Jardim Dona Martinha'),
('FLAMINGO TRES A P', 'Conjunto Flamingos III'),
('GL ARAPONGAS', 'Gleba Arapongas'),
('GL P ARAPONGAS', 'Gleba Arapongas'),
('GL RIBEIRAO BANDEIRANTES DO NORTE', 'Gleba Ribeirão Bandeirantes do Norte'),
('GOLDEN GARDEN RESIDENCE CONDOMINIO', 'Golden Garden Residence Condomínio'),
('ITALIAN VILLE', 'Condomínio Residencial Italian Ville'),
('J BANDEIRANTES', 'Jardim Bandeirantes'),
('J DO CAFE', 'Jardim do Café'),
('JARDIM AEROPORT', 'Jardim Aeroporto'),
('JARDIM AEROPORTO', 'Jardim Aeroporto'),
('JARDIM ALTO DA BOA VISTA', 'Jardim Alto da Boa Vista'),
('JARDIM ALVORADA', 'Jardim Alvorada'),
('JARDIM ARAPONGAS', 'Jardim Arapongas'),
('JARDIM ASTURIAS', 'Jardim Astúrias'),
('JARDIM BANDEIRANTE', 'Jardim Bandeirantes'),
('JARDIM BANDEIRANTES', 'Jardim Bandeirantes'),
('JARDIM BARONEZA', 'Jardim Baroneza'),
('JARDIM BELA VISTA', 'Jardim Bela Vista'),
('JARDIM BONONI', 'Jardim Bononi'),
('JARDIM BRA', 'Jardim Brasil'),
('JARDIM BRASIL', 'Jardim Brasil'),
('JARDIM CARAVELE', 'Jardim Caravelle'),
('JARDIM CARAVELL', 'Jardim Caravelle'),
('JARDIM CARAVELLE', 'Jardim Caravelle'),
('JARDIM CARAVELLE II', 'Jardim Caravelle II'),
('JARDIM CASA BRANCA', 'Jardim Casa Branca'),
('JARDIM CASA GRANDE', 'Jardim Casa Grande'),
('JARDIM CASA GRANDE II', 'Jardim Casa Grande II'),
('JARDIM COLUMBIA', 'Jardim Colúmbia I'),
('JARDIM COLUMBIA 1', 'Jardim Colúmbia I'),
('JARDIM COLUMBIA I', 'Jardim Colúmbia I'),
('JARDIM COLUMBIA II', 'Jardim Colúmbia II'),
('JARDIM COLUMBIA III', 'Jardim Colúmbia III'),
('JARDIM COLUMBIA IV', 'Jardim Colúmbia IV'),
('JARDIM COROADOS', 'Jardim Coroados'),
('JARDIM CULTURA', 'Jardim Cultura'),
('JARDIM DO CAFE', 'Jardim do Café'),
('JARDIM DO CARMO', 'Jardim do Carmo'),
('JARDIM DO SOL', 'Jardim do Sol'),
('JARDIM DONA MAR', 'Jardim Dona Martinha'),
('JARDIM DONA MARTINHA', 'Jardim Dona Martinha'),
('JARDIM DONA PINA', 'Jardim Dona Pina'),
('JARDIM DOS PASSAROS', 'Jardim dos Pássaros'),
('JARDIM ELDORADO', 'Jardim Eldorado'),
('JARDIM EUROPA', 'Jardim Europa'),
('JARDIM FLAMINGOS', 'Conjunto Flamingos'),
('JARDIM HERMINIO E MARIA', 'Jardim Hermínio e Maria'),
('JARDIM IMPERIAL', 'Jardim Imperial'),
('JARDIM IMPERIO', 'Jardim Império'),
('JARDIM IMPERIO DO SOL', 'Jardim Império do Sol'),
('JARDIM INTERLAGOS', 'Jardim Interlagos'),
('JARDIM INTERLAGOS II', 'Jardim Interlagos II'),
('JARDIM LIBERDADE', 'Jardim Liberdade'),
('JARDIM LORENA', 'Jardim Lorena'),
('JARDIM MONACO', 'Jardim Mônaco'),
('JARDIM MONACO II', 'Jardim Mônaco II'),
('JARDIM MONTE CARLO', 'Jardim Monte Carlo'),
('JARDIM MONTE CARLO II', 'Jardim Monte Carlo II'),
('JARDIM MONTE CLARO', 'Jardim Monte Claro'),
('JARDIM MORUMBI', 'Jardim Morumbi'),
('JARDIM NOSSA SENHORA DO LORETO', 'Jardim Nossa Senhora do Loreto'),
('JARDIM NOVA BARONEZA', 'Jardim Nova Baroneza'),
('JARDIM NOVA BRA', 'Jardim Nova Baroneza'),
('JARDIM NOVO CENTAURO', 'Conjunto Novo Centauro'),
('JARDIM NOVO CENTAURO III', 'Conjunto Novo Centauro III'),
('JARDIM NOVO FLAMINGOS', 'Jardim Novo Flamingos'),
('JARDIM NOVO HORIZONTE', 'Jardim Novo Horizonte'),
('JARDIM NOVO IMPERIAL', 'Jardim Novo Imperial'),
('JARDIM ORIENTAL', 'Jardim Oriental'),
('JARDIM PANORAMA', 'Jardim Panorama'),
('JARDIM PARAISO', 'Jardim Paraíso'),
('JARDIM PARANA', 'Jardim Paraná'),
('JARDIM PAULINO FEDRIGO', 'Jardim Paulino Fedrigo'),
('JARDIM PAULISTA', 'Jardim Paulista'),
('JARDIM PAULISTA II', 'Jardim Paulista II'),
('JARDIM PE CHICO', 'Conjunto Padre Chico'),
('JARDIM PETROPOL', 'Jardim Petrópolis'),
('JARDIM PETROPOLIS', 'Jardim Petrópolis'),
('JARDIM PLANALTO', 'Jardim Planalto'),
('JARDIM PORTAL DAS FLORES', 'Jardim Portal das Flores'),
('JARDIM PORTAL DAS FLORES II', 'Jardim Portal das Flores II'),
('JARDIM PRIMAVERA', 'Jardim Primavera'),
('JARDIM QUEBEC', 'Jardim Quebec'),
('JARDIM S BENTO', 'Jardim São Bento'),
('JARDIM S CARLOS', 'Jardim São Carlos'),
('JARDIM S CRISTOVAO', 'Jardim São Cristóvão'),
('JARDIM S RAFAEL', 'Jardim San Raphael'),
('JARDIM S RAFAEL II', 'Jardim San Raphael II'),
('JARDIM SAN PABLO', 'Jardim San Pablo'),
('JARDIM SAN RAFAEL', 'Jardim San Raphael'),
('JARDIM SAN RAFAEL II', 'Jardim San Raphael II'),
('JARDIM SAN RAFAEL III', 'Jardim San Raphael III'),
('JARDIM SAN RAFAEL IV', 'Jardim San Raphael IV'),
('JARDIM SAN RAPHAEL V', 'Jardim San Raphael V'),
('JARDIM SAN RAPHAEL VI', 'Jardim San Raphael VI'),
('JARDIM STA ALICE', 'Jardim Santa Alice'),
('JARDIM STA ANA', 'Jardim Santa Ana'),
('JARDIM STA EFIGENIA', 'Jardim Santa Efigênia'),
('JARDIM STO ANTONIO', 'Jardim Santo Antônio'),
('JARDIM TROPICAL', 'Jardim Tropical'),
('JARDIM TROPICAL II', 'Jardim Tropical II'),
('JARDIM UNIV', 'Jardim Universitário'),
('JARDIM UNIVERSI', 'Jardim Universitário'),
('JARDIM UNIVERSIDADE', 'Jardim Universitário'),
('JARDIM UNIVERSITARI', 'Jardim Universitário'),
('JARDIM UNIVERSITARIO', 'Jardim Universitário'),
('JARDIM VALE DAS', 'Jardim Vale das Perobas'),
('JARDIM VALE DAS PERO', 'Jardim Vale das Perobas'),
('JARDIM VALE DAS PEROBAS', 'Jardim Vale das Perobas'),
('JARDIM VALE DAS PEROBAS II', 'Jardim Vale das Perobas II'),
('JARDIM VALE DAS PEROBAS III', 'Jardim Vale das Perobas III'),
('JDM BANDEIRANTES', 'Jardim Bandeirantes'),
('LISBOA GARDEM', 'Lisboa Garden'),
('NOVO CENTAURO', 'Conjunto Novo Centauro'),
('NOVO CENTAURO II', 'Conjunto Novo Centauro II'),
('OURO FINO', 'Residencial Ouro Fino'),
('PE BERNARDO', 'Conjunto Padre Bernardo Merckel'),
('PQINDUS2RESOUROF', 'Parque Industrial II'),
('PRQ IND', 'Parque Industrial'),
('PRQ IND II', 'Parque Industrial II'),
('PRQ INDUST ARAUCARIA', 'Parque Industrial Araucária'),
('PRQ INDUST I', 'Parque Industrial I'),
('PRQ INDUST II', 'Parque Industrial II'),
('PRQ INDUST III', 'Parque Industrial III'),
('PRQ INDUST IV', 'Parque Industrial IV'),
('PRQ INDUST SAO PAULO', 'Parque Industrial São Paulo'),
('PRQ INDUST V', 'Parque Industrial V'),
('PRQ INDUSTRIAL', 'Parque Industrial'),
('PRQ INUSTRIAL II', 'Parque Industrial II'),
('PRQ MONTERREY', 'Parque Monterrey'),
('PRQ PION WIELEWIK', 'Parque Pioneiro Wielewik'),
('PRQ SIOMARA', 'Parque Siomara'),
('PRQ VENEZA', 'Parque Veneza'),
('RESIDENCIAL ARAPONGAS III', 'Residencial Arapongas III'),
('RESIDENCIAL ARAUCARI', 'Residencial Araucárias'),
('RESIDENCIAL ARAUCARIAS', 'Residencial Araucárias'),
('RESIDENCIAL ARAUCARIAS I', 'Residencial Araucárias I'),
('RESIDENCIAL BELLA MORADA', 'Residencial Bella Morada'),
('RESIDENCIAL OURO FINO', 'Residencial Ouro Fino'),
('RESIDENCIAL TEREZA MORCIANI BONONI', 'Residencial Tereza Morciani Bononi'),
('RESIDENCIAL TOZZI', 'Residencial Tozzi'),
('S BENTO', 'Jardim São Bento'),
('V ARAPONGUINHA', 'Vila Araponguinha'),
('V ARAPONGUINHAS', 'Vila Araponguinha'),
('VILA APARECIDA', 'Vila Aparecida'),
('VILA ARAPONGUINHA', 'Vila Araponguinha'),
('VILA ARAPONGUINHAS', 'Vila Araponguinha'),
('VILA ARATIMBO', 'Vila Aratimbo'),
('VILA AYMORE', 'Vila Aymoré'),
('VILA BERNARDES', 'Vila Bernardes'),
('VILA BRASIL', 'Vila Brasil'),
('VILA CASCATA', 'Vila Cascata'),
('VILA CASTELO', 'Vila Castelo'),
('VILA COELHO', 'Vila Coelho'),
('VILA CONCEICAO', 'Vila Conceição'),
('VILA DALVA', 'Vila Dalva'),
('VILA DAS PEROBAS', 'Jardim Vale das Perobas'),
('VILA DOMINGOS', 'Vila Domingos'),
('VILA EDIO', 'Vila Édio'),
('VILA ESTRELA', 'Vila Estrela'),
('VILA EVERESTE', 'Vila Evereste'),
('VILA FORTUNATO', 'Vila Fortunato'),
('VILA I NDUSTRIAL', 'Vila Industrial'),
('VILA IGUACU', 'Vila Iguaçu'),
('VILA INDUST', 'Vila Industrial'),
('VILA INDUSTRIAL', 'Vila Industrial'),
('VILA LUGRANDI', 'Vila Lugrandi'),
('VILA NATAL', 'Vila Natal'),
('VILA NOVA', 'Vila Nova'),
('VILA PASSOS', 'Vila Passos'),
('VILA PAULO', 'Vila Paulo'),
('VILA RUGNA', 'Vila Rugna'),
('VILA RURAL', 'Vila Rural'),
('VILA S JOAO', 'Vila São João'),
('VILA S JORGE', 'Vila São Jorge'),
('VILA S JOSE', 'Vila São José'),
('VILA S LAZARO', 'Vila São Lázaro'),
('VILA S VICENTE', 'Vila São Vicente'),
('VILA SAMPAIO', 'Vila Sampaio'),
('VILA TRIANGULO', 'Vila Triângulo'),
('VILA TRINTA E TRES', 'Vila Trinta e Três'),
('VILA VICENTINI', 'Vila Vicentini'),
('VILA ZANIN', 'Vila Zanin'),
('VLE DAS PEROBAS II', 'Jardim Vale das Perobas II');

create or replace function public.vf_canonical_arapongas_district(value text)
returns text
language sql
stable
security invoker
set search_path = public
as $$
  select a.canonical_name
  from public.vf_arapongas_district_aliases a
  where a.alias_key = public.vf_normalize_arapongas_district(value)
    and a.active = true
  limit 1;
$$;

create or replace function public.vf_contact_dashboard_summary(p_owner_emails text[])
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with contacts_all as (
    select coalesce(payload->>'kind', 'Eleitor') as profile
    from public.vf_owned_records
    where kind = 'contact'
      and owner_email = any(p_owner_emails)
  ),
  contacts_arapongas as (
    select public.vf_canonical_arapongas_district(payload->>'district') as district_name
    from public.vf_owned_records
    where kind = 'contact'
      and owner_email = any(p_owner_emails)
      and (
        coalesce(trim(payload->>'city'), '') = ''
        or upper(unaccent(trim(payload->>'city'))) = 'ARAPONGAS'
      )
  ),
  district_counts as (
    select district_name, count(*)::bigint as total
    from contacts_arapongas
    where district_name is not null
    group by district_name
  ),
  contact_totals as (
    select
      count(*)::bigint as total,
      count(*) filter (where profile = 'Eleitor')::bigint as voters,
      count(*) filter (where profile = 'Liderança')::bigint as leaders
    from contacts_all
  ),
  district_totals as (
    select count(*)::bigint as districts_reached
    from district_counts
  ),
  meeting_totals as (
    select count(*)::bigint as meetings
    from public.vf_owned_records
    where kind = 'meeting'
      and owner_email = any(p_owner_emails)
  )
  select jsonb_build_object(
    'total', contact_totals.total,
    'voters', contact_totals.voters,
    'leaders', contact_totals.leaders,
    'meetings', meeting_totals.meetings,
    'districtsReached', district_totals.districts_reached,
    'districts', coalesce((
      select jsonb_agg(
        jsonb_build_object('district', district_name, 'total', total)
        order by total desc, district_name asc
      )
      from district_counts
    ), '[]'::jsonb)
  )
  from contact_totals
  cross join district_totals
  cross join meeting_totals;
$$;

commit;
