from pathlib import Path

path = Path('app/map-territory-enhancer.tsx')
text = path.read_text(encoding='utf-8')
original = text

text = text.replace(
'''    .vf-district-point-icon.vf-district-point-selected .vf-district-point-count{border-color:rgba(37,99,168,.55);box-shadow:0 3px 10px rgba(37,99,168,.24)}\n    .vf-district-area-popup{''',
'''    .vf-district-point-icon.vf-district-point-selected .vf-district-point-count{border-color:rgba(37,99,168,.55);box-shadow:0 3px 10px rgba(37,99,168,.24)}\n    .vf-district-overview-total{background:transparent!important;border:0!important;overflow:visible!important}.vf-district-overview-total-wrap{min-width:112px;padding:12px 16px;border-radius:18px;background:rgba(23,63,117,.94);border:2px solid #fff;box-shadow:0 10px 28px rgba(15,35,65,.28);color:#fff;text-align:center;transform:translate(-50%,-50%);pointer-events:none}.vf-district-overview-total-wrap strong{display:block;font:900 20px/1 Arial,sans-serif;letter-spacing:-.4px}.vf-district-overview-total-wrap small{display:block;margin-top:4px;font:800 9px/1.2 Arial,sans-serif;text-transform:uppercase;letter-spacing:.7px;opacity:.9}\n    .vf-district-area-popup{''',
1,
)

text = text.replace(
'''      const pointLayer = L.layerGroup().addTo(map);\n      const districtCenters = new Map<string, CenterPoint>();''',
'''      const pointLayer = L.layerGroup().addTo(map);\n      const overviewLayer = L.layerGroup().addTo(map);\n      let overviewMarker: any = null;\n      let overviewTotal = 0;\n      const districtCenters = new Map<string, CenterPoint>();''',
1,
)

old_update = '''      const updateVisiblePoints = () => {\n        if (!map?._container) return;\n        const zoom = Math.round(Number(map.getZoom?.() ?? 13));\n        const config = visibilityForZoom(zoom);\n        const selected: Array<{ x: number; y: number }> = [];\n        const nextVisible = new Set<string>();\n\n        for (const item of rankingItems) {\n          if (nextVisible.size >= config.limit) break;\n          const visual = districtMarkers.get(item.key);\n          if (!visual) continue;\n          const point = map.latLngToContainerPoint?.([\n            visual.center.latitude,\n            visual.center.longitude,\n          ]);\n          if (!point) continue;\n          if (\n            config.minDistance > 0 &&\n            selected.some((candidate) => {\n              const dx = candidate.x - point.x;\n              const dy = candidate.y - point.y;\n              return Math.sqrt(dx * dx + dy * dy) < config.minDistance;\n            })\n          ) {\n            continue;\n          }\n          nextVisible.add(item.key);\n          selected.push({ x: point.x, y: point.y });\n        }\n\n        if (selectedKey && mappedKeys.has(selectedKey)) nextVisible.add(selectedKey);\n\n        for (const [key, visual] of districtMarkers) {\n          const shouldShow = nextVisible.has(key);\n          const isShown = pointLayer.hasLayer?.(visual.marker);\n          if (shouldShow && !isShown) visual.marker.addTo(pointLayer);\n          if (!shouldShow && isShown) pointLayer.removeLayer(visual.marker);\n        }\n\n        visibleKeys = nextVisible;\n        map._vfDistrictVisiblePointCount = visibleKeys.size;\n        map._vfDistrictPointCount = mappedKeys.size;\n\n        const message = document.querySelector<HTMLElement>(".real-map-toolbar strong");\n        if (message) {\n          message.textContent = mappedKeys.size\n            ? `${visibleKeys.size} ponto(s) de bairro visíveis · ${mappedKeys.size} bairros com referência · ${config.detail}`\n            : "Ranking territorial ativo · sem referências territoriais para desenhar pontos";\n        }\n        renderRanking();\n      };'''

new_update = '''      const updateVisiblePoints = () => {\n        if (!map?._container) return;\n        const zoom = Math.round(Number(map.getZoom?.() ?? 13));\n        const isOverviewZoom = zoom <= 12;\n        const config = visibilityForZoom(zoom);\n\n        if (isOverviewZoom) {\n          for (const [, visual] of districtMarkers) {\n            if (pointLayer.hasLayer?.(visual.marker)) pointLayer.removeLayer(visual.marker);\n          }\n          visibleKeys = new Set<string>();\n          if (overviewTotal > 0) {\n            if (!overviewMarker) {\n              overviewMarker = L.marker(map.getCenter(), {\n                interactive: false,\n                keyboard: false,\n                zIndexOffset: 450,\n                icon: L.divIcon({\n                  className: "vf-district-overview-total",\n                  html: `<div class="vf-district-overview-total-wrap"><strong>${NUMBER.format(overviewTotal)}</strong><small>contatos</small></div>`,\n                  iconSize: [1, 1],\n                  iconAnchor: [0, 0],\n                }),\n              });\n            } else {\n              overviewMarker.setIcon(\n                L.divIcon({\n                  className: "vf-district-overview-total",\n                  html: `<div class="vf-district-overview-total-wrap"><strong>${NUMBER.format(overviewTotal)}</strong><small>contatos</small></div>`,\n                  iconSize: [1, 1],\n                  iconAnchor: [0, 0],\n                }),\n              );\n            }\n            overviewMarker.setLatLng(map.getCenter());\n            if (!overviewLayer.hasLayer?.(overviewMarker)) overviewMarker.addTo(overviewLayer);\n          } else {\n            overviewLayer.clearLayers();\n          }\n        } else {\n          overviewLayer.clearLayers();\n          const selected: Array<{ x: number; y: number }> = [];\n          const nextVisible = new Set<string>();\n\n          for (const item of rankingItems) {\n            if (nextVisible.size >= config.limit) break;\n            const visual = districtMarkers.get(item.key);\n            if (!visual) continue;\n            const point = map.latLngToContainerPoint?.([\n              visual.center.latitude,\n              visual.center.longitude,\n            ]);\n            if (!point) continue;\n            if (\n              config.minDistance > 0 &&\n              selected.some((candidate) => {\n                const dx = candidate.x - point.x;\n                const dy = candidate.y - point.y;\n                return Math.sqrt(dx * dx + dy * dy) < config.minDistance;\n              })\n            ) {\n              continue;\n            }\n            nextVisible.add(item.key);\n            selected.push({ x: point.x, y: point.y });\n          }\n\n          if (selectedKey && mappedKeys.has(selectedKey)) nextVisible.add(selectedKey);\n\n          for (const [key, visual] of districtMarkers) {\n            const shouldShow = nextVisible.has(key);\n            const isShown = pointLayer.hasLayer?.(visual.marker);\n            if (shouldShow && !isShown) visual.marker.addTo(pointLayer);\n            if (!shouldShow && isShown) pointLayer.removeLayer(visual.marker);\n          }\n          visibleKeys = nextVisible;\n        }\n\n        map._vfDistrictVisiblePointCount = visibleKeys.size;\n        map._vfDistrictPointCount = mappedKeys.size;\n\n        const message = document.querySelector<HTMLElement>(".real-map-toolbar strong");\n        if (message) {\n          message.textContent = isOverviewZoom && overviewTotal > 0\n            ? `${NUMBER.format(overviewTotal)} contatos no escopo · visão geral`\n            : mappedKeys.size\n              ? `${visibleKeys.size} ponto(s) de bairro visíveis · ${mappedKeys.size} bairros com referência · ${config.detail}`\n              : "Ranking territorial ativo · sem referências territoriais para desenhar pontos";\n        }\n        renderRanking();\n      };'''

if old_update not in text:
    raise SystemExit('Bloco updateVisiblePoints nao encontrado')
text = text.replace(old_update, new_update, 1)

text = text.replace(
'''          const summaryPayload = (await summaryResponse.json()) as {\n            districts?: DistrictSummaryItem[];\n            error?: string;\n          };''',
'''          const summaryPayload = (await summaryResponse.json()) as {\n            total?: number | string;\n            districts?: DistrictSummaryItem[];\n            error?: string;\n          };''',
1,
)

text = text.replace(
'''          if (cancelled || id !== requestId || !map._container) return;\n\n          rankingItems =''',
'''          if (cancelled || id !== requestId || !map._container) return;\n          overviewTotal = Math.max(0, Number(summaryPayload.total || 0));\n\n          rankingItems =''',
1,
)

text = text.replace(
'''          pointLayer.clearLayers();\n          districtMarkers.clear();''',
'''          pointLayer.clearLayers();\n          overviewLayer.clearLayers();\n          overviewMarker = null;\n          districtMarkers.clear();''',
1,
)

text = text.replace(
'''          map.removeLayer(pointLayer);\n          map.removeControl(control);''',
'''          map.removeLayer(pointLayer);\n          map.removeLayer(overviewLayer);\n          map.removeControl(control);''',
1,
)

for token in (
    'vf-district-overview-total',
    'const isOverviewZoom = zoom <= 12',
    'summaryPayload.total',
    'overviewMarker.setLatLng(map.getCenter())',
    'overviewLayer.clearLayers()',
    'className: "vf-district-point-icon"',
    'draggable: canManageReferences',
    'voto-forte:open-district-contacts',
):
    if token not in text:
        raise SystemExit(f'Validacao ausente: {token}')

if text == original:
    raise SystemExit('Nenhuma alteracao produzida')

path.write_text(text, encoding='utf-8')
print('Total central no zoom afastado aplicado.')
