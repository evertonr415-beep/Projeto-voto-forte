from pathlib import Path
import re

DASHBOARD = Path("app/dashboard-client.tsx")
FULL_PAGE = Path("app/sistema-completo/page.tsx")

text = DASHBOARD.read_text(encoding="utf-8")
original = text

before_city_maps = text.count("<CityMap contacts={contacts} />")
if before_city_maps != 2:
    raise SystemExit(f"Esperava 2 usos de CityMap antes da alteracao; encontrei {before_city_maps}")

pattern = re.compile(
    r'\n        <article className="panel territorial">.*?\n        </article>\n        <article className="panel agenda-summary">',
    re.S,
)
text, count = pattern.subn(
    '\n        <article className="panel agenda-summary">',
    text,
    count=1,
)
if count != 1:
    raise SystemExit("Nao foi possivel remover exatamente um bloco territorial da Visao Geral")

if 'className="panel territorial"' in text:
    raise SystemExit("O bloco territorial ainda existe no dashboard")
if 'title="Presença territorial"' in text:
    raise SystemExit("O titulo Presenca territorial ainda existe na Visao Geral")

map_page_index = text.find("function MapPage")
if map_page_index == -1:
    raise SystemExit("MapPage nao encontrado")
map_city_index = text.find("<CityMap contacts={contacts} />", map_page_index)
if map_city_index == -1:
    raise SystemExit("CityMap da aba Mapa Eleitoral foi removido indevidamente")

if text.count("<CityMap contacts={contacts} />") != 1:
    raise SystemExit("Deve restar exatamente um CityMap, exclusivo do Mapa Eleitoral")

if text == original:
    raise SystemExit("Nenhuma alteracao foi produzida no dashboard")

DASHBOARD.write_text(text, encoding="utf-8")

FULL_PAGE.write_text(
    'import AuthClient from "../auth-client";\n\n'
    'export default function FullSystemPage() {\n'
    '  return <AuthClient />;\n'
    '}\n',
    encoding="utf-8",
)

print("Mapa territorial removido estruturalmente da Visao Geral; Mapa Eleitoral preservado.")
