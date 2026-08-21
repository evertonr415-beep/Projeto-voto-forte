"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "./supabase-client";

type ContactItem = { id: number; name?: string; phone?: string; kind?: string; district?: string; street?: string; number?: string };
type PollingCandidate = { name: string; number?: string; party?: string; votes: number; percentage?: number };
type PollingOffice = { key: string; label: string; totalVotes?: number; nominalVotes?: number; candidates?: PollingCandidate[] };
type PollingElection = { year: number; label: string; offices?: Record<string, PollingOffice> };
type PollingPlace = { id: string; code?: string; name: string; address?: string; district?: string; cep?: string; zone?: number; sections?: number[]; totalVoters?: number; elections?: Record<string, PollingElection> };
type OfficialResponse = { ready: boolean; provider?: string; methodology?: string; generatedAt?: string | null; message?: string; pollingPlaces?: PollingPlace[] };
type Tab = "contacts" | "colleges" | "directions";

const number = new Intl.NumberFormat("pt-BR");

function waUrl(phone: string) {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : "#";
}

export default function NeighborhoodInfoDrawer() {
  const [open, setOpen] = useState(false);
  const [district, setDistrict] = useState("");
  const [tab, setTab] = useState<Tab>("contacts");
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [totalContacts, setTotalContacts] = useState(0);
  const [contactPage, setContactPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [official, setOfficial] = useState<OfficialResponse | null>(null);
  const [loadingOfficial, setLoadingOfficial] = useState(false);
  const [selectedPlaceId, setSelectedPlaceId] = useState("");
  const [year, setYear] = useState(2024);
  const [officeKey, setOfficeKey] = useState("");

  useEffect(() => {
    const handleOpen = (event: Event) => {
      const detail = (event as CustomEvent<{ district?: string; initialTab?: Tab }>).detail;
      const nextDistrict = String(detail?.district || "").trim();
      if (!nextDistrict) return;
      setDistrict(nextDistrict);
      setTab(detail?.initialTab || "contacts");
      setContactPage(1);
      setSelectedPlaceId("");
      setOpen(true);
    };
    window.addEventListener("voto-forte:open-neighborhood-info", handleOpen);
    return () => window.removeEventListener("voto-forte:open-neighborhood-info", handleOpen);
  }, []);

  useEffect(() => {
    if (!open || !district) return;
    let cancelled = false;
    setLoadingContacts(true);
    const params = new URLSearchParams({ district, page: String(contactPage), pageSize: "25" });
    void apiFetch(`/api/contacts?${params.toString()}`, { cache: "no-store" })
      .then(async (response) => ({ response, data: await response.json() }))
      .then(({ response, data }) => {
        if (cancelled || !response.ok) return;
        setContacts(Array.isArray(data.contacts) ? data.contacts : []);
        setTotalContacts(Number(data.total || 0));
        setTotalPages(Math.max(1, Number(data.totalPages || 1)));
      })
      .finally(() => { if (!cancelled) setLoadingContacts(false); });
    return () => { cancelled = true; };
  }, [open, district, contactPage]);

  useEffect(() => {
    if (!open || !district) return;
    let cancelled = false;
    setLoadingOfficial(true);
    const params = new URLSearchParams({ district });
    void apiFetch(`/api/neighborhood-official?${params.toString()}`, { cache: "no-store" })
      .then(async (response) => ({ response, data: await response.json() }))
      .then(({ response, data }) => {
        if (!cancelled && response.ok) setOfficial(data as OfficialResponse);
      })
      .finally(() => { if (!cancelled) setLoadingOfficial(false); });
    return () => { cancelled = true; };
  }, [open, district]);

  const places = official?.pollingPlaces || [];
  const selectedPlace = useMemo(
    () => places.find((item) => item.id === selectedPlaceId) || places[0] || null,
    [places, selectedPlaceId],
  );
  const availableYears = useMemo(() => {
    if (!selectedPlace?.elections) return [];
    return Object.values(selectedPlace.elections).map((item) => item.year).sort((a, b) => b - a);
  }, [selectedPlace]);

  useEffect(() => {
    if (availableYears.length && !availableYears.includes(year)) setYear(availableYears[0]);
  }, [availableYears, year]);

  const selectedElection = selectedPlace?.elections?.[String(year)] || null;
  const offices = selectedElection?.offices ? Object.values(selectedElection.offices) : [];
  useEffect(() => {
    if (!offices.length) { setOfficeKey(""); return; }
    if (!offices.some((item) => item.key === officeKey)) setOfficeKey(offices[0].key);
  }, [offices, officeKey]);
  const selectedOffice = offices.find((item) => item.key === officeKey) || offices[0] || null;

  if (!open) return null;
  const mapsDestination = `${district}, Arapongas - PR, Brasil`;
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapsDestination)}`;

  return (
    <div className="vf-neighborhood-info-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
      <section className="vf-neighborhood-info" role="dialog" aria-modal="true" aria-label={`Informações do bairro ${district}`}>
        <header className="vf-neighborhood-info-header">
          <div><small>MAPA ELEITORAL · INFORMAÇÕES DO BAIRRO</small><h2>{district}</h2><p>{number.format(totalContacts)} contato(s) neste bairro</p></div>
          <button type="button" className="vf-neighborhood-info-close" onClick={() => setOpen(false)} aria-label="Fechar">×</button>
        </header>

        <nav className="vf-neighborhood-info-tabs" aria-label="Informações do bairro">
          <button className={tab === "contacts" ? "active" : ""} onClick={() => setTab("contacts")}>👥<span>Contatos</span></button>
          <button className={tab === "colleges" ? "active" : ""} onClick={() => setTab("colleges")}>🏫<span>Colégios</span></button>
          <button className={tab === "directions" ? "active" : ""} onClick={() => setTab("directions")}>📍<span>Como chegar</span></button>
        </nav>

        <div className="vf-neighborhood-info-body">
          {tab === "contacts" && (
            <div className="vf-neighborhood-contact-tab">
              <div className="vf-neighborhood-summary-card">
                <div><small>CONTATOS DO BAIRRO</small><strong>{number.format(totalContacts)}</strong><span>pessoas cadastradas</span></div>
                <div className="vf-neighborhood-contact-hint">Abra o WhatsApp individualmente em cada contato abaixo.</div>
              </div>
              {loadingContacts ? <p className="vf-neighborhood-empty">Carregando contatos…</p> : contacts.length ? (
                <div className="vf-neighborhood-contact-list">
                  {contacts.map((contact) => (
                    <article key={contact.id} className="vf-neighborhood-contact-card">
                      <div className="vf-neighborhood-contact-main"><strong>{contact.name || "Contato"}</strong><span>{contact.kind || "Eleitor"}</span><small>{[contact.street, contact.number].filter(Boolean).join(", ") || district}</small></div>
                      {contact.phone && <a href={waUrl(contact.phone)} target="_blank" rel="noreferrer">WhatsApp individual</a>}
                    </article>
                  ))}
                </div>
              ) : <p className="vf-neighborhood-empty">Nenhum contato encontrado neste bairro.</p>}
              {totalPages > 1 && (
                <div className="vf-neighborhood-pagination"><button disabled={contactPage <= 1 || loadingContacts} onClick={() => setContactPage((page) => Math.max(1, page - 1))}>Anterior</button><span>{contactPage} de {totalPages}</span><button disabled={contactPage >= totalPages || loadingContacts} onClick={() => setContactPage((page) => Math.min(totalPages, page + 1))}>Próxima</button></div>
              )}
            </div>
          )}

          {tab === "colleges" && (
            <div className="vf-neighborhood-colleges-tab">
              <div className="vf-neighborhood-section-title"><div><small>COLÉGIOS DE VOTAÇÃO</small><h3>{places.length ? `${places.length} local(is) encontrado(s)` : "Dados eleitorais oficiais"}</h3></div>{official?.ready && <span className="vf-tse-badge">Fonte: TSE</span>}</div>
              {loadingOfficial ? <p className="vf-neighborhood-empty">Carregando dados oficiais do TSE…</p> : !official?.ready ? (
                <div className="vf-neighborhood-official-pending"><strong>Sincronização oficial em andamento</strong><p>{official?.message || "Os resultados por local de votação serão exibidos somente após a base oficial do TSE ser validada."}</p><small>O sistema não exibe estimativas proporcionais como se fossem resultados reais.</small></div>
              ) : places.length === 0 ? <p className="vf-neighborhood-empty">Nenhum colégio de votação oficial foi associado a este bairro.</p> : (
                <>
                  <div className="vf-neighborhood-college-selector">{places.map((place) => (
                    <button key={place.id} className={selectedPlace?.id === place.id ? "active" : ""} onClick={() => setSelectedPlaceId(place.id)}><strong>{place.name}</strong><span>{place.address || place.district || district}</span><small>{place.zone ? `Zona ${place.zone}` : "Zona eleitoral"} · {place.sections?.length || 0} seção(ões) · {number.format(place.totalVoters || 0)} eleitores</small></button>
                  ))}</div>
                  {selectedPlace && (
                    <div className="vf-neighborhood-election-card">
                      <div className="vf-neighborhood-election-head"><div><small>RESULTADOS OFICIAIS POR LOCAL</small><h3>{selectedPlace.name}</h3><p>{selectedPlace.address}</p></div><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${selectedPlace.name}, ${selectedPlace.address || ""}, Arapongas - PR`)}`} target="_blank" rel="noreferrer">Abrir no mapa</a></div>
                      <div className="vf-neighborhood-election-filters"><label>Ano<select value={year} onChange={(event) => setYear(Number(event.target.value))}>{availableYears.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label>Cargo<select value={officeKey} onChange={(event) => setOfficeKey(event.target.value)}>{offices.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label></div>
                      {selectedOffice ? (
                        <div className="vf-neighborhood-candidate-list"><div className="vf-neighborhood-vote-summary"><span>{selectedElection?.label}</span><strong>{number.format(selectedOffice.nominalVotes || 0)} votos nominais</strong></div>{(selectedOffice.candidates || []).map((candidate, index) => (
                          <div className="vf-neighborhood-candidate" key={`${candidate.number}-${candidate.name}`}><b>{index + 1}</b><div><strong>{candidate.name}</strong><small>{[candidate.number, candidate.party].filter(Boolean).join(" · ")}</small></div><div className="vf-neighborhood-candidate-votes"><strong>{number.format(candidate.votes)}</strong><small>{Number(candidate.percentage || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%</small></div></div>
                        ))}</div>
                      ) : <p className="vf-neighborhood-empty">Nenhum resultado disponível para este local.</p>}
                    </div>
                  )}
                  <p className="vf-neighborhood-source-note">{official.methodology || "Votos oficiais do TSE por seção, agregados pelo local de votação."}</p>
                </>
              )}
            </div>
          )}

          {tab === "directions" && (
            <div className="vf-neighborhood-directions-tab"><div className="vf-neighborhood-route-icon">📍</div><small>COMO CHEGAR</small><h3>Ir para {district}</h3><p>Abra a rota no Google Maps usando sua localização atual como ponto de partida.</p><a className="vf-neighborhood-route-button" href={mapsUrl} target="_blank" rel="noreferrer">Abrir rota no Google Maps →</a>{places.length > 0 && <div className="vf-neighborhood-route-places"><strong>Ou vá direto a um colégio de votação</strong>{places.map((place) => <a key={place.id} href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${place.name}, ${place.address || ""}, Arapongas - PR`)}`} target="_blank" rel="noreferrer"><span>{place.name}</span><small>{place.address}</small></a>)}</div>}</div>
          )}
        </div>
      </section>
    </div>
  );
}
