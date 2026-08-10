from pathlib import Path

path = Path('app/dashboard-client.tsx')
text = path.read_text(encoding='utf-8')
original = text

text = text.replace(
'''      districtFilter={contactDistrictFilter}\n      setDistrictFilter={setContactDistrictFilter}\n      tell={setNotice}''',
'''      districtFilter={contactDistrictFilter}\n      setDistrictFilter={setContactDistrictFilter}\n      scope={scope}\n      tell={setNotice}''',
1,
)

text = text.replace(
'''  districtFilter,\n  setDistrictFilter,\n  tell,''',
'''  districtFilter,\n  setDistrictFilter,\n  scope,\n  tell,''',
1,
)

text = text.replace(
'''  districtFilter: string;\n  setDistrictFilter: (district: string) => void;\n  tell: (s: string) => void;''',
'''  districtFilter: string;\n  setDistrictFilter: (district: string) => void;\n  scope: string;\n  tell: (s: string) => void;''',
1,
)

old_block = '''  const [preview, setPreview] = useState<Contact[]>([]),\n    [saving, setSaving] = useState(false),\n    [query, setQuery] = useState(""),\n    [editing, setEditing] = useState<\n      (Contact & { id: number; ownerEmail: string }) | null\n    >(null);\n  const profileContacts =\n    filter === "Todos" ? contacts : contacts.filter((c) => c.kind === filter);\n  const filteredContacts = districtFilter\n    ? profileContacts.filter(\n        (c) => c.district.trim().toLocaleLowerCase("pt-BR") === districtFilter.trim().toLocaleLowerCase("pt-BR"),\n      )\n    : profileContacts;\n  const list = filteredContacts.filter((c) =>\n    `${c.name} ${c.phone} ${c.district} ${c.ownerEmail}`\n      .toLowerCase()\n      .includes(query.toLowerCase()),\n  );'''

new_block = '''  const [preview, setPreview] = useState<Contact[]>([]),\n    [saving, setSaving] = useState(false),\n    [query, setQuery] = useState(""),\n    [editing, setEditing] = useState<\n      (Contact & { id: number; ownerEmail: string }) | null\n    >(null);\n  const [districtContacts, setDistrictContacts] = useState<\n    (Contact & { id: number; ownerEmail: string })[]\n  >([]);\n  const [districtTotal, setDistrictTotal] = useState(0);\n  const [districtPage, setDistrictPage] = useState(1);\n  const [districtTotalPages, setDistrictTotalPages] = useState(1);\n  const [districtLoading, setDistrictLoading] = useState(false);\n\n  useEffect(() => {\n    setDistrictPage(1);\n  }, [districtFilter, filter, scope]);\n\n  useEffect(() => {\n    if (!districtFilter) {\n      setDistrictContacts([]);\n      setDistrictTotal(0);\n      setDistrictTotalPages(1);\n      setDistrictLoading(false);\n      return;\n    }\n    let cancelled = false;\n    setDistrictLoading(true);\n    const timer = window.setTimeout(() => {\n      const params = new URLSearchParams({\n        owner: scope,\n        district: districtFilter,\n        page: String(districtPage),\n        pageSize: "100",\n      });\n      if (filter === "Eleitor" || filter === "Liderança")\n        params.set("profile", filter);\n      if (query.trim()) params.set("q", query.trim());\n      apiFetch(`/api/contacts?${params.toString()}`, { cache: "no-store" })\n        .then(async (response) => ({ response, data: await response.json() }))\n        .then(({ response, data }) => {\n          if (cancelled) return;\n          if (!response.ok) throw new Error(data.error || "Não foi possível carregar os contatos do bairro.");\n          setDistrictContacts(Array.isArray(data.contacts) ? data.contacts : []);\n          setDistrictTotal(Number(data.total || 0));\n          setDistrictTotalPages(Math.max(1, Number(data.totalPages || 1)));\n        })\n        .catch((error) => {\n          if (!cancelled) {\n            setDistrictContacts([]);\n            setDistrictTotal(0);\n            setDistrictTotalPages(1);\n            tell(error instanceof Error ? error.message : "Não foi possível carregar os contatos do bairro.");\n          }\n        })\n        .finally(() => {\n          if (!cancelled) setDistrictLoading(false);\n        });\n    }, 180);\n    return () => {\n      cancelled = true;\n      window.clearTimeout(timer);\n    };\n  }, [districtFilter, filter, scope, query, districtPage, tell]);\n\n  const profileContacts =\n    filter === "Todos" ? contacts : contacts.filter((c) => c.kind === filter);\n  const filteredContacts = districtFilter ? districtContacts : profileContacts;\n  const list = districtFilter\n    ? filteredContacts\n    : filteredContacts.filter((c) =>\n        `${c.name} ${c.phone} ${c.district} ${c.ownerEmail}`\n          .toLowerCase()\n          .includes(query.toLowerCase()),\n      );'''

if old_block not in text:
    raise SystemExit('Bloco principal do ContactManager nao encontrado')
text = text.replace(old_block, new_block, 1)

text = text.replace(
'''            Bairro selecionado: <b>{districtFilter}</b> · {filteredContacts.length} contato(s)''',
'''            Bairro selecionado: <b>{districtFilter}</b> · {districtLoading ? "carregando…" : `${districtTotal} contato(s)`}''',
1,
)

old_end = '''          {!list.length && (\n            <p className="empty-state">Nenhum contato encontrado.</p>\n          )}\n        </div>\n      </article>'''
new_end = '''          {!districtLoading && !list.length && (\n            <p className="empty-state">Nenhum contato encontrado.</p>\n          )}\n          {districtLoading && (\n            <p className="empty-state">Carregando contatos deste bairro…</p>\n          )}\n        </div>\n        {districtFilter && districtTotalPages > 1 && (\n          <div className="import-actions">\n            <button\n              type="button"\n              disabled={districtPage <= 1 || districtLoading}\n              onClick={() => setDistrictPage((page) => Math.max(1, page - 1))}\n            >\n              Página anterior\n            </button>\n            <span>\n              Página {districtPage} de {districtTotalPages} · {districtTotal} contato(s)\n            </span>\n            <button\n              type="button"\n              disabled={districtPage >= districtTotalPages || districtLoading}\n              onClick={() => setDistrictPage((page) => Math.min(districtTotalPages, page + 1))}\n            >\n              Próxima página\n            </button>\n          </div>\n        )}\n      </article>'''

if old_end not in text:
    raise SystemExit('Final da tabela de contatos nao encontrado')
text = text.replace(old_end, new_end, 1)

for token in (
    'scope={scope}',
    'districtContacts',
    '/api/contacts?',
    'districtTotal',
    'Página anterior',
    'Próxima página',
):
    if token not in text:
        raise SystemExit(f'Validacao ausente: {token}')

if text == original:
    raise SystemExit('Nenhuma alteracao foi produzida')

path.write_text(text, encoding='utf-8')
print('Navegacao do mapa para contatos territoriais completos aplicada.')

# redisparo intencional depois do workflow estar registrado
