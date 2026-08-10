from pathlib import Path

ranking_path = Path('app/contact-district-ranking.tsx')
ranking = ranking_path.read_text(encoding='utf-8')
ranking_original = ranking

needle = '''  const visibleRows = showAll ? rows : rows.slice(0, 12);\n  const maxTotal = Math.max(1, ranked[0]?.total || 0);\n  const reached = districts.filter((item) => item.total > 0).length;\n'''
replacement = '''  const visibleRows = showAll ? rows : rows.slice(0, 12);\n  const maxTotal = Math.max(1, ranked[0]?.total || 0);\n  const reached = districts.filter((item) => item.total > 0).length;\n\n  const openDistrict = (district: string) => {\n    window.dispatchEvent(\n      new CustomEvent("voto-forte:filter-district-contacts", {\n        detail: { district },\n      }),\n    );\n    switchMobileSection("contacts");\n  };\n'''
if needle not in ranking:
    raise SystemExit('Ponto de insercao do openDistrict nao encontrado')
ranking = ranking.replace(needle, replacement, 1)

old_li = '''              <li key={item.district} className={item.total === 0 ? "is-empty" : undefined}>\n                <span className="district-name">\n                  <span>{item.district}</span>\n                  <span className="district-bar" aria-hidden="true">\n                    <i\n                      style={{\n                        width: `${item.total ? Math.max((item.total / maxTotal) * 100, 4) : 0}%`,\n                      }}\n                    />\n                  </span>\n                </span>\n                <b>{item.total.toLocaleString("pt-BR")}</b>\n              </li>'''
new_li = '''              <li key={item.district} className={item.total === 0 ? "is-empty" : undefined}>\n                <button\n                  type="button"\n                  className="district-row-button"\n                  disabled={item.total <= 0}\n                  onClick={() => openDistrict(item.district)}\n                  title={`Abrir contatos de ${item.district}`}\n                >\n                  <span className="district-name">\n                    <span>{item.district}</span>\n                    <span className="district-bar" aria-hidden="true">\n                      <i\n                        style={{\n                          width: `${item.total ? Math.max((item.total / maxTotal) * 100, 4) : 0}%`,\n                        }}\n                      />\n                    </span>\n                  </span>\n                  <b>{item.total.toLocaleString("pt-BR")}</b>\n                </button>\n              </li>'''
if old_li not in ranking:
    raise SystemExit('Linha de bairro nao encontrada')
ranking = ranking.replace(old_li, new_li, 1)
ranking_path.write_text(ranking, encoding='utf-8')

panel_path = Path('app/neutral-dashboard-client.tsx')
panel = panel_path.read_text(encoding='utf-8')
panel_original = panel

panel = panel.replace(
'''  const [profile, setProfile] = useState("");\n  const [loadingSummary, setLoadingSummary] = useState(true);''',
'''  const [profile, setProfile] = useState("");\n  const [districtFilter, setDistrictFilter] = useState("");\n  const [loadingSummary, setLoadingSummary] = useState(true);''',
1,
)

panel = panel.replace(
'''      if (query) params.set("q", query);\n      if (profile) params.set("profile", profile);''',
'''      if (query) params.set("q", query);\n      if (profile) params.set("profile", profile);\n      if (districtFilter) params.set("district", districtFilter);''',
1,
)

panel = panel.replace(
'''  }, [page, profile, query, scope]);''',
'''  }, [districtFilter, page, profile, query, scope]);''',
1,
)

insert_after = '''  useEffect(() => {\n    void loadContacts();\n  }, [loadContacts]);\n'''
insert_block = '''  useEffect(() => {\n    void loadContacts();\n  }, [loadContacts]);\n\n  useEffect(() => {\n    const handleDistrictFilter = (event: Event) => {\n      const district = String(\n        (event as CustomEvent<{ district?: string }>).detail?.district || "",\n      ).trim();\n      if (!district) return;\n      setPage(1);\n      setQueryInput("");\n      setQuery("");\n      setProfile("");\n      setDistrictFilter(district);\n      window.requestAnimationFrame(() => {\n        document.querySelector<HTMLElement>(".contacts-panel")?.scrollIntoView({\n          behavior: "smooth",\n          block: "start",\n        });\n      });\n    };\n    window.addEventListener(\n      "voto-forte:filter-district-contacts",\n      handleDistrictFilter,\n    );\n    return () =>\n      window.removeEventListener(\n        "voto-forte:filter-district-contacts",\n        handleDistrictFilter,\n      );\n  }, []);\n'''
if insert_after not in panel:
    raise SystemExit('Ponto de insercao do listener nao encontrado')
panel = panel.replace(insert_after, insert_block, 1)

panel = panel.replace(
'''  const hasFilters = Boolean(queryInput.trim() || query || profile);''',
'''  const hasFilters = Boolean(\n    queryInput.trim() || query || profile || districtFilter,\n  );''',
1,
)

panel = panel.replace(
'''    setProfile("");\n    setPage(1);\n  }''',
'''    setProfile("");\n    setDistrictFilter("");\n    setPage(1);\n  }''',
1,
)

panel = panel.replace(
'''          <div className="optimized-filters is-open">''',
'''          {districtFilter && (\n            <div className="optimized-active-district" role="status">\n              <span>Bairro: <b>{districtFilter}</b></span>\n              <button type="button" onClick={() => { setDistrictFilter(""); setPage(1); }}>\n                Ver todos os bairros\n              </button>\n            </div>\n          )}\n\n          <div className="optimized-filters is-open">''',
1,
)

for token in (
    'voto-forte:filter-district-contacts',
    'params.set("district", districtFilter)',
    'setDistrictFilter("")',
    'Bairro:',
    'onClick={() => setEditing(contact)}',
):
    if token not in panel:
        raise SystemExit(f'Validacao painel ausente: {token}')
for token in (
    'voto-forte:filter-district-contacts',
    'onClick={() => openDistrict(item.district)}',
    'district-row-button',
):
    if token not in ranking:
        raise SystemExit(f'Validacao ranking ausente: {token}')
if panel == panel_original or ranking == ranking_original:
    raise SystemExit('Alteracoes incompletas')
panel_path.write_text(panel, encoding='utf-8')
print('Atalho de bairros para contatos aplicado.')

# redisparo depois do workflow estar registrado
