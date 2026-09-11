"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { apiFetch } from "../supabase-client";
import { Icons } from "../ui-icons";
import "./whatsapp-chat.css";

export type ChatConversation = {
  id: string;
  phone: string;
  contactName: string;
  district?: string;
  avatarUrl?: string;
  lastMessageText: string;
  lastMessageTime: string;
  lastDirection: "inbound" | "outbound" | "status";
  lastStatus: "sent" | "delivered" | "read" | "failed" | "received";
  unreadCount: number;
  totalMessages: number;
  votingSentiment?: string;
};

export type ChatMessage = {
  id: string;
  messageId?: string;
  phone: string;
  direction: "inbound" | "outbound";
  text: string;
  type: string;
  status: "sent" | "delivered" | "read" | "failed" | "received";
  timestamp: string;
  senderName?: string;
};

export default function WhatsAppChatClient({
  onBackToDashboard,
  initialPhone,
}: {
  onBackToDashboard?: () => void;
  initialPhone?: string;
}) {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<string>(initialPhone || "");
  const [selectedContact, setSelectedContact] = useState<{
    name?: string;
    district?: string;
    phone?: string;
    notes?: string;
  } | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "unread" | "replies" | "sent">("all");
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Formata telefone para exibição elegante
  const formatPhone = (raw: string) => {
    const digits = String(raw || "").replace(/\D/g, "");
    if (digits.startsWith("55") && digits.length === 13) {
      return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
    }
    if (digits.startsWith("55") && digits.length === 12) {
      return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`;
    }
    if (digits.length === 11) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }
    if (digits.length === 10) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
    return raw;
  };

  // Formata hora amigável estilo WhatsApp
  const formatTime = (isoString?: string) => {
    if (!isoString) return "";
    try {
      const date = new Date(isoString);
      const now = new Date();
      const isToday =
        date.getDate() === now.getDate() &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear();

      if (isToday) {
        return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      }

      const yesterday = new Date();
      yesterday.setDate(now.getDate() - 1);
      const isYesterday =
        date.getDate() === yesterday.getDate() &&
        date.getMonth() === yesterday.getMonth() &&
        date.getFullYear() === yesterday.getFullYear();

      if (isYesterday) return "Ontem";

      return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    } catch {
      return "";
    }
  };

  // Carrega lista de conversas
  const loadConversations = useCallback(async (silent = false) => {
    if (!silent) setLoadingList(true);
    try {
      const res = await apiFetch(`/api/whatsapp/chat?search=${encodeURIComponent(searchQuery)}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setConversations(data.conversations || []);
        // Se nenhuma conversa selecionada e temos lista, seleciona a primeira (no desktop)
        if (!selectedPhone && data.conversations?.length > 0 && window.innerWidth > 768) {
          setSelectedPhone(data.conversations[0].phone);
        }
      }
    } catch (err) {
      console.warn("Erro ao carregar conversas do WhatsApp:", err);
    } finally {
      if (!silent) setLoadingList(false);
    }
  }, [searchQuery, selectedPhone]);

  // Carrega histórico da conversa selecionada
  const loadMessages = useCallback(async (phone: string, silent = false) => {
    if (!phone) return;
    if (!silent) setLoadingMessages(true);
    try {
      const res = await apiFetch(`/api/whatsapp/chat?phone=${encodeURIComponent(phone)}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessages(data.messages || []);
        if (data.contact) {
          setSelectedContact(data.contact);
        }
      }
    } catch (err) {
      console.warn("Erro ao carregar mensagens da conversa:", err);
    } finally {
      if (!silent) setLoadingMessages(false);
    }
  }, []);

  // Polling automático da lista e da conversa ativa
  useEffect(() => {
    void loadConversations();
    const interval = setInterval(() => {
      void loadConversations(true);
    }, 4000);
    return () => clearInterval(interval);
  }, [loadConversations]);

  useEffect(() => {
    if (selectedPhone) {
      void loadMessages(selectedPhone);
      const interval = setInterval(() => {
        void loadMessages(selectedPhone, true);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [selectedPhone, loadMessages]);

  // Scroll automático para a última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Envio de mensagem
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !selectedPhone || sending) return;

    const messageText = inputText.trim();
    setInputText("");
    setSending(true);

    // Otimismo na UI
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: ChatMessage = {
      id: tempId,
      phone: selectedPhone,
      direction: "outbound",
      text: messageText,
      type: "text",
      status: "sent",
      timestamp: new Date().toISOString(),
      senderName: "Voto Forte",
    };

    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const res = await apiFetch("/api/whatsapp/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: selectedPhone,
          message: messageText,
          contactName: selectedContact?.name || activeConv?.contactName,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, status: "failed" } : m)),
        );
      } else {
        void loadMessages(selectedPhone, true);
        void loadConversations(true);
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, status: "failed" } : m)),
      );
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSendMessage();
    }
  };

  // Filtragem da lista
  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      if (activeFilter === "unread") return c.unreadCount > 0;
      if (activeFilter === "replies") return c.lastDirection === "inbound";
      if (activeFilter === "sent") return c.lastDirection === "outbound";
      return true;
    });
  }, [conversations, activeFilter]);

  const activeConv = useMemo(() => {
    return conversations.find((c) => c.phone === selectedPhone);
  }, [conversations, selectedPhone]);

  return (
    <div className="wa-container">
      {/* Sidebar: Lista de Conversas */}
      <div className={`wa-sidebar ${selectedPhone ? "is-hidden-mobile" : ""}`}>
        <div className="wa-sidebar-header">
          <div className="wa-profile-row">
            <div className="wa-profile-avatar">VF</div>
            <div>
              <div className="wa-profile-title">
                WhatsApp Oficial
                <span className="wa-profile-badge">Meta Cloud</span>
              </div>
            </div>
          </div>
          <div className="wa-header-actions">
            {onBackToDashboard && (
              <button
                type="button"
                className="wa-icon-btn"
                title="Voltar ao Painel"
                onClick={onBackToDashboard}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Busca */}
        <div className="wa-search-container">
          <div className="wa-search-box">
            <span className="wa-search-icon">🔍</span>
            <input
              type="text"
              className="wa-search-input"
              placeholder="Pesquisar ou começar uma nova conversa"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Filtros */}
        <div className="wa-filter-chips">
          <button
            type="button"
            className={`wa-filter-chip ${activeFilter === "all" ? "active" : ""}`}
            onClick={() => setActiveFilter("all")}
          >
            Todas
          </button>
          <button
            type="button"
            className={`wa-filter-chip ${activeFilter === "unread" ? "active" : ""}`}
            onClick={() => setActiveFilter("unread")}
          >
            Não lidas
          </button>
          <button
            type="button"
            className={`wa-filter-chip ${activeFilter === "replies" ? "active" : ""}`}
            onClick={() => setActiveFilter("replies")}
          >
            Respostas ({conversations.filter((c) => c.lastDirection === "inbound").length})
          </button>
          <button
            type="button"
            className={`wa-filter-chip ${activeFilter === "sent" ? "active" : ""}`}
            onClick={() => setActiveFilter("sent")}
          >
            Disparos
          </button>
        </div>

        {/* Lista */}
        <div className="wa-conversation-list">
          {loadingList && conversations.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: "#8696a0", fontSize: 13 }}>
              Carregando conversas do WhatsApp…
            </div>
          ) : filteredConversations.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: "#8696a0", fontSize: 13 }}>
              Nenhuma conversa encontrada.
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isActive = conv.phone === selectedPhone;
              const initial = (conv.contactName || "E").charAt(0).toUpperCase();

              return (
                <div
                  key={conv.phone}
                  className={`wa-conversation-item ${isActive ? "is-active" : ""}`}
                  onClick={() => setSelectedPhone(conv.phone)}
                >
                  <div className="wa-conv-avatar">
                    {initial}
                  </div>
                  <div className="wa-conv-details">
                    <div className="wa-conv-top">
                      <span className="wa-conv-name" title={conv.contactName}>
                        {conv.contactName}
                        {conv.district && (
                          <span className="wa-conv-district">{conv.district}</span>
                        )}
                      </span>
                      <span className="wa-conv-time">{formatTime(conv.lastMessageTime)}</span>
                    </div>
                    <div className="wa-conv-bottom">
                      <div className="wa-conv-preview">
                        {conv.lastDirection === "outbound" && (
                          <span className="wa-check-icon">
                            {conv.lastStatus === "read" ? (
                              <span className="wa-check-blue">✓✓</span>
                            ) : conv.lastStatus === "delivered" ? (
                              <span className="wa-check-grey">✓✓</span>
                            ) : conv.lastStatus === "failed" ? (
                              <span style={{ color: "#ea0038" }}>⚠️</span>
                            ) : (
                              <span className="wa-check-grey">✓</span>
                            )}
                          </span>
                        )}
                        <span>{conv.lastMessageText}</span>
                      </div>
                      {conv.unreadCount > 0 && (
                        <div className="wa-conv-badge">{conv.unreadCount}</div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Painel Central: Chat Aberto */}
      {selectedPhone ? (
        <div className={`wa-chat-area ${!selectedPhone ? "is-hidden-mobile" : ""}`}>
          {/* Header do Chat */}
          <div className="wa-chat-header">
            <div className="wa-chat-header-user">
              <button
                type="button"
                className="wa-back-btn"
                onClick={() => setSelectedPhone("")}
                title="Voltar para a lista"
              >
                ←
              </button>
              <div className="wa-chat-header-avatar">
                {(selectedContact?.name || activeConv?.contactName || "E").charAt(0).toUpperCase()}
              </div>
              <div className="wa-chat-header-info">
                <div className="wa-chat-header-name">
                  {selectedContact?.name || activeConv?.contactName || formatPhone(selectedPhone)}
                  {selectedContact?.district && (
                    <span className="wa-conv-district">{selectedContact.district}</span>
                  )}
                </div>
                <div className="wa-chat-header-status">
                  {formatPhone(selectedPhone)} • online via WhatsApp API
                </div>
              </div>
            </div>

            <div className="wa-chat-header-actions">
              <button
                type="button"
                className="wa-icon-btn"
                title="Atualizar mensagens"
                onClick={() => void loadMessages(selectedPhone)}
              >
                🔄
              </button>
            </div>
          </div>

          {/* Quick Action Bar / Enquete */}
          <div className="wa-survey-action-bar">
            <span>💡 <strong>Ação Rápida:</strong> Enviar pergunta de intenção de voto</span>
            <button
              type="button"
              className="wa-survey-btn-pill"
              onClick={() => {
                setInputText(
                  `Olá! Gostaríamos de saber sua opinião para Arapongas. Quem você prefere para Deputado Estadual e Federal nas próximas eleições?`,
                );
              }}
            >
              📋 Inserir Pergunta da Enquete
            </button>
          </div>

          {/* Área de Mensagens (Thread) */}
          <div className="wa-messages-body">
            <div className="wa-date-divider">
              🔒 As mensagens são protegidas pela criptografia de ponta a ponta da Meta
            </div>

            {loadingMessages && messages.length === 0 ? (
              <div style={{ textAlign: "center", color: "#8696a0", padding: 20 }}>
                Carregando histórico de mensagens…
              </div>
            ) : messages.length === 0 ? (
              <div style={{ textAlign: "center", color: "#8696a0", padding: 40 }}>
                Nenhuma mensagem nesta conversa ainda. Envie uma mensagem abaixo para iniciar!
              </div>
            ) : (
              messages.map((msg) => {
                const isInbound = msg.direction === "inbound";
                return (
                  <div
                    key={msg.id}
                    className={`wa-bubble-row ${isInbound ? "inbound" : "outbound"}`}
                  >
                    <div className={`wa-bubble ${isInbound ? "inbound" : "outbound"}`}>
                      {isInbound && msg.senderName && (
                        <div className="wa-bubble-sender">{msg.senderName}</div>
                      )}
                      <div className="wa-bubble-text">{msg.text}</div>
                      <div className="wa-bubble-meta">
                        <span className="wa-bubble-time">{formatTime(msg.timestamp)}</span>
                        {!isInbound && (
                          <span className="wa-check-icon">
                            {msg.status === "read" ? (
                              <span className="wa-check-blue">✓✓</span>
                            ) : msg.status === "delivered" ? (
                              <span className="wa-check-grey">✓✓</span>
                            ) : msg.status === "failed" ? (
                              <span style={{ color: "#ea0038" }}>⚠️</span>
                            ) : (
                              <span className="wa-check-grey">✓</span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Footer de Envio */}
          <div className="wa-chat-input-bar">
            <button
              type="button"
              className="wa-icon-btn"
              title="Emoji"
              onClick={() => setInputText((prev) => prev + " 🤝")}
            >
              😊
            </button>
            <div className="wa-input-wrapper">
              <textarea
                className="wa-input-field"
                rows={1}
                placeholder="Digite uma mensagem"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>
            <button
              type="button"
              className="wa-send-btn"
              onClick={() => void handleSendMessage()}
              disabled={!inputText.trim() || sending}
              title="Enviar Mensagem"
            >
              {sending ? "⏳" : "➤"}
            </button>
          </div>
        </div>
      ) : (
        /* Estado Vazio (quando nenhuma conversa está selecionada no Desktop) */
        <div className="wa-empty-chat">
          <div className="wa-empty-icon">
            <Icons.WhatsApp size={64} />
          </div>
          <div className="wa-empty-title">Voto Forte WhatsApp Web</div>
          <div className="wa-empty-subtitle">
            Acompanhe em tempo real todas as mensagens enviadas pela API da Meta, receba as respostas dos eleitores e interaja diretamente como no WhatsApp.
          </div>
          <div className="wa-encryption-badge">
            🔒 Integrado com a Meta Cloud API Oficial
          </div>
        </div>
      )}
    </div>
  );
}
