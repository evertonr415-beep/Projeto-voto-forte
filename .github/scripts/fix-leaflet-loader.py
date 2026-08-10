from pathlib import Path

path = Path("app/dashboard-client.tsx")
text = path.read_text(encoding="utf-8")
original = text

old_loader = '''      if (!document.querySelector("link[data-vf-leaflet]")) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        link.dataset.vfLeaflet = "true";
        document.head.appendChild(link);
      }
      if (!(window as any).L)
        await new Promise<void>((resolve, reject) => {
          const existing = document.querySelector(
            "script[data-vf-leaflet]",
          ) as HTMLScriptElement | null;
          if (existing) {
            existing.addEventListener("load", () => resolve(), { once: true });
            existing.addEventListener("error", reject, { once: true });
            return;
          }
          const script = document.createElement("script");
          script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
          script.dataset.vfLeaflet = "true";
          script.onload = () => resolve();
          script.onerror = reject;
          document.head.appendChild(script);
        });'''

if text.count(old_loader) != 2:
    raise SystemExit(f"Esperava 2 carregadores Leaflet antigos; encontrei {text.count(old_loader)}")

helper = '''async function ensureLeaflet() {
  let stylesheet = document.querySelector<HTMLLinkElement>(
    'link[data-vf-leaflet]',
  );
  if (!stylesheet) {
    stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    stylesheet.dataset.vfLeaflet = "true";
    document.head.appendChild(stylesheet);
  }

  if (!stylesheet.sheet) {
    await new Promise<void>((resolve, reject) => {
      const loaded = () => resolve();
      const failed = () => reject(new Error("leaflet-css"));
      stylesheet?.addEventListener("load", loaded, { once: true });
      stylesheet?.addEventListener("error", failed, { once: true });
      window.setTimeout(() => {
        if (stylesheet?.sheet) resolve();
      }, 1500);
    });
  }

  if (!(window as any).L) {
    let script = document.querySelector<HTMLScriptElement>(
      "script[data-vf-leaflet]",
    );
    if (!script) {
      script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.dataset.vfLeaflet = "true";
      document.head.appendChild(script);
    }

    if (!(window as any).L) {
      await new Promise<void>((resolve, reject) => {
        if ((window as any).L) {
          resolve();
          return;
        }
        script?.addEventListener("load", () => resolve(), { once: true });
        script?.addEventListener("error", () => reject(new Error("leaflet-js")), {
          once: true,
        });
      });
    }
  }

  const L = (window as any).L;
  if (!L) throw new Error("leaflet-unavailable");
  return L;
}

'''

marker = 'async function geocodeMeetingAddress(address: string) {'
if marker not in text:
    raise SystemExit("Ponto de insercao do helper nao encontrado")
text = text.replace(marker, helper + marker, 1)

text = text.replace(old_loader, '      const L = await ensureLeaflet();', 2)

text = text.replace('      const L = (window as any).L;\n      map.current = L.map(element.current).setView([latitude, longitude], 17);', '      map.current = L.map(element.current).setView([latitude, longitude], 17);', 1)
text = text.replace('      const L = (window as any).L;\n      const map = L.map(mapElement.current, {', '      const map = L.map(mapElement.current, {', 1)

for token in (
    'function MapPage',
    '<CityMap contacts={contacts} />',
    'className: "contact-pin"',
    'Centralizar alfinetes',
    'function ensureLeaflet',
):
    if token not in text:
        raise SystemExit(f"Validacao ausente: {token}")

if text.count('<CityMap contacts={contacts} />') != 1:
    raise SystemExit("Mapa Eleitoral deve continuar com exatamente um CityMap")
if 'className="panel territorial"' in text:
    raise SystemExit("Mapa da Visao Geral reapareceu indevidamente")
if text.count('const L = await ensureLeaflet();') != 2:
    raise SystemExit("Os dois consumidores de Leaflet nao foram migrados")
if text == original:
    raise SystemExit("Nenhuma alteracao foi produzida")

path.write_text(text, encoding="utf-8")
print("Carregamento independente do Leaflet corrigido sem alterar o Mapa Eleitoral.")

# trigger workflow after registration
