"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "./supabase-client";

const LAST_VIEW_KEY = "voto-forte:last-dashboard-destination";
const BROADCAST_CHECKPOINT_KEY = "voto-forte:whatsapp:broadcast-checkpoint:v1";
const CHECKPOINT_EVENT = "voto-forte:broadcast-checkpoint-updated";

type RecipientStatus = "pending" | "sending" | "sent" | "error" | "uncertain";

type DurableRecipient = {
  id: number | string;
  name: string;
  phone: string;
  district?: string;
  leader?: string;
  status: RecipientStatus;
  error?: string;
  time?: string;
};

type BroadcastCheckpoint = {
  version: 1;
  id: string;
  pageInstanceId: string;
  startedAt: string;
  updatedAt: string;
  status: "running" | "completed" | "cancelled";
  district: string;
  kind: "Todos" | "Eleitor" | "Liderança";
  limit: number;
  delaySeconds: number;
  templateName: string;
  templateLanguage: string;
  parameterMappings: string[];
  recipients: DurableRecipient[];
};

type LiveFeedItem = {
  phone?: string;
  status?: string;
  direction?: string;
  sentAt?: string;
  lastMessageText?: string;
};

function makeId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

function normalizePhone(raw: string) {
  let digits = String(raw || "").replace(/\D/g, "").replace(/^0+/, "");
  if (!digits) return "";
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if (digits.length === 8 || digits.length === 9) return `5543${digits}`;
  return digits.length >= 10 ? digits : "";
}

function readCheckpoint(): BroadcastCheckpoint | null {
  try {
    const raw = localStorage.getItem(BROADCAST_CHECKPOINT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BroadcastCheckpoint;
    if (parsed?.version !== 1 || !Array.isArray(parsed.recipients)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCheckpoint(checkpoint: BroadcastCheckpoint | null) {
  try {
    if (!checkpoint) localStorage.removeItem(BROADCAST_CHECKPOINT_KEY);
    else localStorage.setItem(BROADCAST_CHECKPOINT_KEY, JSON.stringify(checkpoint));
    window.dispatchEvent(new CustomEvent(CHECKPOINT_EVENT));
  } catch {
    // Se o armazenamento estiver indisponível, não interrompe a interface.
  }
}

function updateCheckpoint(
  updater: (current: BroadcastCheckpoint) => BroadcastCheckpoint,
) {
  const current = readCheckpoint();
  if (!current) return null;
  const next = updater(current);
  writeCheckpoint(next);
  return next;
}

function isTerminal(status: RecipientStatus) {
  return status === "sent" || status === "error";
}

function finalizeIfDone(checkpoint: BroadcastCheckpoint) {
  if (
    checkpoint.recipients.length > 0 &&
    checkpoint.recipients.every((recipient) => isTerminal(recipient.status))
  ) {
    return { ...checkpoint, status: "completed" as const, updatedAt: new Date().toISOString() };
  }
  return checkpoint;
}

function resolveTag(value: string, contact: DurableRecipient) {
  const firstName = (contact.name || "").trim().split(/\s+/)[0] || "Amigo(a)";
  return String(value || "")
    .replace(/\{nome\}/gi, contact.name || "Amigo(a)")
    .replace(/\{primeiro_nome\}/gi, firstName)
    .replace(/\{bairro\}/gi, contact.district || "sua região")
    .replace(/\{cidade\}/gi, "Arapongas")
    .replace(/\{lideranca\}/gi, contact.leader || "Liderança");
}

function findControl<T extends HTMLInputElement | HTMLSelectElement>(
  root: ParentNode,
  labelPrefix: string,
): T | null {
  const groups = Array.from(root.querySelectorAll<HTMLElement>(".wt-form-group"));
  for (const group of groups) {
    const label = group.querySelector("label")?.textContent?.trim() || "";
    if (!label.startsWith(labelPrefix)) continue;
    const control = group.querySelector<T>("select, input");
    if (control) return control;
  }
  return null;
}

async function fetchRecipients(
  district: string,
  kind: "Todos" | "Eleitor" | "Liderança",
  limit: number,
) {
  const maxToFetch = limit === 99999 ? 500 : Math.max(1, limit);
  const params = new URLSearchParams({
    page: "1",
    pageSize: String(Math.min(200, maxToFetch)),
    owner: "all",
  });
  if (district && district !== "Todos" && district !== "Todos os Bairros") {
    params.set("district", district);
  }
  if (kind && kind !== "Todos") params.set("profile", kind);

  const loaded: Array<{
    id: number | string;
    name: string;
    phone: string;
    district?: string;
    leader?: string;
  }> = [];

  const firstResponse = await apiFetch(`/api/contacts?${params.toString()}`, {
    cache: "no-store",
  });
  const firstData = await firstResponse.json();
  if (!firstResponse.ok || !Array.isArray(firstData.contacts)) {
    throw new Error(firstData.error || "Não foi possível preparar a fila segura de contatos.");
  }

  const appendContacts = (items: Array<Record<string, unknown>>) => {
    for (const raw of items) {
      loaded.push({
        id: (raw.id as number | string) || `${loaded.length}`,
        name: String(raw.name || raw.nome || "Contato"),
        phone: String(raw.phone || raw.phoneNormalized || raw.telefone || raw.celular || ""),
        district: String(
          raw.district ||
            raw.bairro ||
            (district && district !== "Todos" && district !== "Todos os Bairros"
              ? district
              : "Arapongas"),
        ),
        leader: String(raw.leader || raw.lideranca || ""),
      });
    }
  };

  appendContacts(firstData.contacts as Array<Record<string, unknown>>);

  const totalPages = Math.max(1, Number(firstData.totalPages || 1));
  const pagesToRead = Math.min(Math.ceil(maxToFetch / 200), totalPages);
  for (let page = 2; page <= pagesToRead; page += 1) {
    params.set("page", String(page));
    const response = await apiFetch(`/api/contacts?${params.toString()}`, {
      cache: "no-store",
    });
    const data = await response.json();
    if (!response.ok || !Array.isArray(data.contacts)) break;
    appendContacts(data.contacts as Array<Record<string, unknown>>);
  }

  const seen = new Set<string>();
  const recipients: DurableRecipient[] = [];
  for (const contact of loaded) {
    const normalized = normalizePhone(contact.phone);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    recipients.push({
      ...contact,
      phone: contact.phone,
      status: "pending",
    });
    if (recipients.length >= maxToFetch) break;
  }
  return recipients;
}

function findSidebarButton(label: string) {
  return Array.from(
    document.querySelectorAll<HTMLButtonElement>(".sidebar nav button"),
  ).find((button) => button.querySelector(".nav-name")?.textContent?.trim() === label);
}

export default function DashboardSessionResilience() {
  const pageInstanceIdRef = useRef("");
  if (!pageInstanceIdRef.current) pageInstanceIdRef.current = makeId();

  const bypassStartRef = useRef(false);
  const preparingRef = useRef(false);
  const [checkpoint, setCheckpoint] = useState<BroadcastCheckpoint | null>(null);
  const [restoredRecovery, setRestoredRecovery] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState("");

  const refreshCheckpointState = () => {
    const next = readCheckpoint();
    setCheckpoint(next);
    if (!next || next.status !== "running") setRestoredRecovery(false);
  };

  useEffect(() => {
    const currentPageId = pageInstanceIdRef.current;
    const existing = readCheckpoint();
    setCheckpoint(existing);
    if (
      existing?.status === "running" &&
      existing.pageInstanceId &&
      existing.pageInstanceId !== currentPageId &&
      existing.recipients.some((recipient) => !isTerminal(recipient.status))
    ) {
      setRestoredRecovery(true);
      try {
        localStorage.setItem(LAST_VIEW_KEY, "Disparo em Massa");
      } catch {}
    }

    const sync = () => refreshCheckpointState();
    const storage = (event: StorageEvent) => {
      if (event.key === BROADCAST_CHECKPOINT_KEY) sync();
    };
    window.addEventListener(CHECKPOINT_EVENT, sync);
    window.addEventListener("storage", storage);
    return () => {
      window.removeEventListener(CHECKPOINT_EVENT, sync);
      window.removeEventListener("storage", storage);
    };
  }, []);

  useEffect(() => {
    const rememberNavigation = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest<HTMLButtonElement>(".sidebar nav button");
      if (!button) return;
      const label = button.querySelector(".nav-name")?.textContent?.trim();
      if (!label) return;
      try {
        localStorage.setItem(LAST_VIEW_KEY, label);
      } catch {}
    };

    document.addEventListener("click", rememberNavigation, true);

    let completed = false;
    let frame = 0;
    let attempts = 0;
    const restore = () => {
      if (completed) return true;
      let label = "";
      try {
        label = localStorage.getItem(LAST_VIEW_KEY) || "";
      } catch {}
      if (!label || label === "Visão Geral") {
        completed = true;
        return true;
      }
      const target = findSidebarButton(label);
      if (!target) return false;
      completed = true;
      target.click();
      return true;
    };

    const retry = () => {
      if (restore()) return;
      attempts += 1;
      if (attempts >= 40) return;
      frame = window.requestAnimationFrame(() => window.setTimeout(retry, 75));
    };
    frame = window.requestAnimationFrame(retry);

    const observer = new MutationObserver(() => {
      if (!completed) restore();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      document.removeEventListener("click", rememberNavigation, true);
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!restoredRecovery) return;
    let attempts = 0;
    const open = () => {
      window.dispatchEvent(new CustomEvent("voto-forte:open-whaticket-drawer"));
      const button = findSidebarButton("Disparo em Massa");
      if (button) button.click();
      attempts += 1;
      if (!document.querySelector(".wt-drawer.is-open") && attempts < 8) {
        window.setTimeout(open, 250);
      }
    };
    window.setTimeout(open, 120);
  }, [restoredRecovery]);

  useEffect(() => {
    const markRecipient = (
      phone: string,
      status: RecipientStatus,
      error?: string,
    ) => {
      const normalized = normalizePhone(phone);
      if (!normalized) return;
      updateCheckpoint((current) => {
        if (current.status !== "running") return current;
        let changed = false;
        const recipients = current.recipients.map((recipient) => {
          if (normalizePhone(recipient.phone) !== normalized) return recipient;
          if (isTerminal(recipient.status) && status !== recipient.status) return recipient;
          changed = true;
          return {
            ...recipient,
            status,
            error: error || undefined,
            time: new Date().toISOString(),
          };
        });
        if (!changed) return current;
        return finalizeIfDone({
          ...current,
          recipients,
          updatedAt: new Date().toISOString(),
        });
      });
    };

    const previousFetch = window.fetch.bind(window);
    const wrappedFetch: typeof window.fetch = async (input, init) => {
      const requestUrl = input instanceof Request ? input.url : String(input);
      const isWhatsappSend = requestUrl.includes("/api/whatsapp/send");
      let phone = "";

      if (isWhatsappSend) {
        try {
          const rawBody = typeof init?.body === "string" ? init.body : "";
          const body = rawBody ? (JSON.parse(rawBody) as { phone?: string }) : null;
          phone = body?.phone || "";
          if (phone) markRecipient(phone, "sending");
        } catch {}
      }

      try {
        const response = await previousFetch(input, init);
        if (isWhatsappSend && phone) {
          try {
            const data = await response.clone().json();
            const success = response.ok && Boolean(data?.success);
            markRecipient(
              phone,
              success ? "sent" : "error",
              success ? undefined : String(data?.error || `HTTP ${response.status}`),
            );
          } catch {
            if (!response.ok) markRecipient(phone, "error", `HTTP ${response.status}`);
          }
        }
        return response;
      } catch (error) {
        if (isWhatsappSend && phone) {
          markRecipient(
            phone,
            "uncertain",
            error instanceof Error ? error.message : "Conexão interrompida durante o envio",
          );
        }
        throw error;
      }
    };

    window.fetch = wrappedFetch;
    return () => {
      if (window.fetch === wrappedFetch) window.fetch = previousFetch;
    };
  }, []);

  useEffect(() => {
    const handleStartOrCancel = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const cancelButton = target.closest<HTMLButtonElement>(".wt-danger-btn");
      if (cancelButton && cancelButton.textContent?.includes("Cancelar")) {
        const current = readCheckpoint();
        if (current?.status === "running") {
          writeCheckpoint({
            ...current,
            status: "cancelled",
            updatedAt: new Date().toISOString(),
          });
        }
        return;
      }

      const button = target.closest<HTMLButtonElement>(".wt-primary-btn");
      if (!button || !button.closest(".wt-drawer")) return;
      if (!button.textContent?.trim().startsWith("Enviar para")) return;
      if (bypassStartRef.current) return;

      event.preventDefault();
      event.stopPropagation();
      if ("stopImmediatePropagation" in event) event.stopImmediatePropagation();
      if (preparingRef.current) return;

      const old = readCheckpoint();
      if (
        old?.status === "running" &&
        old.recipients.some((recipient) => !isTerminal(recipient.status))
      ) {
        setCheckpoint(old);
        setRestoredRecovery(true);
        setRecoveryMessage(
          "Já existe uma fila de disparos que não foi concluída. Retome ou descarte essa fila antes de iniciar outra.",
        );
        return;
      }

      preparingRef.current = true;
      const drawer = button.closest<HTMLElement>(".wt-drawer");
      void (async () => {
        try {
          if (!drawer) throw new Error("Central de Disparos não encontrada.");
          const district =
            findControl<HTMLSelectElement>(drawer, "Bairro")?.value || "Todos";
          const kindValue =
            findControl<HTMLSelectElement>(drawer, "Perfil")?.value || "Todos";
          const kind =
            kindValue === "Eleitor" || kindValue === "Liderança"
              ? kindValue
              : "Todos";
          const limit = Number(findControl<HTMLSelectElement>(drawer, "Limite")?.value || 50);
          const templateValue =
            findControl<HTMLSelectElement>(drawer, "Mensagem")?.value || "";
          const [templateName, templateLanguage = "pt_BR"] = templateValue.split("::");
          const delaySeconds = Math.max(
            1,
            Number(drawer.querySelector<HTMLInputElement>('input[type="range"]')?.value || 3),
          );
          const parameterMappings = Array.from(
            drawer.querySelectorAll<HTMLElement>(".wt-form-group"),
          )
            .filter((group) =>
              (group.querySelector("label")?.textContent || "").trim().startsWith("Variável"),
            )
            .map((group) => group.querySelector<HTMLInputElement>("input")?.value || "");

          if (!templateName) throw new Error("Selecione um modelo aprovado antes de iniciar.");

          const recipients = await fetchRecipients(district, kind, limit);
          if (!recipients.length) throw new Error("Nenhum contato elegível foi encontrado para esta fila.");

          const now = new Date().toISOString();
          const safeCheckpoint: BroadcastCheckpoint = {
            version: 1,
            id: makeId(),
            pageInstanceId: pageInstanceIdRef.current,
            startedAt: now,
            updatedAt: now,
            status: "running",
            district,
            kind,
            limit,
            delaySeconds,
            templateName,
            templateLanguage,
            parameterMappings,
            recipients,
          };
          writeCheckpoint(safeCheckpoint);
          setCheckpoint(safeCheckpoint);
          setRestoredRecovery(false);
          setRecoveryMessage("");
          try {
            localStorage.setItem(LAST_VIEW_KEY, "Disparo em Massa");
          } catch {}

          bypassStartRef.current = true;
          button.click();
          bypassStartRef.current = false;
        } catch (error) {
          setRecoveryMessage(
            error instanceof Error
              ? error.message
              : "Não foi possível preparar a fila segura. O disparo não foi iniciado.",
          );
          setRestoredRecovery(true);
        } finally {
          bypassStartRef.current = false;
          preparingRef.current = false;
        }
      })();
    };

    document.addEventListener("click", handleStartOrCancel, true);
    return () => document.removeEventListener("click", handleStartOrCancel, true);
  }, []);

  const counts = useMemo(() => {
    const recipients = checkpoint?.recipients || [];
    return {
      total: recipients.length,
      sent: recipients.filter((item) => item.status === "sent").length,
      errors: recipients.filter((item) => item.status === "error").length,
      pending: recipients.filter((item) => item.status === "pending").length,
      uncertain: recipients.filter(
        (item) => item.status === "sending" || item.status === "uncertain",
      ).length,
    };
  }, [checkpoint]);

  async function reconcileUncertain(current: BroadcastCheckpoint) {
    let next = current;
    for (const recipient of current.recipients) {
      if (recipient.status !== "sending" && recipient.status !== "uncertain") continue;
      const normalized = normalizePhone(recipient.phone);
      if (!normalized) continue;
      try {
        const response = await apiFetch(
          `/api/whatsapp/live-feed?filter=all&limit=100&search=${encodeURIComponent(normalized)}`,
          { cache: "no-store" },
        );
        const data = await response.json();
        const items: LiveFeedItem[] = Array.isArray(data.items) ? data.items : [];
        const startedAt = new Date(current.startedAt).getTime() - 30_000;
        const match = items.find((item) => {
          if (normalizePhone(item.phone || "") !== normalized) return false;
          if (item.direction !== "outbound") return false;
          const sentAt = item.sentAt ? new Date(item.sentAt).getTime() : 0;
          if (!sentAt || sentAt < startedAt) return false;
          if (item.lastMessageText && item.lastMessageText !== current.templateName) return false;
          return item.status !== "error";
        });
        if (match) {
          next = {
            ...next,
            recipients: next.recipients.map((item) =>
              normalizePhone(item.phone) === normalized
                ? { ...item, status: "sent" as const, error: undefined, time: match.sentAt || new Date().toISOString() }
                : item,
            ),
            updatedAt: new Date().toISOString(),
          };
        } else {
          next = {
            ...next,
            recipients: next.recipients.map((item) =>
              normalizePhone(item.phone) === normalized
                ? {
                    ...item,
                    status: "uncertain" as const,
                    error:
                      "Não foi possível confirmar se este envio chegou à Meta. Ele não será repetido automaticamente para evitar duplicidade.",
                  }
                : item,
            ),
            updatedAt: new Date().toISOString(),
          };
        }
      } catch {
        next = {
          ...next,
          recipients: next.recipients.map((item) =>
            normalizePhone(item.phone) === normalized
              ? { ...item, status: "uncertain" as const }
              : item,
          ),
          updatedAt: new Date().toISOString(),
        };
      }
    }
    next = finalizeIfDone(next);
    writeCheckpoint(next);
    return next;
  }

  async function resumePending() {
    let current = readCheckpoint();
    if (!current || current.status !== "running" || resuming) return;
    setResuming(true);
    setRecoveryMessage("Conferindo o último envio antes de retomar a fila…");
    try {
      current = await reconcileUncertain(current);
      current = {
        ...current,
        pageInstanceId: pageInstanceIdRef.current,
        updatedAt: new Date().toISOString(),
      };
      writeCheckpoint(current);
      setCheckpoint(current);

      const pending = current.recipients.filter((item) => item.status === "pending");
      if (!pending.length) {
        const ambiguous = current.recipients.filter(
          (item) => item.status === "uncertain" || item.status === "sending",
        ).length;
        setRecoveryMessage(
          ambiguous
            ? "Não há pendentes seguros para reenviar. Existe envio incerto; confira-o no Monitor Ao Vivo para evitar duplicidade."
            : "A fila já está concluída.",
        );
        if (!ambiguous) {
          writeCheckpoint({ ...current, status: "completed", updatedAt: new Date().toISOString() });
          setRestoredRecovery(false);
        }
        return;
      }

      setRecoveryMessage(`Retomando ${pending.length} envio(s) pendente(s)…`);
      for (let index = 0; index < pending.length; index += 1) {
        const latest = readCheckpoint();
        if (!latest || latest.status !== "running") break;
        const contact = pending[index];
        const stillPending = latest.recipients.find(
          (item) => normalizePhone(item.phone) === normalizePhone(contact.phone),
        )?.status;
        if (stillPending !== "pending") continue;

        try {
          await apiFetch("/api/whatsapp/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              phone: contact.phone,
              contactName: contact.name,
              templateName: latest.templateName,
              templateLanguage: latest.templateLanguage,
              templateParameters: latest.parameterMappings.map((mapping) =>
                resolveTag(mapping, contact),
              ),
            }),
          });
        } catch {
          // O wrapper de fetch registra o estado incerto e a fila continua de forma conservadora.
        }

        if (index < pending.length - 1) {
          await new Promise((resolve) =>
            window.setTimeout(resolve, Math.max(1, latest.delaySeconds) * 1000),
          );
        }
      }

      const finalState = readCheckpoint();
      if (finalState) {
        const finalized = finalizeIfDone(finalState);
        writeCheckpoint(finalized);
        setCheckpoint(finalized);
        const remaining = finalized.recipients.filter((item) => item.status === "pending").length;
        const ambiguous = finalized.recipients.filter(
          (item) => item.status === "uncertain" || item.status === "sending",
        ).length;
        if (finalized.status === "completed") {
          setRecoveryMessage("Fila recuperada e concluída com segurança.");
          window.setTimeout(() => setRestoredRecovery(false), 1800);
        } else if (ambiguous) {
          setRecoveryMessage(
            `${remaining} pendente(s) e ${ambiguous} envio(s) incerto(s). Os incertos não serão repetidos automaticamente.`,
          );
        } else {
          setRecoveryMessage(`${remaining} envio(s) ainda pendente(s).`);
        }
      }
    } finally {
      setResuming(false);
    }
  }

  function openBroadcastCenter() {
    try {
      localStorage.setItem(LAST_VIEW_KEY, "Disparo em Massa");
    } catch {}
    window.dispatchEvent(new CustomEvent("voto-forte:open-whaticket-drawer"));
    findSidebarButton("Disparo em Massa")?.click();
  }

  function discardRecovery() {
    if (
      !window.confirm(
        "Descartar a recuperação desta fila? Isso não apaga mensagens já enviadas, apenas remove o ponto de retomada local.",
      )
    ) {
      return;
    }
    const current = readCheckpoint();
    if (current) {
      writeCheckpoint({
        ...current,
        status: "cancelled",
        updatedAt: new Date().toISOString(),
      });
    }
    setRestoredRecovery(false);
    setRecoveryMessage("");
  }

  if (!restoredRecovery || !checkpoint || checkpoint.status !== "running") return null;

  const processed = counts.sent + counts.errors;
  const progress = counts.total ? Math.round((processed / counts.total) * 100) : 0;

  return (
    <aside
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        right: 18,
        bottom: 18,
        zIndex: 2147483000,
        width: "min(430px, calc(100vw - 28px))",
        border: "1px solid rgba(56,189,248,.65)",
        borderRadius: 16,
        padding: 16,
        background: "rgba(5,15,29,.97)",
        boxShadow: "0 20px 60px rgba(0,0,0,.45)",
        color: "#e5eef8",
        fontFamily: "inherit",
      }}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            display: "grid",
            placeItems: "center",
            background: "rgba(56,189,248,.14)",
            color: "#e0b45e",
            fontSize: 19,
            flex: "0 0 auto",
          }}
        >
          ⚡
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <strong style={{ display: "block", fontSize: 15, color: "#fff" }}>
            Disparo recuperado após recarga
          </strong>
          <span style={{ display: "block", marginTop: 3, fontSize: 12, color: "#9fb0c3" }}>
            A aba foi recarregada, mas a fila foi preservada.
          </span>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 6,
          marginTop: 14,
          fontSize: 11,
        }}
      >
        <div><b style={{ display: "block", fontSize: 16 }}>{counts.total}</b>Total</div>
        <div><b style={{ display: "block", fontSize: 16, color: "#4ade80" }}>{counts.sent}</b>Enviados</div>
        <div><b style={{ display: "block", fontSize: 16, color: "#fbbf24" }}>{counts.pending}</b>Pendentes</div>
        <div><b style={{ display: "block", fontSize: 16, color: counts.uncertain ? "#fb7185" : "#94a3b8" }}>{counts.uncertain}</b>Incertos</div>
      </div>

      <div style={{ marginTop: 10, height: 7, borderRadius: 999, background: "rgba(148,163,184,.18)", overflow: "hidden" }}>
        <div style={{ width: `${progress}%`, height: "100%", background: "linear-gradient(90deg,#d7ae60,#38bdf8)" }} />
      </div>

      {counts.uncertain > 0 && (
        <p style={{ margin: "10px 0 0", fontSize: 11, lineHeight: 1.45, color: "#fecdd3" }}>
          Há envio que estava em trânsito no instante da recarga. Ele será conferido antes da retomada e não será duplicado automaticamente.
        </p>
      )}
      {recoveryMessage && (
        <p style={{ margin: "10px 0 0", fontSize: 11, lineHeight: 1.45, color: "#bae6fd" }}>
          {recoveryMessage}
        </p>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
        <button
          type="button"
          onClick={() => void resumePending()}
          disabled={resuming || counts.pending === 0}
          style={{
            border: "1px solid rgba(56,189,248,.8)",
            borderRadius: 10,
            padding: "9px 12px",
            background: "rgba(14,116,144,.28)",
            color: "#fff",
            fontWeight: 800,
            cursor: resuming || counts.pending === 0 ? "not-allowed" : "pointer",
            opacity: resuming || counts.pending === 0 ? .55 : 1,
          }}
        >
          {resuming ? "Conferindo e retomando…" : `Retomar ${counts.pending} pendente(s)`}
        </button>
        <button
          type="button"
          onClick={openBroadcastCenter}
          style={{
            border: "1px solid rgba(215,174,96,.65)",
            borderRadius: 10,
            padding: "9px 12px",
            background: "rgba(215,174,96,.12)",
            color: "#f8dfa6",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Abrir Central
        </button>
        <button
          type="button"
          onClick={discardRecovery}
          disabled={resuming}
          style={{
            border: 0,
            padding: "9px 6px",
            background: "transparent",
            color: "#94a3b8",
            cursor: resuming ? "not-allowed" : "pointer",
          }}
        >
          Descartar recuperação
        </button>
      </div>
    </aside>
  );
}
