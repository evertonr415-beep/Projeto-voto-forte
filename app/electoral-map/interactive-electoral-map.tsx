"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import "./interactive-electoral-map.css";

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

// Coordenadas Centróides de Bairros de Arapongas e Paraná
const DISTRICT_CENTROIDS: Record<string, [number, number]> = {
  "Centro": [-23.4153, -51.4256],
  "Jardim San Raphael": [-23.4080, -51.4180],
  "San Raphael": [-23.4080, -51.4180],
  "Conjunto Flamingos": [-23.3980, -51.4320],
  "Flamingos": [-23.3980, -51.4320],
  "Jardim Panorama": [-23.4240, -51.4150],
  "Panorama": [-23.4240, -51.4150],
  "Jardim Caravelle": [-23.4290, -51.4290],
  "Caravelle": [-23.4290, -51.4290],
  "Vila Nova": [-23.4100, -51.4350],
  "Conjunto Del Condor": [-23.4020, -51.4100],
  "Del Condor": [-23.4020, -51.4100],
  "Jardim Primavera": [-23.4180, -51.4420],
  "Primavera": [-23.4180, -51.4420],
  "Vila Araponguinha": [-23.4220, -51.4380],
  "Araponguinha": [-23.4220, -51.4380],
  "Jardim Petrópolis": [-23.4060, -51.4460],
  "Petrópolis": [-23.4060, -51.4460],
  "Jardim Columbia": [-23.4350, -51.4200],
  "Columbia": [-23.4350, -51.4200],
  "Jardim Mônaco": [-23.4120, -51.4080],
  "Mônaco": [-23.4120, -51.4080],
  "Jardim Aeroporto": [-23.3850, -51.4450],
  "Aeroporto": [-23.3850, -51.4450],
  "Conjunto Palmares": [-23.3940, -51.4210],
  "Palmares": [-23.3940, -51.4210],
  "Jardim Vale das Perobas": [-23.4280, -51.4050],
  "Vale das Perobas": [-23.4280, -51.4050],
  "Jardim Bandeirantes": [-23.4190, -51.4100],
  "Bandeirantes": [-23.4190, -51.4100],
  "Jardim Interlagos": [-23.4320, -51.4400],
  "Interlagos": [-23.4320, -51.4400],
  "Parque Industrial": [-23.3750, -51.4500],
  "Vila Aparecida": [-23.4140, -51.4320],
  "Jardim Tropical": [-23.4040, -51.4380],
  "Jardim Santa Alice": [-23.4260, -51.4240],
  "Conjunto Águias": [-23.3910, -51.4280],
  "Jardim Universitário": [-23.4380, -51.4320],
  "Aricanduva": [-23.4650, -51.4800],
  "Zona Rural": [-23.4450, -51.4600],
  "Curitiba": [-25.4284, -49.2733],
  "Londrina": [-23.3045, -51.1696],
  "Maringá": [-23.4205, -51.9333],
  "Ponta Grossa": [-25.0994, -50.1583],
  "Cascavel": [-24.9578, -53.4595],
  "Foz do Iguaçu": [-25.5163, -54.5854],
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

  const district = (contact.district || "Centro").trim();
  const base = DISTRICT_CENTROIDS[district] || DISTRICT_CENTROIDS["Centro"] || [-23.4153, -51.4256];
  
  // Pequeno espalhamento determinístico para contatos no mesmo bairro não colidirem
  const angle = (index * 137.5 * Math.PI) / 180;
  const radius = (0.0015 * Math.sqrt((index % 25) + 1));
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
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
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
      // Usa initialContacts se falhar a rede
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

  // Lista de todos os bairros com contagem
  const districtStats = useMemo(() => {
    const map = new Map<string, { total: number; leaders: number; voters: number }>();
    contacts.forEach((c) => {
      const d = (c.district || "Centro").trim();
      const current = map.get(d) || { total: 0, leaders: 0, voters: 0 };
      current.total += 1;
      if (c.kind === "Liderança") {
        current.leaders += 1;
      } else {
        current.voters += 1;
      }
      map.set(d, current);
    });

    const list = Array.from(map.entries()).map(([district, stat]) => ({
      district,
      ...stat,
    }));

    list.sort((a, b) => b.total - a.total);
    return list;
  }, [contacts]);

  // Contatos filtrados
  const filteredContacts = useMemo(() => {
    const q = searchPerson.trim().toLowerCase();
    return contacts.filter((c) => {
      const matchDistrict = selectedDistrict === "all" || (c.district || "Centro").trim() === selectedDistrict;
      const matchQuery =
        !q ||
        c.name.toLowerCase().includes(q) ||
        (c.district || "").toLowerCase().includes(q) ||
        (c.phone || "").includes(q);
      return matchDistrict && matchQuery;
    });
  }, [contacts, selectedDistrict, searchPerson]);

  // Estatísticas da seleção atual
  const currentSelectionStats = useMemo(() => {
    if (selectedDistrict === "all") {
      const leaders = contacts.filter((c) => c.kind === "Liderança").length;
      return {
        name: "Todos os Bairros (Arapongas & PR)",
        total: contacts.length,
        leaders,
        voters: contacts.length - leaders,
      };
    }
    const stat = districtStats.find((d) => d.district === selectedDistrict);
    return {
      name: selectedDistrict,
      total: stat?.total || 0,
      leaders: stat?.leaders || 0,
      voters: stat?.voters || 0,
    };
  }, [contacts, selectedDistrict, districtStats]);

  // Inicialização Ultra Segura do Leaflet
  useEffect(() => {
    let active = true;

    async function initLeaflet() {
      try {
        if (!mapContainerRef.current) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let L = (window as any).L;

        if (!L) {
          // Carrega CSS
          if (!document.querySelector('link[data-iem-leaflet="true"]')) {
            const link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
            link.dataset.iemLeaflet = "true";
            document.head.appendChild(link);
          }

          // Carrega JS
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

        // Se já existe um mapa criado, remove antes de recriar
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
          attribution: "&copy; OpenStreetMap · Voto Forte",
        }).addTo(map);

        const markersLayer = L.layerGroup().addTo(map);

        mapInstanceRef.current = map;
        markersLayerRef.current = markersLayer;
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

  // Atualização dos Marcadores no Mapa quando contatos ou filtro mudam
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const L = (window as any).L;
    if (!L || !mapInstanceRef.current || !markersLayerRef.current) return;

    markersLayerRef.current.clearLayers();
    markerMapRef.current.clear();

    const bounds: [number, number][] = [];

    filteredContacts.forEach((contact, idx) => {
      const [lat, lng] = getCentroidForContact(contact, idx);
      bounds.push([lat, lng]);

      const isLeader = contact.kind === "Liderança";
      const pinClass = isLeader ? "iem-pin iem-pin-leader" : "iem-pin iem-pin-voter";
      const initials = getInitials(contact.name);

      const icon = L.divIcon({
        className: "",
        html: `<div class="${pinClass}" title="${contact.name}"><span>${initials}</span></div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -16],
      });

      const marker = L.marker([lat, lng], { icon });

      const cleanPhone = (contact.phone || contact.whatsapp || "").replace(/\D/g, "");
      const waLink = cleanPhone ? `https://wa.me/55${cleanPhone}` : "";

      const popupHtml = `
        <div class="iem-popup">
          <h4>${contact.name}</h4>
          <p><strong>${isLeader ? "🟢 Liderança" : "🔵 Eleitor"}</strong> · ${contact.district || "Centro"}</p>
          ${contact.street ? `<p>${contact.street}${contact.number ? `, ${contact.number}` : ""}</p>` : ""}
          ${contact.phone ? `<p>📞 ${contact.phone}</p>` : ""}
          ${contact.pollingPlace ? `<p>🏛️ Local: ${contact.pollingPlace}</p>` : ""}
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

    if (bounds.length > 0) {
      if (selectedDistrict !== "all") {
        mapInstanceRef.current.fitBounds(L.latLngBounds(bounds), {
          padding: [40, 40],
          maxZoom: 16,
        });
      }
    }
  }, [filteredContacts, selectedDistrict]);

  // Foco no contato ao clicar na lista lateral
  const focusContact = (contact: ContactRecord, idx: number) => {
    if (!mapInstanceRef.current) return;
    const [lat, lng] = getCentroidForContact(contact, idx);
    mapInstanceRef.current.setView([lat, lng], 17, { animate: true });

    const marker = markerMapRef.current.get(contact.id);
    if (marker) {
      marker.openPopup();
    }
  };

  // Botões de Zoom Rápido
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
      {/* MAPA PRINCIPAL */}
      <div className="iem-map-card">
        <header className="iem-map-header">
          <div className="iem-map-title">
            <div style={{ fontSize: "22px" }}>📍</div>
            <div>
              <h2>Mapa Eleitoral do Paraná & Arapongas</h2>
              <span>
                {filteredContacts.length} alfinetes de eleitores e lideranças distribuídos por região.
              </span>
            </div>
          </div>
          <div className="iem-map-controls">
            <button type="button" className="iem-btn" onClick={viewArapongas}>
              🎯 Arapongas
            </button>
            <button type="button" className="iem-btn" onClick={viewParana}>
              🗺️ Estado do Paraná
            </button>
            <button
              type="button"
              className="iem-btn iem-btn-primary"
              onClick={loadContactsFromApi}
              disabled={loading}
            >
              {loading ? "Atualizando…" : "🔄 Atualizar Cadastros"}
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
                Visualização de Dados Geográficos Ativa
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
                <span>Lideranças</span>
              </div>
              <div>
                <i className="iem-legend-dot blue" />
                <span>Eleitores</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* PAINEL LATERAL: FILTRO POR BAIRRO & QUANTIDADE */}
      <aside className="iem-sidebar">
        <div className="iem-sidebar-head">
          <h3>Filtro por Bairro</h3>
          <p>Selecione a região para ver os eleitores e lideranças cadastrados.</p>
        </div>

        {/* SELECT DE BAIRROS */}
        <div className="iem-filter-box">
          <select
            className="iem-select"
            value={selectedDistrict}
            onChange={(e) => setSelectedDistrict(e.target.value)}
          >
            <option value="all">📍 Todos os Bairros ({contacts.length})</option>
            {districtStats.map((d) => (
              <option key={d.district} value={d.district}>
                {d.district} ({d.total} {d.total === 1 ? "cadastro" : "cadastros"})
              </option>
            ))}
          </select>

          <input
            className="iem-search-input"
            placeholder="Buscar nome ou telefone..."
            value={searchPerson}
            onChange={(e) => setSearchPerson(e.target.value)}
          />
        </div>

        {/* ESTATÍSTICAS DO BAIRRO SELECIONADO */}
        <div className="iem-district-stats">
          <div className="iem-stat-item">
            <small>Total</small>
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
