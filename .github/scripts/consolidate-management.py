from pathlib import Path
import re

path = Path("app/dashboard-client.tsx")
text = path.read_text(encoding="utf-8")
original = text


def replace_once(old: str, new: str, label: str) -> None:
    global text
    if old not in text:
        raise SystemExit(f"Trecho não encontrado: {label}")
    text = text.replace(old, new, 1)


replace_once('  | "Gestão"\n', '', 'tipo View Gestão')
replace_once('  { label: "Gestão", icon: "♜" },\n', '', 'item Gestão no menu')
replace_once(
    '  if (nextView === "Gestão") setContactFilter("Todos");\n',
    '  if (nextView === "Contatos") setContactFilter("Todos");\n',
    'reset de filtro ao navegar para Contatos',
)
replace_once(
    '  const openVoterReport = () => {\n    setContactFilter("Eleitor");\n    setView("Gestão");\n  };',
    '  const openVoterReport = () => {\n    setContactFilter("Eleitor");\n    setView("Contatos");\n  };',
    'atalho de eleitores',
)

text, count = re.subn(
    r'\n  \) : view === "Gestão" \? \(\n    <Management\n      contacts=\{contacts\}\n      open=\{setModal\}\n      filter=\{contactFilter\}\n      setFilter=\{setContactFilter\}\n    />\n  \) : view === "Contatos" \? \(\n',
    '\n  ) : view === "Contatos" ? (\n',
    text,
    count=1,
)
if count != 1:
    raise SystemExit('Não foi possível remover o branch de Gestão')

replace_once(
    '    <ContactManager\n      contacts={contacts}\n      tell={setNotice}\n',
    '    <ContactManager\n      contacts={contacts}\n      open={setModal}\n      filter={contactFilter}\n      setFilter={setContactFilter}\n      tell={setNotice}\n',
    'props de Contatos no dashboard',
)

replace_once(
    'function ContactManager({\n  contacts,\n  tell,\n',
    'function ContactManager({\n  contacts,\n  open,\n  filter,\n  setFilter,\n  tell,\n',
    'assinatura do ContactManager',
)
replace_once(
    '  contacts: (Contact & { id: number; ownerEmail: string })[];\n  tell: (s: string) => void;\n',
    '  contacts: (Contact & { id: number; ownerEmail: string })[];\n  open: (m: Modal) => void;\n  filter: Contact["kind"] | "Todos";\n  setFilter: (filter: Contact["kind"] | "Todos") => void;\n  tell: (s: string) => void;\n',
    'tipos do ContactManager',
)
replace_once(
    '  const list = contacts.filter((c) =>\n    `${c.name} ${c.phone} ${c.district} ${c.ownerEmail}`\n      .toLowerCase()\n      .includes(query.toLowerCase()),\n  );\n',
    '  const filteredContacts =\n    filter === "Todos" ? contacts : contacts.filter((c) => c.kind === filter);\n  const list = filteredContacts.filter((c) =>\n    `${c.name} ${c.phone} ${c.district} ${c.ownerEmail}`\n      .toLowerCase()\n      .includes(query.toLowerCase()),\n  );\n  const voters = contacts.filter((c) => c.kind === "Eleitor").length;\n  const leaders = contacts.filter((c) => c.kind === "Liderança").length;\n  const districts = new Set(\n    contacts.map((c) => c.district).filter(Boolean),\n  ).size;\n',
    'filtro e indicadores de Contatos',
)

old_head = '''      <PageHead
        eyebrow={
          isAdmin
            ? "CONTROLE ADMINISTRATIVO DE CONTATOS"
            : "MINHA BASE PRIVATIVA"
        }
        title="Gerenciamento de contatos"
        text={
          isAdmin
            ? "Consulte e gerencie contatos de todos os usuários no ambiente selecionado."
            : "Importe, edite e exporte somente os seus próprios contatos."
        }
      />
      <div className="contact-module-grid">'''

new_head = '''      <PageHead
        eyebrow={
          isAdmin
            ? "CONTROLE ADMINISTRATIVO DE CONTATOS"
            : "MINHA BASE PRIVATIVA"
        }
        title="Gerenciamento de contatos"
        text={
          isAdmin
            ? "Consulte e gerencie contatos de todos os usuários no ambiente selecionado."
            : "Importe, edite e exporte somente os seus próprios contatos."
        }
        action="+ Novo cadastro"
        onClick={() => open("cadastro")}
      />
      <div
        className="management-filter"
        role="group"
        aria-label="Filtrar contatos"
      >
        <button
          className={filter === "Todos" ? "active" : ""}
          onClick={() => setFilter("Todos")}
        >
          Todos
        </button>
        <button
          className={filter === "Eleitor" ? "active" : ""}
          onClick={() => setFilter("Eleitor")}
        >
          Eleitores
        </button>
        <button
          className={filter === "Liderança" ? "active" : ""}
          onClick={() => setFilter("Liderança")}
        >
          Lideranças
        </button>
      </div>
      <div className="summary-strip">
        <span>
          <b>{contacts.length}</b>Total de contatos
        </span>
        <span>
          <b>{voters}</b>Eleitores
        </span>
        <span>
          <b>{leaders}</b>Lideranças
        </span>
        <span>
          <b>{districts}</b>Bairros
        </span>
      </div>
      <div className="contact-module-grid">'''
replace_once(old_head, new_head, 'cabeçalho consolidado de Contatos')

text, count = re.subn(
    r'\nfunction Management\(\{.*?\nfunction Agenda\(\{',
    '\nfunction Agenda({',
    text,
    count=1,
    flags=re.S,
)
if count != 1:
    raise SystemExit('Não foi possível remover o componente Management')

for token in (
    '| "Gestão"',
    '{ label: "Gestão"',
    'view === "Gestão"',
    'function Management',
    'setView("Gestão")',
):
    if token in text:
        raise SystemExit(f'Referência residual encontrada: {token}')

for token in (
    'setView("Contatos")',
    'aria-label="Filtrar contatos"',
    'action="+ Novo cadastro"',
    '<b>{voters}</b>Eleitores',
    'filter={contactFilter}',
):
    if token not in text:
        raise SystemExit(f'Validação ausente: {token}')

if text == original:
    raise SystemExit('Nenhuma alteração foi produzida')

path.write_text(text, encoding="utf-8")
print('Consolidação aplicada com sucesso.')
