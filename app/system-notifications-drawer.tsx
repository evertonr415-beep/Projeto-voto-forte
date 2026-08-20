"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { apiFetch } from "./supabase-client";

export type SystemNotification = {
  id: string;
  title: string;
  message: string;
  category: "urgente" | "comunicado" | "agenda" | "sistema";
  sender_name: string;
  sender_email: string;
  sender_role: string;
  created_at: string;
  popup_alert?: boolean;
};

const READ_STORAGE_KEY = "vf_read_notifications_v1";

function timeAgo(dateIso: string) {
  const diff = Date.now() - new Date(dateIso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Agora mesmo";
  if (mins < 60) return `Há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Há ${hours} h`;
  const days = Math.floor(hours / 24);
  return `Há ${days} dia(s)`;
}

export default function SystemNotificationsDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [canBroadcast, setCanBroadcast] = useState(false);
  const [toastNotification, setToastNotification] = useState<SystemNotification | null>(null);

  // Modal Master Composer
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [cTitle, setCTitle] = useState("");
  const [cCategory, setCCategory] = useState<"urgente" | "comunicado" | "agenda" | "sistema">("comunicado");
  const [cMessage, setCMessage] = useState("");
  const [cPopupAlert, setCPopupAlert] = useState(true);
  const [sending, setSending] = useState(false);

  const initialLoaded = useRef(false);
  const previousCount = useRef(0);

  // Load read notifications from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(READ_STORAGE_KEY);
      if (raw) {
        setReadIds(new Set(JSON.parse(raw)));
      }
    } catch {
      // Ignore
    }
  }, []);

  const saveReadIds = (newSet: Set<string>) => {
    setReadIds(newSet);
    try {
      localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(Array.from(newSet)));
    } catch {
      // Ignore
    }
  };

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await apiFetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      const list = (data.notifications || []) as SystemNotification[];
      setNotifications(list);
      setCanBroadcast(Boolean(data.canBroadcast));

      // Check if there is a new urgent notification for toast
      if (initialLoaded.current && list.length > previousCount.current) {
        const newest = list[0];
        if (newest && !readIds.has(newest.id)) {
          setToastNotification(newest);
        }
      } else if (!initialLoaded.current) {
        initialLoaded.current = true;
        // On initial login, if there is an unread urgent notification, show toast
        const unreadUrgent = list.find((n) => n.category === "urgente" && !readIds.has(n.id));
        if (unreadUrgent) {
          setToastNotification(unreadUrgent);
        }
      }
      previousCount.current = list.length;
    } catch {
      // Ignore fetch error
    }
  }, [readIds]);

  useEffect(() => {
    void fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length;

  // Intercept and update existing topbar notification button
  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener("voto-forte:open-notifications", handleOpen);

    const updateButtons = () => {
      const btns = document.querySelectorAll<HTMLElement>(".notification, [aria-label='Notificações']");
      btns.forEach((btn) => {
        btn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(true);
        };
        const badge = btn.querySelector("i");
        if (badge) {
          if (unreadCount > 0) {
            badge.textContent = String(unreadCount);
            badge.style.display = "inline-flex";
          } else {
            badge.style.display = "none";
          }
        }
      });
    };

    updateButtons();
    const obs = new MutationObserver(updateButtons);
    obs.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.removeEventListener("voto-forte:open-notifications", handleOpen);
      obs.disconnect();
    };
  }, [unreadCount]);

  const markAllAsRead = () => {
    const all = new Set<string>(notifications.map((n) => n.id));
    saveReadIds(all);
  };

  const markAsRead = (id: string) => {
    const next = new Set(readIds);
    next.add(id);
    saveReadIds(next);
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cTitle.trim() || !cMessage.trim()) {
      alert("Por favor, preencha o título e a mensagem.");
      return;
    }
    setSending(true);
    try {
      const res = await apiFetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: cTitle.trim(),
          category: cCategory,
          message: cMessage.trim(),
          popup_alert: cPopupAlert,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao enviar notificação.");
      }
      setCTitle("");
      setCMessage("");
      setIsComposerOpen(false);
      void fetchNotifications();
      alert("📢 Comunicado enviado com sucesso para todos os usuários logados!");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao enviar comunicado");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* TOAST FLUTUANTE DE NOTIFICAÇÃO IMEDIATA */}
      {toastNotification && (
        <div
          className="vf-notif-toast"
          onClick={() => {
            markAsRead(toastNotification.id);
            setToastNotification(null);
            setIsOpen(true);
          }}
          title="Clique para abrir"
        >
          <div className="vf-notif-toast-icon">
            {toastNotification.category === "urgente"
              ? "⚡"
              : toastNotification.category === "agenda"
              ? "📅"
              : "📢"}
          </div>
          <div className="vf-notif-toast-content">
            <strong>{toastNotification.title}</strong>
            <p>{toastNotification.message.slice(0, 85)}{toastNotification.message.length > 85 ? "..." : ""}</p>
          </div>
          <button
            type="button"
            style={{
              background: "transparent",
              border: "none",
              color: "#94a3b8",
              cursor: "pointer",
              fontSize: "14px",
              marginLeft: "auto",
            }}
            onClick={(e) => {
              e.stopPropagation();
              setToastNotification(null);
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* DRAWER DA CENTRAL DE NOTIFICAÇÕES */}
      {isOpen && (
        <div
          className="vf-notif-backdrop"
          onClick={(e) => e.target === e.currentTarget && setIsOpen(false)}
        >
          <div className="vf-notif-drawer">
            {/* HEADER */}
            <div className="vf-notif-header">
              <div className="vf-notif-title-area">
                <div className="vf-notif-icon-circle">♧</div>
                <div>
                  <h2>Central de Notificações</h2>
                  <p>Avisos, comunicados e metas em tempo real</p>
                </div>
              </div>
              <button
                type="button"
                className="vf-notif-close-btn"
                onClick={() => setIsOpen(false)}
              >
                ✕
              </button>
            </div>

            {/* BOTÃO EXCLUSIVO MASTER PARA ENVIAR COMUNICADO */}
            {canBroadcast && (
              <div className="vf-notif-master-banner">
                <button
                  type="button"
                  className="vf-notif-broadcast-btn"
                  onClick={() => setIsComposerOpen(true)}
                >
                  📢 Enviar Comunicado Geral para Toda a Equipe
                </button>
              </div>
            )}

            {/* BARRA DE AÇÕES */}
            <div className="vf-notif-actions-bar">
              <span className="vf-notif-badge-counter">
                {unreadCount} não lida{unreadCount === 1 ? "" : "s"}
              </span>
              {unreadCount > 0 && (
                <button
                  type="button"
                  className="vf-notif-mark-read-btn"
                  onClick={markAllAsRead}
                >
                  ✓ Marcar todas como lidas
                </button>
              )}
            </div>

            {/* LISTA DE NOTIFICAÇÕES */}
            <div className="vf-notif-body">
              {notifications.length === 0 ? (
                <div className="vf-notif-empty">
                  <div className="vf-notif-empty-icon">🔔</div>
                  <p>Nenhuma notificação no momento.</p>
                </div>
              ) : (
                notifications.map((n) => {
                  const isUnread = !readIds.has(n.id);
                  return (
                    <article
                      key={n.id}
                      className={`vf-notif-card ${isUnread ? "is-unread" : ""}`}
                      onClick={() => isUnread && markAsRead(n.id)}
                      style={{ cursor: isUnread ? "pointer" : "default" }}
                    >
                      <div className="vf-notif-card-head">
                        <span className={`vf-notif-tag ${n.category}`}>
                          {n.category === "urgente" && "⚡ Urgente"}
                          {n.category === "comunicado" && "📢 Comunicado"}
                          {n.category === "agenda" && "📅 Agenda"}
                          {n.category === "sistema" && "🛡️ Sistema"}
                        </span>
                        <span className="vf-notif-time">{timeAgo(n.created_at)}</span>
                      </div>

                      <h3 className="vf-notif-card-title">{n.title}</h3>
                      <p className="vf-notif-card-message">{n.message}</p>

                      <div className="vf-notif-card-footer">
                        <span className="vf-notif-sender">
                          👤 {n.sender_name} ({n.sender_role})
                        </span>
                        {isUnread ? (
                          <button
                            type="button"
                            className="vf-notif-mark-read-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              markAsRead(n.id);
                            }}
                          >
                            Marcar lida
                          </button>
                        ) : (
                          <span style={{ color: "#64748b" }}>✓ Lida</span>
                        )}
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE COMPOSIÇÃO DE COMUNICADO PARA USUÁRIOS MASTER */}
      {isComposerOpen && (
        <div
          className="vf-composer-modal"
          onClick={(e) => e.target === e.currentTarget && setIsComposerOpen(false)}
        >
          <div className="vf-composer-card">
            <div className="vf-composer-head">
              <div>
                <h2 style={{ margin: 0, fontSize: "1.1rem", color: "#fde047" }}>
                  📢 Novo Comunicado Geral da Coordenação (Master)
                </h2>
                <small style={{ color: "#94a3b8" }}>
                  Esta mensagem será notificada a todos os usuários conectados na plataforma.
                </small>
              </div>
              <button
                type="button"
                className="vf-notif-close-btn"
                onClick={() => setIsComposerOpen(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSendBroadcast}>
              <div className="vf-composer-body">
                <div className="vf-composer-field">
                  <label>Título do Comunicado</label>
                  <input
                    className="vf-composer-input"
                    placeholder="Ex.: Reunião Geral de Alinhamento / Meta da Semana..."
                    value={cTitle}
                    onChange={(e) => setCTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="vf-composer-field">
                  <label>Tipo / Prioridade</label>
                  <select
                    className="vf-composer-select"
                    value={cCategory}
                    onChange={(e) => setCCategory(e.target.value as any)}
                  >
                    <option value="comunicado">📢 Comunicado Geral</option>
                    <option value="urgente">⚡ Urgente / Prioritário</option>
                    <option value="agenda">📅 Agenda / Evento</option>
                    <option value="sistema">🛡️ Alerta do Sistema</option>
                  </select>
                </div>

                <div className="vf-composer-field">
                  <label>Mensagem / Conteúdo</label>
                  <textarea
                    className="vf-composer-textarea"
                    rows={4}
                    placeholder="Digite aqui as orientações, diretrizes ou comunicado para a equipe..."
                    value={cMessage}
                    onChange={(e) => setCMessage(e.target.value)}
                    required
                  />
                </div>

                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.84rem", color: "#cbd5e1", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={cPopupAlert}
                    onChange={(e) => setCPopupAlert(e.target.checked)}
                  />
                  <span>Exibir alerta flutuante imediato na tela dos usuários logados</span>
                </label>
              </div>

              <div className="vf-composer-actions">
                <button
                  type="button"
                  className="vf-notif-close-btn"
                  style={{ width: "auto", padding: "0 14px", height: "38px" }}
                  onClick={() => setIsComposerOpen(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="vf-notif-broadcast-btn"
                  style={{ width: "auto", padding: "10px 20px" }}
                  disabled={sending}
                >
                  {sending ? "Enviando..." : "🚀 Publicar e Notificar Equipe"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
