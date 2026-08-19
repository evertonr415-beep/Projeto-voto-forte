"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

const ADMIN_ROLES = new Set(["master", "admin", "gestor", "lider"]);
const STORAGE_PREFIX = "vf-whatsapp-quick-queue:v1";

function normalizeWhatsappPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55"))
    return digits;
  return "";
}

function storageKey(municipalityId: number, scope: string, district: string) {
  return `${STORAGE_PREFIX}:${municipalityId}:${scope}:${district.trim().toLocaleLowerCase("pt-BR")}`;
}

function whatsappUrl(phone: string, message: string) {
  const query = message.trim() ? `?text=${encodeURIComponent(message.trim())}` : "";
  return `https://wa.me/${phone}${query}`;
}

export default function ContactWhatsappQuickQueue() {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [scope, setScope] = useState("");
  const [municipalityId, setMunicipalityId] = useState(0);
  const [district, setDistrict] = useState("");
  const [profile, setProfile] = useState("");
  const [quantity, setQuantity] = useState(20);
  const [message, setMessage] = useState("");
  const [delaySeconds, setDelaySeconds] = useState(0);
  const [queue, setQueue] = useState<QueueState | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [now, setNow] = useState(Date.now());
  const districtRef = useRef("");

  useEffect(() => {
    let cancelled = false;
    let requested = false;
    let authObserver: MutationObserver | null = null;

    const loadContext = () => {
      if (cancelled || requested) return;
      requested = true;
      authObserver?.disconnect();
      authObserver = null;

      void Promise.all([
        apiFetch("/api/session", { cache: "no-store" }).then((response) => response.json()),
        apiFetch("/api/municipality-context", { cache: "no-store" }).then((response) =>
          response.json(),
        ),
      ])
        .then(([sessionData, municipalityData]: [SessionResponse, MunicipalityResponse]) => {
          if (cancelled) return;
          const email = String(sessionData.user?.email || "").trim().toLowerCase();
          const role = String(sessionData.user?.role || "").trim().toLowerCase();
          if (email) setScope(ADMIN_ROLES.has(role) ? "all" : email);
          setMunicipalityId(Number(municipalityData.context?.currentMunicipalityId || 0));
        })
        .catch(() => {
          if (!cancelled) setFeedback("Não foi possível preparar a fila agora.");
        });
    };

    if (!document.querySelector(".auth-page")) {
      loadContext();
      authObserver = new MutationObserver(() => {
        if (!document.querySelector(".auth-page")) {
          authObserver?.disconnect();
          authObserver = null;
          loadContext();
        }
      });
      authObserver.observe(document.body, { childList: true, subtree: true });
    }

    const handleScope = (event: Event) => {
      const select = event.target as HTMLSelectElement | null;
      if (!select?.matches(".optimized-scope-control select")) return;
      setScope(select.value);
      setQueue(null);
      setFeedback("");
    };

    const handleDistrict = (event: Event) => {
      const nextDistrict = String(
        (event as CustomEvent<{ district?: string }>).detail?.district || "",
      ).trim();
      if (!nextDistrict) return;
      districtRef.current = nextDistrict;
      setDistrict(nextDistrict);
      setQueue(null);
      setFeedback("");
    };

    document.addEventListener("change", handleScope, true);
    window.addEventListener("voto-forte:filter-district-contacts", handleDistrict);
    return () => {
      cancelled = true;
      authObserver?.disconnect();
      document.removeEventListener("change", handleScope, true);
      window.removeEventListener("voto-forte:filter-district-contacts", handleDistrict);
    };
  }, []);

  useEffect(() => {
    let observer: MutationObserver | null = null;
    const attach = () => {
      const panel = document.querySelector<HTMLElement>(".contacts-panel");
      if (!panel) return false;
      setTarget(panel);
      return true;
    };
    if (!attach()) {
      observer = new MutationObserver(() => {
        if (attach()) observer?.disconnect();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
    return () => observer?.disconnect();
  }, []);

  useEffect(() => {
    if (!district || !scope || !municipalityId) return;
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
        setMessage(saved.message || "");
        setDelaySeconds(Number(saved.delaySeconds || 0));
        setFeedback("Fila anterior restaurada neste dispositivo.");
      }
    } catch {
      window.localStorage.removeItem(storageKey(municipalityId, scope, district));
    }
  }, [district, municipalityId, scope]);

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

  const buildQueue = useCallback(async () => {
    if (!district || !scope || !municipalityId) {
      setFeedback("Abra um bairro na lista para criar a fila.");
      return;
    }
    const requested = Math.min(100, Math.max(1, Math.round(quantity || 1)));
    setQuantity(requested);
    setBusy(true);
    setFeedback("");
    try {
      const params = new URLSearchParams({
        owner: scope,
        district,
        page: "1",
        pageSize: "200",
      });
      if (profile === "Eleitor" || profile === "Liderança") params.set("profile", profile);
      const response = await apiFetch(`/api/contacts?${params.toString()}`, {
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível carregar o bairro.");

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
        setFeedback("Nenhum telefone válido foi encontrado neste bairro e perfil.");
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
      setNow(Date.now());
      setFeedback(
        valid.length < requested
          ? `${valid.length} contato(s) válido(s) encontrados para os ${requested} solicitados.`
          : `Fila criada com ${valid.length} contato(s) válidos.`,
      );
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível criar a fila.");
    } finally {
      setBusy(false);
    }
  }, [delaySeconds, district, message, municipalityId, profile, quantity, scope]);

  function openContact(item = current) {
    if (!item || waitSeconds > 0) return;
    const url = whatsappUrl(item.whatsappPhone, queue?.message || message);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function advance(status: "sent" | "skipped", openNext: boolean) {
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
      setFeedback(`Fila concluída: ${nextItems.filter((item) => item.status === "sent").length} enviado(s), ${nextItems.filter((item) => item.status === "skipped").length} pulado(s).`);
      return;
    }
    if (openNext && queue.delaySeconds === 0) {
      const nextItem = nextItems[nextIndex];
      window.open(
        whatsappUrl(nextItem.whatsappPhone, queue.message || message),
        "_blank",
        "noopener,noreferrer",
      );
    }
  }

  function restart() {
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
  }

  function discard() {
    if (queue)
      window.localStorage.removeItem(
        storageKey(queue.municipalityId, queue.scope, queue.district),
      );
    setQueue(null);
    setFeedback("Fila removida deste dispositivo.");
  }

  const content = useMemo(() => {
    if (!district) return null;
    return (
      <section className="vf-whatsapp-queue" aria-label="Fila rápida de WhatsApp">
        <header>
          <div>
            <small>FILA RÁPIDA DE WHATSAPP</small>
            <h3>{district}</h3>
            <p>Prepare até 100 contatos do bairro. O envio final continua sendo confirmado por você no WhatsApp.</p>
          </div>
          {queue && <b className="vf-whatsapp-queue-progress">{Math.min(queue.index + 1, queue.items.length)}/{queue.items.length}</b>}
        </header>

        {!queue ? (
          <div className="vf-whatsapp-queue-setup">
            <label>
              <span>Perfil</span>
              <select value={profile} onChange={(event) => setProfile(event.target.value)}>
                <option value="">Todos</option>
                <option value="Eleitor">Eleitores</option>
                <option value="Liderança">Lideranças</option>
              </select>
            </label>
            <label>
              <span>Quantidade</span>
              <input
                type="number"
                min={1}
                max={100}
                value={quantity}
                onChange={(event) => setQuantity(Number(event.target.value))}
              />
            </label>
            <label>
              <span>Pausa entre contatos</span>
              <select value={delaySeconds} onChange={(event) => setDelaySeconds(Number(event.target.value))}>
                <option value={0}>Sem pausa</option>
                <option value={15}>15 segundos</option>
                <option value={30}>30 segundos</option>
                <option value={60}>1 minuto</option>
              </select>
            </label>
            <label className="vf-whatsapp-queue-message">
              <span>Mensagem</span>
              <textarea
                rows={4}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Digite uma mensagem única para esta fila"
              />
            </label>
            <button className="primary" type="button" disabled={busy} onClick={() => void buildQueue()}>
              {busy ? "Preparando…" : "Criar fila"}
            </button>
          </div>
        ) : current ? (
          <div className="vf-whatsapp-queue-runner">
            <div className="vf-whatsapp-current-contact">
              <span>{current.kind || "Contato"}</span>
              <strong>{current.name || "Contato sem nome"}</strong>
              <small>{current.phone || current.whatsappPhone} · {current.district || district}</small>
            </div>
            <div className="vf-whatsapp-queue-stats">
              <span><b>{sentCount}</b> enviados</span>
              <span><b>{skippedCount}</b> pulados</span>
              <span><b>{remaining}</b> restantes</span>
            </div>
            {waitSeconds > 0 && (
              <div className="vf-whatsapp-wait" role="status">
                Próximo contato liberado em <b>{waitSeconds}s</b>
              </div>
            )}
            <div className="vf-whatsapp-queue-actions">
              <button type="button" disabled={!canOpen} onClick={() => openContact()}>
                Abrir no WhatsApp
              </button>
              <button
                className="primary"
                type="button"
                onClick={() => advance("sent", true)}
              >
                {queue.delaySeconds === 0 ? "Enviado → abrir próximo" : "Marcar como enviado"}
              </button>
              <button type="button" onClick={() => advance("skipped", false)}>Pular contato</button>
            </div>
            <div className="vf-whatsapp-queue-secondary">
              <button type="button" onClick={restart}>Reiniciar fila</button>
              <button type="button" onClick={discard}>Excluir fila</button>
            </div>
          </div>
        ) : (
          <div className="vf-whatsapp-queue-complete">
            <strong>Fila concluída</strong>
            <p>{sentCount} enviado(s) · {skippedCount} pulado(s)</p>
            <button type="button" onClick={restart}>Reiniciar</button>
            <button type="button" onClick={discard}>Criar outra fila</button>
          </div>
        )}
        {feedback && <p className="vf-whatsapp-queue-feedback" role="status">{feedback}</p>}
        <small className="vf-whatsapp-queue-note">Use a fila apenas com contatos que possam receber sua comunicação. O progresso é salvo somente neste dispositivo.</small>
      </section>
    );
  }, [busy, buildQueue, canOpen, current, delaySeconds, district, feedback, message, profile, quantity, queue, remaining, sentCount, skippedCount, waitSeconds]);

  return target && content ? createPortal(content, target) : null;
}
