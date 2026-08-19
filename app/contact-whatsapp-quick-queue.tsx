"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ARAPONGAS_DISTRICTS } from "./arapongas-boundaries-data";
import { apiFetch } from "./supabase-client";

type Contact = {
  id: number;
  ownerEmail: string;
  name?: string;
  phone?: string;
  district?: string;
  kind?: "Eleitor" | "Liderança";
};

type QueueItem = Contact & {
  whatsappPhone: string;
  status: "pending" | "sent" | "skipped";
};

type QueueState = {
  municipalityId: number;
  scope: string;
  district: string;
  message: string;
  delaySeconds: number;
  index: number;
  items: QueueItem[];
  nextAllowedAt: number;
};

type SessionResponse = {
  user?: { email?: string; role?: string };
};

type MunicipalityResponse = {
  context?: { currentMunicipalityId?: number };
};

type DistrictSummary = {
  district: string;
  total: number;
};

const ADMIN_ROLES = new Set(["master", "admin", "gestor", "lider"]);
const STORAGE_PREFIX = "vf-whatsapp-quick-queue:v2";
const NUMBER = new Intl.NumberFormat("pt-BR");

function normalizeWhatsappPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55"))
    return digits;
  return "";
}

function storageKey(municipalityId: number, scope: string, district: string) {
  return `${STORAGE_PREFIX}:${municipalityId}:${scope}:${(district || "all").trim().toLocaleLowerCase("pt-BR")}`;
}

function formatMessage(template: string, contact: Contact) {
  const name = contact.name?.trim() || "Amigo(a)";
  const district = contact.district?.trim() || "nosso bairro";
  return template
    .replace(/\{nome\}/gi, name)
    .replace(/\{bairro\}/gi, district)
    .replace(/\{cidade\}/gi, "Arapongas");
}

function whatsappUrl(phone: string, message: string) {
  const query = message.trim() ? `?text=${encodeURIComponent(message.trim())}` : "";
  return `https://wa.me/${phone}${query}`;
}

export default function ContactWhatsappQuickQueue() {
  const [isOpen, setIsOpen] = useState(false);
  const [scope, setScope] = useState("");
  const [municipalityId, setMunicipalityId] = useState(0);
  const [district, setDistrict] = useState("");
  const [profile, setProfile] = useState("");
  const [quantity, setQuantity] = useState(50);
  const [message, setMessage] = useState(
    "Olá {nome}, tudo bem? Passando para conversar sobre as melhorias para o bairro {bairro} e nossa querida Arapongas!",
  );
  const [delaySeconds, setDelaySeconds] = useState(0);
  const [queue, setQueue] = useState<QueueState | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [districtList, setDistrictList] = useState<DistrictSummary[]>([]);
  const [now, setNow] = useState(Date.now());
  const messageInputRef = useRef<HTMLTextAreaElement | null>(null);

  // Carrega contexto de autenticação e bairros disponíveis
  useEffect(() => {
    let cancelled = false;

    const loadContext = async () => {
      try {
        const [sessionRes, contextRes, contactsRes] = await Promise.all([
          apiFetch("/api/session", { cache: "no-store" }).then((r) => r.json()),
          apiFetch("/api/municipality-context", { cache: "no-store" }).then((r) => r.json()),
          apiFetch("/api/contacts?summary=1", { cache: "no-store" }).then((r) => r.json()),
        ]);

        if (cancelled) return;
        const email = String((sessionRes as SessionResponse).user?.email || "").trim().toLowerCase();
        const role = String((sessionRes as SessionResponse).user?.role || "").trim().toLowerCase();
        if (email) setScope(ADMIN_ROLES.has(role) ? "all" : email);
        setMunicipalityId(Number((contextRes as MunicipalityResponse).context?.currentMunicipalityId || 0));

        // Carrega bairros com contagens reais
        if (Array.isArray(contactsRes?.districts)) {
          setDistrictList(
            contactsRes.districts.map((d: any) => ({
              district: String(d.district || "").trim(),
              total: Number(d.total || 0),
            })),
          );
        } else {
          setDistrictList(
            ARAPONGAS_DISTRICTS.map((d) => ({
              district: d.name,
              total: 0,
            })),
          );
        }
      } catch (err) {
        console.error("Falha ao carregar contexto do WhatsApp", err);
      }
    };

    void loadContext();

    const handleOpenModal = (event: Event) => {
      const targetDistrict = String(
        (event as CustomEvent<{ district?: string }>).detail?.district || "",
      ).trim();
      if (targetDistrict) setDistrict(targetDistrict);
      setIsOpen(true);
    };

    const handleDistrictFilter = (event: Event) => {
      const targetDistrict = String(
        (event as CustomEvent<{ district?: string }>).detail?.district || "",
      ).trim();
      if (targetDistrict) setDistrict(targetDistrict);
    };

    window.addEventListener("voto-forte:open-whatsapp-district-modal", handleOpenModal);
    window.addEventListener("voto-forte:filter-district-contacts", handleDistrictFilter);

    return () => {
      cancelled = true;
      window.removeEventListener("voto-forte:open-whatsapp-district-modal", handleOpenModal);
      window.removeEventListener("voto-forte:filter-district-contacts", handleDistrictFilter);
    };
  }, []);

  // Restaura fila salva caso exista
  useEffect(() => {
    if (!scope || !municipalityId) return;
    const raw = window.localStorage.getItem(storageKey(municipalityId, scope, district));
    if (!raw) return;
    try {
      const saved = JSON.parse(raw) as QueueState;
      if (
        saved.municipalityId === municipalityId &&
        saved.scope === scope &&
        saved.district === district &&
        Array.isArray(saved.items) &&
        saved.items.length > 0
      ) {
        setQueue(saved);
        if (saved.message) setMessage(saved.message);
        setDelaySeconds(Number(saved.delaySeconds || 0));
        setFeedback("Fila em andamento restaurada.");
      }
    } catch {
      window.localStorage.removeItem(storageKey(municipalityId, scope, district));
    }
  }, [district, municipalityId, scope]);

  // Salva fila ativa
  useEffect(() => {
    if (!queue) return;
    window.localStorage.setItem(
      storageKey(queue.municipalityId, queue.scope, queue.district),
      JSON.stringify(queue),
    );
  }, [queue]);

  useEffect(() => {
    if (!queue?.nextAllowedAt || queue.nextAllowedAt <= Date.now()) return;
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [queue?.nextAllowedAt]);

  const current = queue?.items[queue.index] || null;
  const sentCount = queue?.items.filter((item) => item.status === "sent").length || 0;
  const skippedCount = queue?.items.filter((item) => item.status === "skipped").length || 0;
  const remaining = queue ? Math.max(queue.items.length - queue.index, 0) : 0;
  const waitSeconds = queue
    ? Math.max(0, Math.ceil((queue.nextAllowedAt - now) / 1000))
    : 0;

  const canOpen = Boolean(current && waitSeconds === 0);

  const insertTag = (tag: string) => {
    const textarea = messageInputRef.current;
    if (!textarea) {
      setMessage((prev) => `${prev} ${tag}`);
      return;
    }
    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || 0;
    const next = message.substring(0, start) + tag + message.substring(end);
    setMessage(next);
    window.setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tag.length, start + tag.length);
    }, 50);
  };

  const buildQueue = useCallback(async () => {
    if (!scope || !municipalityId) {
      setFeedback("Selecione um município e escopo válidos.");
      return;
    }
    const requested = Math.min(200, Math.max(1, Math.round(quantity || 1)));
    setQuantity(requested);
    setBusy(true);
    setFeedback("");
    try {
      const params = new URLSearchParams({
        owner: scope,
        page: "1",
        pageSize: String(requested * 2), // busca margem para números com whatsapp válido
      });
      if (district) params.set("district", district);
      if (profile === "Eleitor" || profile === "Liderança") params.set("profile", profile);

      const response = await apiFetch(`/api/contacts?${params.toString()}`, {
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível carregar contatos.");

      const seen = new Set<string>();
      const valid = ((Array.isArray(data.contacts) ? data.contacts : []) as Contact[])
        .map((contact) => ({
          ...contact,
          whatsappPhone: normalizeWhatsappPhone(String(contact.phone || "")),
          status: "pending" as const,
        }))
        .filter((contact) => {
          if (!contact.whatsappPhone || seen.has(contact.whatsappPhone)) return false;
          seen.add(contact.whatsappPhone);
          return true;
        })
        .slice(0, requested);

      if (!valid.length) {
        setQueue(null);
        setFeedback("Nenhum telefone válido foi encontrado para este filtro.");
        return;
      }

      const nextQueue: QueueState = {
        municipalityId,
        scope,
        district,
        message,
        delaySeconds,
        index: 0,
        items: valid,
        nextAllowedAt: 0,
      };

      setQueue(nextQueue);
      setFeedback(`Fila criada com sucesso: ${valid.length} contatos prontos para envio.`);
    } catch (err: any) {
      setFeedback(err?.message || "Falha ao preparar contatos.");
    } finally {
      setBusy(false);
    }
  }, [delaySeconds, district, message, municipalityId, profile, quantity, scope]);

  const openContact = () => {
    if (!current) return;
    const text = formatMessage(queue?.message || message, current);
    window.open(whatsappUrl(current.whatsappPhone, text), "_blank", "noopener,noreferrer");
  };

  const advance = (status: "sent" | "skipped", openNext: boolean) => {
    if (!queue || !current) return;
    const nextItems = queue.items.map((item, index) =>
      index === queue.index ? { ...item, status } : item,
    );
    const nextIndex = queue.index + 1;
    const finished = nextIndex >= nextItems.length;
    const nextAllowedAt = finished ? 0 : Date.now() + queue.delaySeconds * 1000;
    const nextQueue: QueueState = {
      ...queue,
      items: nextItems,
      index: nextIndex,
      nextAllowedAt,
    };
    setQueue(nextQueue);
    setNow(Date.now());
    if (finished) {
      setFeedback(
        `Disparo finalizado: ${nextItems.filter((item) => item.status === "sent").length} enviado(s), ${nextItems.filter((item) => item.status === "skipped").length} pulado(s).`,
      );
      return;
    }
    if (openNext && queue.delaySeconds === 0) {
      const nextItem = nextItems[nextIndex];
      const text = formatMessage(queue.message || message, nextItem);
      window.open(whatsappUrl(nextItem.whatsappPhone, text), "_blank", "noopener,noreferrer");
    }
  };

  const restart = () => {
    if (!queue) return;
    const reset = {
      ...queue,
      index: 0,
      nextAllowedAt: 0,
      items: queue.items.map((item) => ({ ...item, status: "pending" as const })),
    };
    setQueue(reset);
    setNow(Date.now());
    setFeedback("Fila reiniciada.");
  };

  const discard = () => {
    if (queue)
      window.localStorage.removeItem(
        storageKey(queue.municipalityId, queue.scope, queue.district),
      );
    setQueue(null);
    setFeedback("Fila removida.");
  };

  if (!isOpen) return null;

  return (
    <div
      className="vf-whatsapp-modal-backdrop"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.75)",
        backdropFilter: "blur(6px)",
        zIndex: 9999,
        display: "grid",
        placeItems: "center",
        padding: "16px",
        overflowY: "auto",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) setIsOpen(false);
      }}
    >
      <div
        className="vf-whatsapp-modal-card"
        style={{
          width: "min(600px, 100%)",
          background: "#ffffff",
          borderRadius: "20px",
          boxShadow: "0 25px 60px rgba(0, 0, 0, 0.35)",
          border: "1px solid rgba(255, 255, 255, 0.4)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          maxHeight: "90vh",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        {/* Header */}
        <header
          style={{
            background: "linear-gradient(135deg, #0d2342 0%, #17345c 100%)",
            color: "#ffffff",
            padding: "20px 24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 900,
                color: "#38bdf8",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              📲 Central de Disparo WhatsApp
            </span>
            <h3 style={{ margin: "4px 0 0", fontSize: "20px", color: "#fff", fontWeight: 800 }}>
              {district ? `Disparo para o Bairro: ${district}` : "Disparo por Bairros e Base"}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            style={{
              background: "rgba(255, 255, 255, 0.15)",
              border: 0,
              color: "#fff",
              borderRadius: "50%",
              width: "36px",
              height: "36px",
              fontSize: "18px",
              fontWeight: 900,
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
            }}
          >
            ✕
          </button>
        </header>

        {/* Content Body */}
        <div style={{ padding: "22px 24px", overflowY: "auto", display: "grid", gap: "16px" }}>
          {!queue ? (
            <>
              {/* Seletor de Bairro */}
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 800, color: "#1e293b", marginBottom: "6px" }}>
                  Bairro de Destino
                </label>
                <select
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: "10px",
                    border: "1.5px solid #cbd5e1",
                    fontSize: "14px",
                    fontWeight: 700,
                    color: "#0f172a",
                    background: "#f8fafc",
                  }}
                >
                  <option value="">Todos os Bairros (Base Geral)</option>
                  {districtList.map((d) => (
                    <option key={d.district} value={d.district}>
                      {d.district} {d.total > 0 ? `(${NUMBER.format(d.total)} contatos)` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filtros em Linha: Perfil e Quantidade */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 800, color: "#1e293b", marginBottom: "6px" }}>
                    Perfil do Contato
                  </label>
                  <select
                    value={profile}
                    onChange={(e) => setProfile(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "12px 14px",
                      borderRadius: "10px",
                      border: "1.5px solid #cbd5e1",
                      fontSize: "14px",
                      fontWeight: 700,
                      color: "#0f172a",
                      background: "#f8fafc",
                    }}
                  >
                    <option value="">Todos os Perfis</option>
                    <option value="Eleitor">Apenas Eleitores</option>
                    <option value="Liderança">Apenas Lideranças</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 800, color: "#1e293b", marginBottom: "6px" }}>
                    Quantidade de Envios
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    style={{
                      width: "100%",
                      padding: "12px 14px",
                      borderRadius: "10px",
                      border: "1.5px solid #cbd5e1",
                      fontSize: "14px",
                      fontWeight: 700,
                      color: "#0f172a",
                      background: "#f8fafc",
                    }}
                  />
                </div>
              </div>

              {/* Mensagem e Tags Inteligentes */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <label style={{ fontSize: "13px", fontWeight: 800, color: "#1e293b" }}>
                    Mensagem a ser enviada
                  </label>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      type="button"
                      onClick={() => insertTag("{nome}")}
                      style={{
                        padding: "3px 8px",
                        borderRadius: "6px",
                        border: "1px solid #93c5fd",
                        background: "#eff6ff",
                        color: "#1d4ed8",
                        fontSize: "11px",
                        fontWeight: 800,
                        cursor: "pointer",
                      }}
                    >
                      + {`{nome}`}
                    </button>
                    <button
                      type="button"
                      onClick={() => insertTag("{bairro}")}
                      style={{
                        padding: "3px 8px",
                        borderRadius: "6px",
                        border: "1px solid #93c5fd",
                        background: "#eff6ff",
                        color: "#1d4ed8",
                        fontSize: "11px",
                        fontWeight: 800,
                        cursor: "pointer",
                      }}
                    >
                      + {`{bairro}`}
                    </button>
                  </div>
                </div>
                <textarea
                  ref={messageInputRef}
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Digite sua mensagem personalizada..."
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: "10px",
                    border: "1.5px solid #cbd5e1",
                    fontSize: "14px",
                    color: "#0f172a",
                    lineHeight: "1.4",
                    resize: "vertical",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Botão de Iniciar */}
              <button
                type="button"
                disabled={busy}
                onClick={() => void buildQueue()}
                style={{
                  width: "100%",
                  padding: "14px",
                  borderRadius: "12px",
                  background: "#16a34a",
                  color: "#ffffff",
                  fontSize: "16px",
                  fontWeight: 900,
                  border: 0,
                  cursor: busy ? "not-allowed" : "pointer",
                  boxShadow: "0 6px 16px rgba(22, 163, 74, 0.35)",
                  transition: "all 0.2s",
                }}
              >
                {busy ? "Preparando Contatos..." : "🚀 Iniciar Fila de Disparo"}
              </button>
            </>
          ) : current ? (
            /* Visualizador da Fila em Execução */
            <div style={{ display: "grid", gap: "16px" }}>
              {/* Barra de Progresso */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", fontWeight: 800, color: "#475569", marginBottom: "6px" }}>
                  <span>Progresso da Fila</span>
                  <span>{queue.index + 1} de {queue.items.length}</span>
                </div>
                <div style={{ height: "8px", background: "#e2e8f0", borderRadius: "999px", overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${((queue.index + 1) / queue.items.length) * 100}%`,
                      background: "#16a34a",
                      transition: "width 0.3s ease",
                    }}
                  />
                </div>
              </div>

              {/* Card do Contato Atual */}
              <div
                style={{
                  background: "#f8fafc",
                  border: "1.5px solid #e2e8f0",
                  borderRadius: "14px",
                  padding: "16px",
                  display: "grid",
                  gap: "6px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 800,
                      padding: "2px 8px",
                      borderRadius: "999px",
                      background: current.kind === "Liderança" ? "#fef3c7" : "#e0f2fe",
                      color: current.kind === "Liderança" ? "#92400e" : "#0369a1",
                    }}
                  >
                    {current.kind || "Eleitor"}
                  </span>
                  <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 700 }}>
                    {current.district || district || "Sem bairro"}
                  </span>
                </div>
                <strong style={{ fontSize: "18px", color: "#0f172a" }}>
                  {current.name || "Contato sem nome"}
                </strong>
                <span style={{ fontSize: "14px", color: "#2563eb", fontWeight: 800 }}>
                  📱 {current.phone || current.whatsappPhone}
                </span>
                <div
                  style={{
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    padding: "10px",
                    marginTop: "6px",
                    fontSize: "13px",
                    color: "#334155",
                    lineHeight: "1.4",
                  }}
                >
                  {formatMessage(queue.message || message, current)}
                </div>
              </div>

              {/* Botões de Ação de Envio */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <button
                  type="button"
                  disabled={!canOpen}
                  onClick={openContact}
                  style={{
                    padding: "12px",
                    borderRadius: "10px",
                    background: "#0284c7",
                    color: "#fff",
                    fontWeight: 800,
                    fontSize: "14px",
                    border: 0,
                    cursor: canOpen ? "pointer" : "not-allowed",
                  }}
                >
                  Abrir WhatsApp 📲
                </button>
                <button
                  type="button"
                  onClick={() => advance("sent", true)}
                  style={{
                    padding: "12px",
                    borderRadius: "10px",
                    background: "#16a34a",
                    color: "#fff",
                    fontWeight: 800,
                    fontSize: "14px",
                    border: 0,
                    cursor: "pointer",
                  }}
                >
                  Enviado → Próximo
                </button>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => advance("skipped", false)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: "8px",
                    background: "#f1f5f9",
                    color: "#475569",
                    fontWeight: 700,
                    fontSize: "12px",
                    border: "1px solid #cbd5e1",
                    cursor: "pointer",
                  }}
                >
                  Pular este contato
                </button>
                <button
                  type="button"
                  onClick={discard}
                  style={{
                    padding: "8px 14px",
                    borderRadius: "8px",
                    background: "#fee2e2",
                    color: "#b91c1c",
                    fontWeight: 700,
                    fontSize: "12px",
                    border: "1px solid #fca5a5",
                    cursor: "pointer",
                  }}
                >
                  Cancelar fila
                </button>
              </div>
            </div>
          ) : (
            /* Fila Concluída */
            <div style={{ textAlign: "center", padding: "20px" }}>
              <span style={{ fontSize: "40px" }}>🎉</span>
              <h4 style={{ margin: "8px 0 4px", fontSize: "18px", color: "#0f172a" }}>
                Disparo Concluído!
              </h4>
              <p style={{ color: "#64748b", fontSize: "14px", margin: "0 0 16px" }}>
                {sentCount} contatos enviados com sucesso.
              </p>
              <button
                type="button"
                onClick={discard}
                style={{
                  padding: "10px 20px",
                  borderRadius: "10px",
                  background: "#17345c",
                  color: "#fff",
                  fontWeight: 800,
                  border: 0,
                  cursor: "pointer",
                }}
              >
                Criar Novo Disparo
              </button>
            </div>
          )}

          {feedback && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "8px",
                background: "#f0fdf4",
                color: "#166534",
                fontSize: "13px",
                fontWeight: 700,
                border: "1px solid #bbf7d0",
              }}
            >
              {feedback}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
