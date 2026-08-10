from pathlib import Path

repo = Path('.')
dashboard_path = repo / 'app/dashboard-client.tsx'
layer_path = repo / 'app/map-contact-layer.tsx'

dashboard = dashboard_path.read_text(encoding='utf-8')
layer = layer_path.read_text(encoding='utf-8')

old_dashboard = '''      mapInstance.current = map;\n      const closePopup = () => map.closePopup();'''
new_dashboard = '''      mapInstance.current = map;\n      (window as any).__vfBaseElectoralMap = map;\n      window.dispatchEvent(\n        new CustomEvent("voto-forte:base-electoral-map-ready", { detail: { map } }),\n      );\n      const closePopup = () => map.closePopup();'''

if old_dashboard not in dashboard:
    raise SystemExit('Ponto de publicacao do CityMap nao encontrado')
dashboard = dashboard.replace(old_dashboard, new_dashboard, 1)

old_cleanup = '''        mapInstance.current.remove();\n        mapInstance.current = null;\n        contactLayer.current = null;'''
new_cleanup = '''        if ((window as any).__vfBaseElectoralMap === mapInstance.current)\n          delete (window as any).__vfBaseElectoralMap;\n        mapInstance.current.remove();\n        mapInstance.current = null;\n        contactLayer.current = null;'''

if old_cleanup not in dashboard:
    raise SystemExit('Ponto de limpeza do CityMap nao encontrado')
dashboard = dashboard.replace(old_cleanup, new_cleanup, 1)

old_setup_guard = '''    const setupMap = (map: any) => {\n      if (cancelled || !isElectoralMapContainer(map) || map._vfModernContacts) return;'''
new_setup_guard = '''    const setupMap = (map: any) => {\n      if (cancelled || !isElectoralMapContainer(map) || map._vfModernContacts) return false;'''
if old_setup_guard not in layer:
    raise SystemExit('Guard do setupMap nao encontrado')
layer = layer.replace(old_setup_guard, new_setup_guard, 1)

old_setup_end = '''      cleanupMaps.add(cleanup);\n      map.on("unload", cleanup);\n    };\n\n    const patchLeaflet = () => {'''
new_setup_end = '''      cleanupMaps.add(cleanup);\n      map.on("unload", cleanup);\n      return true;\n    };\n\n    const attachExistingMap = () => {\n      const map = (window as any).__vfBaseElectoralMap;\n      return Boolean(map?._container && setupMap(map));\n    };\n\n    const handleBaseMapReady = (event: Event) => {\n      const map = (event as CustomEvent<{ map?: any }>).detail?.map;\n      if (map?._container) setupMap(map);\n    };\n\n    window.addEventListener("voto-forte:base-electoral-map-ready", handleBaseMapReady);\n    attachExistingMap();\n\n    const patchLeaflet = () => {'''
if old_setup_end not in layer:
    raise SystemExit('Final do setupMap nao encontrado')
layer = layer.replace(old_setup_end, new_setup_end, 1)

old_return = '''    return () => {\n      cancelled = true;\n      cleanupMaps.forEach((cleanup) => cleanup());'''
new_return = '''    return () => {\n      cancelled = true;\n      window.removeEventListener("voto-forte:base-electoral-map-ready", handleBaseMapReady);\n      cleanupMaps.forEach((cleanup) => cleanup());'''
if old_return not in layer:
    raise SystemExit('Cleanup principal nao encontrado')
layer = layer.replace(old_return, new_return, 1)

for token in [
    '__vfBaseElectoralMap',
    'voto-forte:base-electoral-map-ready',
    'voto-forte:electoral-map-ready',
    'className: "vf-map-person"',
]:
    if token not in dashboard + layer:
        raise SystemExit(f'Validacao ausente: {token}')

if 'className: "contact-pin"' not in dashboard:
    raise SystemExit('Pinos legados-base foram alterados indevidamente')
if 'className="panel territorial"' in dashboard:
    raise SystemExit('Mapa da Visao Geral reapareceu indevidamente')

dashboard_path.write_text(dashboard, encoding='utf-8')
layer_path.write_text(layer, encoding='utf-8')
print('Handshake deterministico do Mapa Eleitoral aplicado.')
