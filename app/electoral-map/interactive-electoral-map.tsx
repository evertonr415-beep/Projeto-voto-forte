"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import "./interactive-electoral-map.css";
import { ARAPONGAS_DISTRICTS_GEO, matchDistrictGeo, DistrictGeometry } from "./arapongas-districts-geo";

export type ContactRecord = {
  id: number;
  name: string;
  kind?: string;
  district?: string;
  street?: string;
  number?: string;
  phone?: string;
  whatsapp?: string;
  notes?: string;
  latitude?: number;
  longitude?: number;
  city?: string;
  state?: string;
  votingZone?: string;
  votingSection?: string;
  pollingPlace?: string;
};

function getCentroidForContact(contact: ContactRecord, index: number): [number, number] {
  if (
    typeof contact.latitude === "number" &&
    typeof contact.longitude === "number" &&
    Number.isFinite(contact.latitude) &&
    Number.isFinite(contact.longitude) &&
    contact.latitude !== 0 &&
    contact.longitude !== 0
  ) {
    return [contact.latitude, contact.longitude];
  }

  const districtName = (contact.district || "Centro").trim();
  const matched = matchDistrictGeo(districtName);
  const base = matched ? matched.centroid : [-23.4153, -51.4256];
  
  // Pequeno espalhamento determinístico para contatos no mesmo bairro não colidirem
  const angle = (index * 137.5 * Math.PI) / 180;
  const radius = (0.0018 * Math.sqrt((index % 25) + 1));
  const lat = base[0] + radius * Math.sin(angle);
  const lng = base[1] + (radius * Math.cos(angle)) / Math.cos((base[0] * Math.PI) / 180);
  return [lat, lng];
}

function getInitials(name: string): string {
  if (!name) return "VF";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function InteractiveElectoralMap({
  initialContacts = [],
}: {
  initialContacts?: ContactRecord[];
}) {
  const [contacts, setContacts] = useState<ContactRecord[]>(initialContacts);
  const [loading, setLoading] = useState(false);
  const [selectedDistrict, setSelectedDistrict] = useState<string>("all");
  const [searchPerson, setSearchPerson] = useState("");
  const [showPolygons, setShowPolygons] = useState(true);
  const [showPins, setShowPins] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const polygonsLayerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const labelsLayerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersLayerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerMapRef = useRef<Map<number, any>>(new Map());

  // Carrega contatos atualizados da API em tempo real
  const loadContactsFromApi = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/records?owner=todos&kind=contact&mode=dashboard", {
        cache: "no-store",
      });
      if (res.ok) {
        const json = await res.json();
        const list = Array.isArray(json.records)
          ? json.records
          : Array.isArray(json.contacts)
            ? json.contacts
            : [];
        if (list.length > 0) {
          setContacts(list);
        }
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialContacts.length > 0) {
      setContacts(initialContacts);
    } else {
      void loadContactsFromApi();
    }
  }, [initialContacts, loadContactsFromApi]);

  // Contagem por Bairro
  const districtCounts = useMemo(() => {
    const map = new Map<string, { total: number; leaders: number; voters: number }>();
    
    // Inicializa todos os bairros conhecidos com 0
    ARAPONGAS_DISTRICTS_GEO.forEach((geo) => {
      map.set(geo.name, { total: 0, leaders: 0, voters: 0 });
    });

    contacts.forEach((c) => {
      const dName = (c.district || "Centro").trim();
      const matched = matchDistrictGeo(dName);
      const key = matched ? matched.name : dName;
      const current = map.get(key) || { total: 0, leaders: 0, voters: 0 };
      current.total += 1;
      if (c.kind === "Liderança") {
        current.leaders += 1;
      } else {
        current.voters += 1;
      }
      map.set(key, current);
    });

    return map;
  }, [contacts]);

  // Lista para o seletor de bairros
  const districtOptions = useMemo(() => {
    const list = Array.from(districtCounts.entries()).map(([district, stat]) => ({
      district,
      ...stat,
    }));
    list.sort((a, b) => b.total - a.total || a.district.localeCompare(b.district, "pt-BR"));
    return list;
  }, [districtCounts]);

  // Contatos filtrados pela busca e pelo bairro selecionado
  const filteredContacts = useMemo(() => {
    const q = searchPerson.trim().toLowerCase();
    return contacts.filter((c) => {
      const dName = (c.district || "Centro").trim();
      const matched = matchDistrictGeo(dName);
      const normalizedDistrict = matched ? matched.name : dName;

      const matchDistrict = selectedDistrict === "all" || normalizedDistrict === selectedDistrict;
      const matchQuery =
        !q ||
        c.name.toLowerCase().includes(q) ||
        (c.district || "").toLowerCase().includes(q) ||
        (c.phone || "").includes(q);
      return matchDistrict && matchQuery;
    });
  }, [contacts, selectedDistrict, searchPerson]);

  // Estatísticas do Bairro Selecionado
  const currentSelectionStats = useMemo(() => {
    if (selectedDistrict === "all") {
      const leaders = contacts.filter((c) => c.kind === "Liderança").length;
      return {
        name: "Todos os Bairros de Arapongas",
        total: contacts.length,
        leaders,
        voters: contacts.length - leaders,
      };
    }
    const stat = districtCounts.get(selectedDistrict);
    return {
      name: selectedDistrict,
      total: stat?.total || 0,
      leaders: stat?.leaders || 0,
      voters: stat?.voters || 0,
    };
  }, [contacts, selectedDistrict, districtCounts]);

  // Inicialização Ultra Segura do Leaflet
  useEffect(() => {
    let active = true;

    async function initLeaflet() {
      try {
        if (!mapContainerRef.current) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let L = (window as any).L;

        if (!L) {
          if (!document.querySelector('link[data-iem-leaflet="true"]')) {
            const link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
            link.dataset.iemLeaflet = "true";
            document.head.appendChild(link);
          }

          if (!document.querySelector('script[data-iem-leaflet="true"]')) {
            await new Promise<void>((resolve, reject) => {
              const script = document.createElement("script");
              script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
              script.dataset.iemLeaflet = "true";
              script.onload = () => resolve();
              script.onerror = () => reject(new Error("Falha ao carregar Leaflet CDN"));
              document.head.appendChild(script);
            });
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          L = (window as any).L;
        }

        if (!active || !L || !mapContainerRef.current) return;

        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        }

        const map = L.map(mapContainerRef.current, {
          zoomControl: true,
          attributionControl: true,
          closePopupOnClick: true,
        }).setView([-23.4153, -51.4256], 13);

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "&copy; OpenStreetMap · Voto Forte Arapongas",
        }).addTo(map);

        polygonsLayerRef.current = L.layerGroup().addTo(map);
        labelsLayerRef.current = L.layerGroup().addTo(map);
        markersLayerRef.current = L.layerGroup().addTo(map);

        mapInstanceRef.current = map;
        setMapReady(true);
        setMapError(false);

        setTimeout(() => {
          if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
        }, 150);
      } catch {
        if (active) setMapError(true);
      }
    }

    void initLeaflet();

    return () => {
      active = false;
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch {}
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // PASSO 1 & 2: RENDERIZAR POLÍGONOS DE BAIRROS E RÓTULOS COM CONTAGEM
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const L = (window as any).L;
    if (!L || !mapInstanceRef.current || !polygonsLayerRef.current || !labelsLayerRef.current) return;

    polygonsLayerRef.current.clearLayers();
    labelsLayerRef.current.clearLayers();

    if (!showPolygons) return;

    ARAPONGAS_DISTRICTS_GEO.forEach((district: DistrictGeometry) => {
      const stats = districtCounts.get(district.name) || { total: 0, leaders: 0, voters: 0 };
      const isSelected = selectedDistrict === district.name;

      // Densidade de cor dinâmica
      const baseOpacity = isSelected ? 0.45 : stats.total > 0 ? 0.25 : 0.12;
      const weight = isSelected ? 3.5 : 2;

      // 1. Polígono do Bairro
      const poly = L.polygon(district.polygon, {
        color: isSelected ? "#38bdf8" : district.color,
        weight,
        fillColor: district.color,
        fillOpacity: baseOpacity,
      });

      poly.on("mouseover", (e: any) => {
        e.target.setStyle({ weight: 3.5, fillOpacity: 0.42 });
      });

      poly.on("mouseout", (e: any) => {
        if (selectedDistrict !== district.name) {
          e.target.setStyle({ weight: 2, fillOpacity: baseOpacity });
        }
      });

      poly.on("click", () => {
        setSelectedDistrict(district.name);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.fitBounds(poly.getBounds(), { padding: [40, 40], maxZoom: 16 });
        }
      });

      poly.addTo(polygonsLayerRef.current);

      // 2. Rótulo central com nome e contagem de eleitores
      const labelHtml = `
        <div class="iem-district-label" title="${district.name}: ${stats.total} cadastros">
          <span>${district.name}</span>
          <span class="iem-district-badge">👥 ${stats.total} (${stats.leaders} L / ${stats.voters} E)</span>
        </div>
      `;

      const labelIcon = L.divIcon({
        className: "",
        html: labelHtml,
        iconSize: [110, 36],
        iconAnchor: [55, 18],
      });

      const labelMarker = L.marker(district.centroid, { icon: labelIcon });
      labelMarker.on("click", () => {
        setSelectedDistrict(district.name);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.fitBounds(poly.getBounds(), { padding: [40, 40], maxZoom: 16 });
        }
      });

      labelMarker.addTo(labelsLayerRef.current);
    });
  }, [districtCounts, selectedDistrict, showPolygons]);

  // PASSO 3: RENDERIZAR PONTOS DE GEOLOCALIZAÇÃO INDIVIDUAIS DE CADA CONTATO
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const L = (window as any).L;
    if (!L || !mapInstanceRef.current || !markersLayerRef.current) return;

    markersLayerRef.current.clearLayers();
    markerMapRef.current.clear();

    if (!showPins) return;

    const bounds: [number, number][] = [];

    filteredContacts.forEach((contact, idx) => {
      const [lat, lng] = getCentroidForContact(contact, idx);
      bounds.push([lat, lng]);

      const isLeader = contact.kind === "Liderança";
      const pinClass = isLeader ? "iem-pin iem-pin-leader" : "iem-pin iem-pin-voter";
      const initials = getInitials(contact.name);

      const icon = L.divIcon({
        className: "",
        html: `<div class="${pinClass}" title="${contact.name} (${contact.kind || "Eleitor"})"><span>${initials}</span></div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        popupAnchor: [0, -15],
      });

      const marker = L.marker([lat, lng], { icon });

      const cleanPhone = (contact.phone || contact.whatsapp || "").replace(/\D/g, "");
      const waLink = cleanPhone ? `https://wa.me/55${cleanPhone}` : "";

      const popupHtml = `
        <div class="iem-popup">
          <h4>${contact.name}</h4>
          <p><strong>${isLeader ? "🟢 Liderança" : "🔵 Eleitor"}</strong> · ${contact.district || "Centro"}</p>
          ${contact.street ? `<p>📍 ${contact.street}${contact.number ? `, ${contact.number}` : ""}</p>` : ""}
          ${contact.phone ? `<p>📞 ${contact.phone}</p>` : ""}
          ${contact.pollingPlace ? `<p>🏛️ Local de Votação: ${contact.pollingPlace}</p>` : ""}
          ${
            waLink
              ? `<a class="iem-popup-btn" href="${waLink}" target="_blank" rel="noopener noreferrer">💬 Abrir WhatsApp</a>`
              : ""
          }
        </div>
      `;

      marker.bindPopup(popupHtml, { autoClose: true, closeOnClick: true });
      marker.addTo(markersLayerRef.current);
      markerMapRef.current.set(contact.id, marker);
    });

    if (bounds.length > 0 && selectedDistrict !== "all") {
      mapInstanceRef.current.fitBounds(L.latLngBounds(bounds), {
        padding: [40, 40],
        maxZoom: 16,
      });
    }
  }, [filteredContacts, selectedDistrict, showPins]);

  // Centraliza e abre o popup do contato
  const focusContact = (contact: ContactRecord, idx: number) => {
    if (!mapInstanceRef.current) return;
    const [lat, lng] = getCentroidForContact(contact, idx);
    mapInstanceRef.current.setView([lat, lng], 17, { animate: true });

    const marker = markerMapRef.current.get(contact.id);
    if (marker) {
      marker.openPopup();
    }
  };

  // Botões de Zoom
  const viewParana = () => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.setView([-24.8, -51.5], 7, { animate: true });
  };

  const viewArapongas = () => {
    if (!mapInstanceRef.current) return;
    setSelectedDistrict("all");
    mapInstanceRef.current.setView([-23.4153, -51.4256], 13, { animate: true });
  };

  return (
    <div className="iem-container">
      {/* MAPA PRINCIPAL COM REGIONALIZAÇÃO */}
      <div className="iem-map-card">
        <header className="iem-map-header">
          <div className="iem-map-title">
            <div style={{ fontSize: "22px" }}>🗺️</div>
            <div>
              <h2>Regionalização Eleitoral de Arapongas</h2>
              <span>
                {ARAPONGAS_DISTRICTS_GEO.length} bairros delimitados · {filteredContacts.length} pessoas mapeadas.
              </span>
            </div>
          </div>
          <div className="iem-map-controls">
            <button
              type="button"
              className={`iem-btn ${showPolygons ? "active" : ""}`}
              onClick={() => setShowPolygons(!showPolygons)}
            >
              📐 Polígonos de Bairros {showPolygons ? "✓" : "✕"}
            </button>
            <button
              type="button"
              className={`iem-btn ${showPins ? "active" : ""}`}
              onClick={() => setShowPins(!showPins)}
            >
              📍 Pinos Individuais {showPins ? "✓" : "✕"}
            </button>
            <button type="button" className="iem-btn" onClick={viewArapongas}>
              🎯 Arapongas
            </button>
            <button type="button" className="iem-btn" onClick={viewParana}>
              🗺️ Paraná
            </button>
            <button
              type="button"
              className="iem-btn iem-btn-primary"
              onClick={loadContactsFromApi}
              disabled={loading}
            >
              {loading ? "Atualizando…" : "🔄 Sincronizar"}
            </button>
          </div>
        </header>

        <div className="iem-map-view" ref={mapContainerRef}>
          {mapError && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                color: "#94a3b8",
                padding: "20px",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "32px", marginBottom: "8px" }}>🗺️</div>
              <strong style={{ color: "#f4f7ff", fontSize: "16px" }}>
                Visualização Regional de Arapongas Ativa
              </strong>
              <p style={{ maxWidth: "400px", margin: "6px 0 14px" }}>
                Use a barra lateral para filtrar os eleitores por bairro e ver a distribuição eleitoral completa.
              </p>
              <button type="button" className="iem-btn" onClick={() => window.location.reload()}>
                Recarregar visualização
              </button>
            </div>
          )}

          {mapReady && (
            <div className="iem-floating-legend">
              <div>
                <i className="iem-legend-dot green" />
                <span>Liderança</span>
              </div>
              <div>
                <i className="iem-legend-dot blue" />
                <span>Eleitor</span>
              </div>
              <div>
                <i className="iem-legend-dot polygon" />
                <span>Divisão Bairros</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* PAINEL LATERAL: FILTRO POR REGIONALIZAÇÃO & QUANTIDADE */}
      <aside className="iem-sidebar">
        <div className="iem-sidebar-head">
          <h3>Regionalização por Bairro</h3>
          <p>Selecione a região para ver os polígonos e os eleitores cadastrados.</p>
        </div>

        {/* SELECT DE BAIRROS COM CONTAGEM */}
        <div className="iem-filter-box">
          <select
            className="iem-select"
            value={selectedDistrict}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedDistrict(val);
              if (val !== "all" && mapInstanceRef.current) {
                const geo = ARAPONGAS_DISTRICTS_GEO.find((g) => g.name === val);
                if (geo) {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const L = (window as any).L;
                  if (L) {
                    mapInstanceRef.current.fitBounds(L.polygon(geo.polygon).getBounds(), {
                      padding: [40, 40],
                      maxZoom: 16,
                    });
                  }
                }
              }
            }}
          >
            <option value="all">📍 Todos os Bairros ({contacts.length} total)</option>
            {districtOptions.map((d) => (
              <option key={d.district} value={d.district}>
                {d.district} ({d.total} {d.total === 1 ? "cadastro" : "cadastros"})
              </option>
            ))}
          </select>

          <input
            className="iem-search-input"
            placeholder="Buscar por nome, bairro ou fone..."
            value={searchPerson}
            onChange={(e) => setSearchPerson(e.target.value)}
          />
        </div>

        {/* ESTATÍSTICAS DO BAIRRO SELECIONADO */}
        <div className="iem-district-stats">
          <div className="iem-stat-item">
            <small>Total Região</small>
            <strong>{currentSelectionStats.total}</strong>
          </div>
          <div className="iem-stat-item">
            <small>Lideranças</small>
            <strong style={{ color: "#34d399" }}>{currentSelectionStats.leaders}</strong>
          </div>
          <div className="iem-stat-item">
            <small>Eleitores</small>
            <strong style={{ color: "#38bdf8" }}>{currentSelectionStats.voters}</strong>
          </div>
        </div>

        {/* LISTAGEM DE PESSOAS NA REGIÃO */}
        <div className="iem-contact-list">
          {filteredContacts.length === 0 ? (
            <div style={{ textAlign: "center", color: "#94a3b8", padding: "24px 10px" }}>
              Nenhum cadastro encontrado para esta região.
            </div>
          ) : (
            filteredContacts.map((contact, idx) => (
              <div
                key={contact.id}
                className="iem-contact-item"
                onClick={() => focusContact(contact, idx)}
                title="Clique para centralizar no mapa"
              >
                <div className="iem-contact-info">
                  <span className="iem-contact-name">{contact.name}</span>
                  <span className="iem-contact-sub">
                    {contact.district || "Centro"} {contact.phone ? `· ${contact.phone}` : ""}
                  </span>
                </div>
                <span
                  className={`iem-contact-badge ${
                    contact.kind === "Liderança" ? "iem-badge-leader" : "iem-badge-voter"
                  }`}
                >
                  {contact.kind === "Liderança" ? "Líder" : "Eleitor"}
                </span>
              </div>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}
