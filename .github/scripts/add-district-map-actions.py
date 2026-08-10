from pathlib import Path

DASH = Path('app/dashboard-client.tsx')
MAP = Path('app/map-territory-enhancer.tsx')

dash = DASH.read_text(encoding='utf-8')
mp = MAP.read_text(encoding='utf-8')


def repl(text, old, new, label):
    if old not in text:
        raise SystemExit(f'Trecho nao encontrado: {label}')
    return text.replace(old, new, 1)

# Dashboard: filtro territorial persistente e evento vindo do mapa.
dash = repl(
    dash,
    '''  const [contactFilter, setContactFilter] = useState<Contact["kind"] | "Todos">(\n    "Todos",\n  );''',
    '''  const [contactFilter, setContactFilter] = useState<Contact["kind"] | "Todos">(\n    "Todos",\n  );\n  const [contactDistrictFilter, setContactDistrictFilter] = useState("");''',
    'estado filtro bairro',
)

dash = repl(
    dash,
    '''  const closeMapPopup = () => {\n    window.dispatchEvent(new CustomEvent("voto-forte:close-map-popup"));\n  };''',
    '''  const closeMapPopup = () => {\n    window.dispatchEvent(new CustomEvent("voto-forte:close-map-popup"));\n  };\n\n  useEffect(() => {\n    const openDistrictContacts = (event: Event) => {\n      const district = String(\n        (event as CustomEvent<{ district?: string }>).detail?.district || "",\n      ).trim();\n      if (!district) return;\n      closeMapPopup();\n      setContactFilter("Todos");\n      setContactDistrictFilter(district);\n      setView("Contatos");\n      if (window.matchMedia("(max-width: 900px)").matches) setCollapsed(false);\n    };\n    window.addEventListener(\n      "voto-forte:open-district-contacts",\n      openDistrictContacts,\n    );\n    return () =>\n      window.removeEventListener(\n        "voto-forte:open-district-contacts",\n        openDistrictContacts,\n      );\n  }, []);''',
    'listener mapa contatos',
)

dash = repl(
    dash,
    '''  if (nextView === "Contatos") setContactFilter("Todos");''',
    '''  if (nextView === "Contatos") {\n    setContactFilter("Todos");\n    setContactDistrictFilter("");\n  }''',
    'reset filtros contatos',
)

dash = repl(
    dash,
    '''      setFilter={setContactFilter}\n      tell={setNotice}''',
    '''      setFilter={setContactFilter}\n      districtFilter={contactDistrictFilter}\n      setDistrictFilter={setContactDistrictFilter}\n      tell={setNotice}''',
    'props filtro bairro',
)

dash = repl(
    dash,
    '''  setFilter,\n  tell,''',
    '''  setFilter,\n  districtFilter,\n  setDistrictFilter,\n  tell,''',
    'args ContactManager',
)

dash = repl(
    dash,
    '''  setFilter: (filter: Contact["kind"] | "Todos") => void;\n  tell: (s: string) => void;''',
    '''  setFilter: (filter: Contact["kind"] | "Todos") => void;\n  districtFilter: string;\n  setDistrictFilter: (district: string) => void;\n  tell: (s: string) => void;''',
    'types filtro bairro',
)

dash = repl(
    dash,
    '''  const filteredContacts =\n    filter === "Todos" ? contacts : contacts.filter((c) => c.kind === filter);\n  const list = filteredContacts.filter((c) =>\n    `${c.name} ${c.phone} ${c.district} ${c.ownerEmail}`\n      .toLowerCase()\n      .includes(query.toLowerCase()),\n  );''',
    '''  const profileContacts =\n    filter === "Todos" ? contacts : contacts.filter((c) => c.kind === filter);\n  const filteredContacts = districtFilter\n    ? profileContacts.filter(\n        (c) => c.district.trim().toLocaleLowerCase("pt-BR") === districtFilter.trim().toLocaleLowerCase("pt-BR"),\n      )\n    : profileContacts;\n  const list = filteredContacts.filter((c) =>\n    `${c.name} ${c.phone} ${c.district} ${c.ownerEmail}`\n      .toLowerCase()\n      .includes(query.toLowerCase()),\n  );''',
    'aplicacao filtro bairro',
)

dash = repl(
    dash,
    '''      <div className="summary-strip">''',
    '''      {districtFilter && (\n        <div className="district-contact-filter" role="status">\n          <span>\n            Bairro selecionado: <b>{districtFilter}</b> · {filteredContacts.length} contato(s)\n          </span>\n          <button type="button" onClick={() => setDistrictFilter("")}>\n            Limpar bairro\n          </button>\n        </div>\n      )}\n      <div className="summary-strip">''',
    'banner filtro bairro',
)

# Mapa: permissao do Master.
mp = repl(
    mp,
    '''    let retryTimer: number | null = null;\n    let retryTimeout: number | null = null;\n    let cleanupActiveMap: (() => void) | null = null;''',
    '''    let retryTimer: number | null = null;\n    let retryTimeout: number | null = null;\n    let cleanupActiveMap: (() => void) | null = null;\n    let canManageReferences = false;\n    void apiFetch("/api/session")\n      .then(async (response) => ({ response, data: await response.json() }))\n      .then(({ response, data }) => {\n        if (response.ok) canManageReferences = data?.user?.role === "master";\n      })\n      .catch(() => undefined);''',
    'permissao master',
)

# CSS dos botoes do popup.
mp = repl(
    mp,
    '''    .vf-district-area-popup{min-width:195px;font:500 12px/1.4 Arial,sans-serif;color:#26384d}.vf-district-area-popup strong{display:block;color:#17345c;font-size:14px;margin-bottom:5px}.vf-district-area-popup b{display:inline-block;padding:3px 7px;border-radius:999px;background:#eaf2fb;color:#285b8e;font-size:10px}.vf-district-area-popup p{margin:6px 0 0}.vf-district-area-popup small{display:block;margin-top:7px;color:#64748b}''',
    '''    .vf-district-area-popup{min-width:210px;font:500 12px/1.4 Arial,sans-serif;color:#26384d}.vf-district-area-popup strong{display:block;color:#17345c;font-size:14px;margin-bottom:5px}.vf-district-area-popup b{display:inline-block;padding:3px 7px;border-radius:999px;background:#eaf2fb;color:#285b8e;font-size:10px}.vf-district-area-popup p{margin:6px 0 0}.vf-district-area-popup small{display:block;margin-top:7px;color:#64748b}.vf-district-popup-actions{display:grid;gap:6px;margin-top:10px}.vf-district-popup-actions button{border:0;border-radius:8px;padding:8px 10px;font:800 11px/1.2 Arial,sans-serif;cursor:pointer}.vf-district-open-contacts{background:#173f75;color:#fff}.vf-district-adjust{background:#eef4fa;color:#173f75;border:1px solid #d4e0ec!important}.vf-district-save{background:#1f7a4c;color:#fff}.vf-district-cancel{background:#f3f4f6;color:#475569}.vf-district-dragging .vf-district-point-wrap{filter:drop-shadow(0 0 0 rgba(0,0,0,0));transform:scale(1.12)}''',
    'css popup acoes',
)

old_marker = '''            const options: Record<string, unknown> = { icon, keyboard: true };\n            if (pane) options.pane = pane;\n            const marker = L.marker([center.latitude, center.longitude], options);\n            marker.bindTooltip(\n              `${item.district} · ${NUMBER.format(item.total)} contato(s)`,\n              { direction: "top", offset: [0, -30], opacity: 0.96 },\n            );\n            marker.bindPopup(\n              `<div class="vf-district-area-popup"><strong>${escapeHtml(item.district)}</strong><b>Referência territorial do bairro</b><p>${NUMBER.format(item.total)} contato(s) cadastrados neste bairro</p><small>O ponto azul marca uma referência territorial validada do bairro e não representa endereço individual nem limite geográfico oficial. Os pinos verdes e o L vermelho continuam mostrando somente contatos com coordenada exata.</small></div>`,\n              { maxWidth: 310, closeButton: true },\n            );\n            marker.on("click", () => setSelectedMarker(item.key));'''

new_marker = '''            const options: Record<string, unknown> = {\n              icon,\n              keyboard: true,\n              draggable: canManageReferences,\n            };\n            if (pane) options.pane = pane;\n            const marker = L.marker([center.latitude, center.longitude], options);\n            let editingPosition = false;\n            const originalPosition = { ...center };\n\n            const popupHtml = (editing = false) => `\n              <div class="vf-district-area-popup">\n                <strong>${escapeHtml(item.district)}</strong>\n                <b>Referência territorial do bairro</b>\n                <p>${NUMBER.format(item.total)} contato(s) cadastrados neste bairro</p>\n                <small>${editing ? "Arraste o ponto azul até a posição correta e salve." : "O ponto azul é uma referência territorial do bairro e não altera a localização individual dos contatos."}</small>\n                <div class="vf-district-popup-actions">\n                  <button type="button" class="vf-district-open-contacts">Ver contatos deste bairro →</button>\n                  ${canManageReferences ? editing\n                    ? '<button type="button" class="vf-district-save">Salvar posição</button><button type="button" class="vf-district-cancel">Cancelar ajuste</button>'\n                    : '<button type="button" class="vf-district-adjust">Ajustar posição</button>' : ""}\n                </div>\n              </div>`;\n\n            const bindActions = () => {\n              const popup = marker.getPopup?.()?.getElement?.() as HTMLElement | null;\n              if (!popup) return;\n              popup.querySelector<HTMLButtonElement>(".vf-district-open-contacts")?.addEventListener("click", () => {\n                window.dispatchEvent(\n                  new CustomEvent("voto-forte:open-district-contacts", {\n                    detail: { district: item.district },\n                  }),\n                );\n              });\n              popup.querySelector<HTMLButtonElement>(".vf-district-adjust")?.addEventListener("click", () => {\n                editingPosition = true;\n                marker.dragging?.enable?.();\n                marker.getElement?.()?.classList?.add("vf-district-dragging");\n                marker.setPopupContent(popupHtml(true));\n                marker.openPopup();\n              });\n              popup.querySelector<HTMLButtonElement>(".vf-district-cancel")?.addEventListener("click", () => {\n                editingPosition = false;\n                marker.setLatLng([originalPosition.latitude, originalPosition.longitude]);\n                marker.dragging?.disable?.();\n                marker.getElement?.()?.classList?.remove("vf-district-dragging");\n                marker.setPopupContent(popupHtml(false));\n                marker.openPopup();\n              });\n              popup.querySelector<HTMLButtonElement>(".vf-district-save")?.addEventListener("click", async () => {\n                const latLng = marker.getLatLng?.();\n                if (!latLng) return;\n                const button = popup.querySelector<HTMLButtonElement>(".vf-district-save");\n                if (button) { button.disabled = true; button.textContent = "Salvando…"; }\n                try {\n                  const response = await apiFetch("/api/territorial-pending", {\n                    method: "PATCH",\n                    headers: { "content-type": "application/json" },\n                    body: JSON.stringify({\n                      referenceDistrict: item.district,\n                      latitude: Number(latLng.lat),\n                      longitude: Number(latLng.lng),\n                    }),\n                  });\n                  const payload = await response.json().catch(() => ({}));\n                  if (!response.ok) throw new Error(payload?.error || "Não foi possível salvar a posição");\n                  center.latitude = Number(latLng.lat);\n                  center.longitude = Number(latLng.lng);\n                  originalPosition.latitude = center.latitude;\n                  originalPosition.longitude = center.longitude;\n                  editingPosition = false;\n                  marker.dragging?.disable?.();\n                  marker.getElement?.()?.classList?.remove("vf-district-dragging");\n                  marker.setPopupContent(popupHtml(false));\n                  marker.openPopup();\n                  window.dispatchEvent(new CustomEvent("voto-forte:geocoding-complete"));\n                } catch (error) {\n                  window.alert(error instanceof Error ? error.message : "Não foi possível salvar a posição");\n                  if (button) { button.disabled = false; button.textContent = "Salvar posição"; }\n                }\n              });\n            };\n\n            marker.bindTooltip(\n              `${item.district} · ${NUMBER.format(item.total)} contato(s)`,\n              { direction: "top", offset: [0, -30], opacity: 0.96 },\n            );\n            marker.bindPopup(popupHtml(false), { maxWidth: 320, closeButton: true });\n            marker.on("popupopen", bindActions);\n            marker.on("dragstart", () => {\n              if (!canManageReferences || !editingPosition) { marker.dragging?.disable?.(); return; }\n              marker.getElement?.()?.classList?.add("vf-district-dragging");\n            });\n            marker.on("dragend", () => marker.openPopup());\n            marker.on("click", () => setSelectedMarker(item.key));\n            if (canManageReferences) marker.dragging?.disable?.();'''

mp = repl(mp, old_marker, new_marker, 'acoes marker bairro')

for token in [
    'voto-forte:open-district-contacts',
    'contactDistrictFilter',
    'districtFilter={contactDistrictFilter}',
    'Ajustar posição',
    'Salvar posição',
    'referenceDistrict',
    'draggable: canManageReferences',
]:
    if token not in dash + mp:
        raise SystemExit(f'Validacao ausente: {token}')

if 'className="panel territorial"' in dash:
    raise SystemExit('Mapa da Visao Geral reapareceu')
if 'className: "vf-district-point-icon"' not in mp:
    raise SystemExit('Ponto azul foi removido')

DASH.write_text(dash, encoding='utf-8')
MAP.write_text(mp, encoding='utf-8')
print('Acoes territoriais de bairro aplicadas.')
