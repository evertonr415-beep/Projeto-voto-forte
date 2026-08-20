"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
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
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"compose" | "history">("compose");
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [canBroadcast, setCanBroadcast] = useState(true);
  const [toastNotification, setToastNotification] = useState<SystemNotification | null>(null);

  // Form de Envio de Comunicado
  const [cTitle, setCTitle] = useState("");
  const [cCategory, setCCategory] = useState<"urgente" | "comunicado" | "agenda" | "sistema">("comunicado");
  const [cMessage, setCMessage] = useState("");
  const [cPopupAlert, setCPopupAlert] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendSuccessMessage, setSendSuccessMessage] = useState("");

  const initialLoaded = useRef(false);
  const previousCount = useRef(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Carrega notificações lidas do localStorage
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
      if (data.canBroadcast !== undefined) {
        setCanBroadcast(Boolean(data.canBroadcast));
      }

      // Alerta de novo comunicado
      if (initialLoaded.current && list.length > previousCount.current) {
        const newest = list[0];
        if (newest && !readIds.has(newest.id)) {
          setToastNotification(newest);
        }
      } else if (!initialLoaded.current) {
        initialLoaded.current = true;
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

  // Intercepta qualquer clique no ícone do trevo / notificação
  useEffect(() => {
    const handleOpen = () => {
      setIsOpen(true);
      setActiveTab("compose");
      setSendSuccessMessage("");
    };

    window.addEventListener("voto-forte:open-notifications", handleOpen);
    (window as any).vfOpenNotifications = handleOpen;

    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const notifBtn = target.closest<HTMLElement>(
        ".notification, [aria-label='Notificações'], [data-action='notifications'], .vf-notif-trigger",
      );
      if (notifBtn) {
        event.preventDefault();
        event.stopPropagation();
        setIsOpen((prev) => !prev);
        setActiveTab("compose");
        setSendSuccessMessage("");
      }
    };

    document.addEventListener("click", handleDocumentClick, true);

    const updateButtons = () => {
      const btns = document.querySelectorAll<HTMLElement>(".notification, [aria-label='Notificações']");
      btns.forEach((btn) => {
        btn.style.cursor = "pointer";
        btn.title = "Disparar aviso para os usuários do sistema";
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
      document.removeEventListener("click", handleDocumentClick, true);
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
      alert("Por favor, preencha o título e a mensagem do aviso.");
      return;
    }
    setSending(true);
    setSendSuccessMessage("");
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
        throw new Error(data.error || "Erro ao disparar aviso.");
      }
      setCTitle("");
      setCMessage("");
      setSendSuccessMessage("✅ Notificação disparada com sucesso para todos os usuários logados!");
      void fetchNotifications();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao enviar comunicado");
    } finally {
      setSending(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <>
      {/* TOAST FLUTUANTE DE ALERTA IMEDIATO */}
      {toastNotification && (
        <div
          className="vf-notif-toast"
          onClick={() => {
            markAsRead(toastNotification.id);
            setToastNotification(null);
            setIsOpen(true);
            setActiveTab("history");
          }}
          title="Clique para abrir comunicado"
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

      {/* MODAL / DRAWER PRINCIPAL DE DISPARO DE AVISO E NOTIFICAÇÕES */}
      {isOpen && (
        <div
          className="vf-notif-backdrop"
          onClick={(e) => e.target === e.currentTarget && setIsOpen(false)}
        >
          <div className="vf-notif-drawer" style={{ maxWidth: "520px" }}>
            {/* CABEÇALHO */}
            <div className="vf-notif-header">
              <div className="vf-notif-title-area">
                <div className="vf-notif-icon-circle">♣</div>
                <div>
                  <h2>Disparo de Avisos & Notificações</h2>
                  <p>Comunicação instantânea para todos os usuários</p>
                </div>
              </div>
              <button
                type="button"
                className="vf-notif-close-btn"
                onClick={() => setIsOpen(false)}
                title="Fechar"
              >
                ✕
              </button>
            </div>

            {/* ABAS DE NAVEGAÇÃO INTERNA */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", padding: "10px 16px", background: "#07111e", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("compose");
                  setSendSuccessMessage("");
                }}
                style={{
                  padding: "10px 12px",
                  borderRadius: "10px",
                  fontSize: "12.5px",
                  fontWeight: 850,
                  border: activeTab === "compose" ? "1px solid #eab308" : "1px solid rgba(255,255,255,0.08)",
                  background: activeTab === "compose" ? "linear-gradient(135deg, #eab308 0%, #ca8a04 100%)" : "transparent",
                  color: activeTab === "compose" ? "#0f172a" : "#94a3b8",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  transition: "all 0.15s ease",
                  boxShadow: activeTab === "compose" ? "0 4px 12px rgba(234, 179, 8, 0.3)" : "none",
                }}
              >
                📢 Disparar Novo Aviso
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("history")}
                style={{
                  padding: "10px 12px",
                  borderRadius: "10px",
                  fontSize: "12.5px",
                  fontWeight: 850,
                  border: activeTab === "history" ? "1px solid #38bdf8" : "1px solid rgba(255,255,255,0.08)",
                  background: activeTab === "history" ? "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)" : "transparent",
                  color: activeTab === "history" ? "#ffffff" : "#94a3b8",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  transition: "all 0.15s ease",
                  boxShadow: activeTab === "history" ? "0 4px 12px rgba(2, 132, 199, 0.3)" : "none",
                }}
              >
                📬 Avisos ({unreadCount > 0 ? `${unreadCount} novos` : notifications.length})
              </button>
            </div>

            {/* CONTEÚDO DA ABA 1: DISPARAR AVISO */}
            {activeTab === "compose" && (
              <div className="vf-notif-body" style={{ padding: "18px" }}>
                {sendSuccessMessage && (
                  <div style={{ padding: "12px 14px", borderRadius: "10px", background: "rgba(34, 197, 94, 0.15)", border: "1px solid #22c55e", color: "#86efac", fontSize: "0.85rem", fontWeight: 700 }}>
                    {sendSuccessMessage}
                  </div>
                )}

                <form onSubmit={handleSendBroadcast} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  <div className="vf-composer-field">
                    <label>Título do Aviso / Comunicado</label>
                    <input
                      className="vf-composer-input"
                      placeholder="Ex.: Reunião Geral de Alinhamento com a Equipe"
                      value={cTitle}
                      onChange={(e) => setCTitle(e.target.value)}
                      required
                    />
                  </div>

                  <div className="vf-composer-field">
                    <label>Tipo / Prioridade do Aviso</label>
                    <select
                      className="vf-composer-select"
                      value={cCategory}
                      onChange={(e) => setCCategory(e.target.value as any)}
                    >
                      <option value="comunicado">📢 Comunicado Geral (Padrão)</option>
                      <option value="urgente">⚡ Urgente / Prioritário</option>
                      <option value="agenda">📅 Agenda / Evento de Campanha</option>
                      <option value="sistema">🛡️ Alerta do Sistema</option>
                    </select>
                  </div>

                  <div className="vf-composer-field">
                    <label>Mensagem / Conteúdo para os Usuários</label>
                    <textarea
                      className="vf-composer-textarea"
                      rows={5}
                      placeholder="Escreva aqui a mensagem completa que aparecerá na tela de todos os usuários logados no sistema..."
                      value={cMessage}
                      onChange={(e) => setCMessage(e.target.value)}
                      required
                    />
                  </div>

                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.84rem", color: "#cbd5e1", cursor: "pointer", marginTop: "2px" }}>
                    <input
                      type="checkbox"
                      checked={cPopupAlert}
                      onChange={(e) => setCPopupAlert(e.target.checked)}
                    />
                    <span>Exibir alerta flutuante (*pop-up*) na tela de quem estiver logado agora</span>
                  </label>

                  <button
                    type="submit"
                    className="vf-notif-broadcast-btn"
                    style={{ marginTop: "10px", padding: "13px", fontSize: "0.95rem" }}
                    disabled={sending}
                  >
                    {sending ? "Disparando aviso..." : "🚀 Disparar Aviso para Todos os Usuários"}
                  </button>
                </form>
              </div>
            )}

            {/* CONTEÚDO DA ABA 2: HISTÓRICO DE AVISOS */}
            {activeTab === "history" && (
              <>
                <div className="vf-notif-actions-bar">
                  <span className="vf-notif-badge-counter">
                    {unreadCount} aviso{unreadCount === 1 ? "" : "s"} não lido{unreadCount === 1 ? "" : "s"}
                  </span>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      className="vf-notif-mark-read-btn"
                      onClick={markAllAsRead}
                    >
                      ✓ Marcar todos como lidos
                    </button>
                  )}
                </div>

                <div className="vf-notif-body">
                  {notifications.length === 0 ? (
                    <div className="vf-notif-empty">
                      <div className="vf-notif-empty-icon">🔔</div>
                      <p>Nenhum comunicado no histórico.</p>
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
                                Marcar como lida
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
              </>
            )}
          </div>
        </div>
      )}
    </>,
    document.body,
  );
}
