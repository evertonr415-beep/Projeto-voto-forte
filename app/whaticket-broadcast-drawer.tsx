"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { apiFetch } from "./supabase-client";

type ContactItem = {
  id: number;
  name: string;
  phone: string;
  district?: string;
  leader?: string;
  kind?: "Eleitor" | "Liderança";
  ownerEmail?: string;
};

type LogItem = {
  id: string;
  name: string;
  phone: string;
  district?: string;
  status: "pending" | "sending" | "sent" | "error";
  error?: string;
  time: string;
};

const DEFAULT_API_URL = "https://zapapi.dgsis.com.br";
const STORAGE_API_URL_KEY = "voto-forte:whaticket:apiUrl";
const STORAGE_API_TOKEN_KEY = "voto-forte:whaticket:apiToken";
const STORAGE_DELAY_KEY = "voto-forte:whaticket:delaySeconds";

export default function WhaticketBroadcastDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"disparo" | "config" | "logs">("disparo");

  // API Config
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL);
  const [apiToken, setApiToken] = useState("");
  const [delaySeconds, setDelaySeconds] = useState(5);
  const [testPhone, setTestPhone] = useState("");
  const [testStatus, setTestStatus] = useState<string>("");

  // Audience & Filtering
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [selectedDistrict, setSelectedDistrict] = useState("Todos");
  const [selectedKind, setSelectedKind] = useState<"Todos" | "Eleitor" | "Liderança">("Todos");
  const [recipientLimit, setRecipientLimit] = useState<number>(50);

  // Message Composer & Media
  const [messageTemplate, setMessageTemplate] = useState(
    "Olá, {nome}! Tudo bem? Passando para te convidar para o nosso próximo encontro do VOTO FORTE no bairro {bairro}. Contamos com seu apoio!",
  );
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaBase64, setMediaBase64] = useState<string | null>(null);
  const [mediaName, setMediaName] = useState<string>("");
  const [mediaUrl, setMediaUrl] = useState<string>("");
  const mediaInputRef = useRef<HTMLInputElement>(null);

  const handleSelectMedia = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("A imagem selecionada deve ter no máximo 5MB.");
      return;
    }

    setMediaFile(file);
    setMediaName(file.name);

    const reader = new FileReader();
    reader.onload = () => {
      setMediaBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const clearMedia = () => {
    setMediaFile(null);
    setMediaBase64(null);
    setMediaName("");
    setMediaUrl("");
    if (mediaInputRef.current) mediaInputRef.current.value = "";
  };

  // Execution State
  const [isExecuting, setIsExecuting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const abortControllerRef = useRef<boolean>(false);
  const pausedRef = useRef<boolean>(false);

  // Load saved credentials and register open event
  useEffect(() => {
    try {
      const savedUrl = localStorage.getItem(STORAGE_API_URL_KEY);
      const savedToken = localStorage.getItem(STORAGE_API_TOKEN_KEY);
      const savedDelay = localStorage.getItem(STORAGE_DELAY_KEY);
      if (savedUrl) setApiUrl(savedUrl);
      if (savedToken) setApiToken(savedToken);
      if (savedDelay) setDelaySeconds(Number(savedDelay) || 5);
    } catch {
      // LocalStorage access fallback
    }

    const handleOpenDrawer = () => {
      setIsOpen(true);
    };

    window.addEventListener("voto-forte:open-whaticket-drawer", handleOpenDrawer);
    return () => {
      window.removeEventListener("voto-forte:open-whaticket-drawer", handleOpenDrawer);
    };
  }, []);

  // Ensure sidebar navigation button is mounted under WhatsApp
  useEffect(() => {
    let frameId = 0;
    const ensureSidebarItem = () => {
      const nav = document.querySelector<HTMLElement>(".sidebar nav");
      if (!nav || nav.querySelector(".whaticket-broadcast-sidebar-btn")) return;

      const allButtons = Array.from(nav.querySelectorAll("button"));
      const waButton = allButtons.find((btn) => btn.textContent?.includes("WhatsApp"));
      const targetAnchor = waButton?.nextSibling || nav.querySelector(".administration-nav-item") || null;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "whaticket-broadcast-sidebar-btn";
      btn.title = "Disparo em Massa";

      const icon = document.createElement("span");
      icon.className = "nav-icon";
      icon.style.color = "#2ddd7f";
      icon.textContent = "⚡";

      const name = document.createElement("span");
      name.className = "nav-name";
      name.textContent = "Disparo em Massa";

      btn.append(icon, name);
      btn.addEventListener("click", () => {
        setIsOpen(true);
      });

      if (targetAnchor) {
        nav.insertBefore(btn, targetAnchor);
      } else {
        nav.appendChild(btn);
      }
    };

    ensureSidebarItem();
    const observer = new MutationObserver(() => {
      if (frameId) return;
      frameId = window.requestAnimationFrame(() => {
        frameId = 0;
        ensureSidebarItem();
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, []);

  // Save credentials on change
  const saveConfig = (url: string, token: string, delay: number) => {
    setApiUrl(url);
    setApiToken(token);
    setDelaySeconds(delay);
    try {
      localStorage.setItem(STORAGE_API_URL_KEY, url);
      localStorage.setItem(STORAGE_API_TOKEN_KEY, token);
      localStorage.setItem(STORAGE_DELAY_KEY, String(delay));
    } catch {
      // LocalStorage access fallback
    }
  };

  // Fetch contacts when drawer opens
  const fetchAudienceContacts = useCallback(async () => {
    setLoadingContacts(true);
    try {
      const res = await apiFetch("/api/contacts?pageSize=200&owner=all");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.contacts)) {
          setContacts(data.contacts);
        }
      }
    } catch {
      // Ignora erro de requisição em segundo plano
    } finally {
      setLoadingContacts(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && contacts.length === 0) {
      void fetchAudienceContacts();
    }
  }, [isOpen, contacts.length, fetchAudienceContacts]);

  // Distinct districts
  const distinctDistricts = useMemo(() => {
    const set = new Set<string>();
    contacts.forEach((c) => {
      if (c.district && c.district.trim()) set.add(c.district.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [contacts]);

  // Filtered recipient list
  const targetedRecipients = useMemo(() => {
    return contacts
      .filter((c) => {
        if (!c.phone || c.phone.replace(/\D/g, "").length < 10) return false;
        if (selectedDistrict !== "Todos" && c.district !== selectedDistrict) return false;
        if (selectedKind !== "Todos" && c.kind !== selectedKind) return false;
        return true;
      })
      .slice(0, recipientLimit > 0 ? recipientLimit : undefined);
  }, [contacts, selectedDistrict, selectedKind, recipientLimit]);

  // Preview replacement text
  const previewMessage = useMemo(() => {
    const sample = targetedRecipients[0] || {
      name: "João da Silva",
      district: "Centro",
      leader: "Coordenação Geral",
    };
    const firstName = (sample.name || "").split(" ")[0] || "Eleitor(a)";
    return messageTemplate
      .replace(/{nome}/gi, sample.name || "Amigo(a)")
      .replace(/{primeiro_nome}/gi, firstName)
      .replace(/{bairro}/gi, sample.district || "sua região")
      .replace(/{lideranca}/gi, sample.leader || "Liderança");
  }, [messageTemplate, targetedRecipients]);

  const insertTag = (tag: string) => {
    setMessageTemplate((prev) => `${prev} ${tag}`);
  };

  // Test single send via API
  const handleTestSend = async () => {
    if (!apiUrl || !apiToken) {
      setTestStatus("❌ Configure a URL da API e o Token primeiro.");
      return;
    }
    if (!testPhone) {
      setTestStatus("❌ Informe um número de telefone com DDD para teste.");
      return;
    }
    setTestStatus("⏳ Enviando mensagem de teste...");
    try {
      const res = await apiFetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiUrl,
          apiToken,
          phone: testPhone,
          message: "Teste de conexão do VOTO FORTE com Whaticket/ZapAPI realizado com sucesso! ✅",
          contactName: "Teste",
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestStatus("✅ Mensagem de teste enviada com sucesso no WhatsApp!");
      } else {
        setTestStatus(`❌ Falha: ${data.error || "Erro no envio"}`);
      }
    } catch (err) {
      setTestStatus(`❌ Erro de rede: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Broadcast Execution Loop
  const startBroadcast = async () => {
    if (!apiUrl || !apiToken) {
      setActiveTab("config");
      alert("Por favor, configure o Token da ZapAPI / Whaticket antes de iniciar.");
      return;
    }
    if (targetedRecipients.length === 0) {
      alert("Nenhum contato encontrado com os filtros selecionados.");
      return;
    }

    const initialLogs: LogItem[] = targetedRecipients.map((c, i) => ({
      id: `${c.id || i}-${c.phone}`,
      name: c.name || "Contato",
      phone: c.phone,
      district: c.district,
      status: "pending",
      time: "",
    }));

    setLogs(initialLogs);
    setIsExecuting(true);
    setIsPaused(false);
    setActiveTab("logs");
    abortControllerRef.current = false;
    pausedRef.current = false;

    for (let i = 0; i < targetedRecipients.length; i++) {
      if (abortControllerRef.current) break;

      while (pausedRef.current) {
        await new Promise((r) => setTimeout(r, 500));
        if (abortControllerRef.current) break;
      }

      if (abortControllerRef.current) break;

      setCurrentIndex(i);
      const recipient = targetedRecipients[i];
      const firstName = (recipient.name || "").split(" ")[0] || "Amigo(a)";
      const customizedText = messageTemplate
        .replace(/{nome}/gi, recipient.name || "Amigo(a)")
        .replace(/{primeiro_nome}/gi, firstName)
        .replace(/{bairro}/gi, recipient.district || "sua região")
        .replace(/{lideranca}/gi, recipient.leader || "Liderança");

      // Mark sending
      setLogs((prev) =>
        prev.map((log, idx) =>
          idx === i ? { ...log, status: "sending", time: new Date().toLocaleTimeString("pt-BR") } : log,
        ),
      );

      try {
        const response = await apiFetch("/api/whatsapp/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            apiUrl,
            apiToken,
            phone: recipient.phone,
            message: customizedText,
            contactName: recipient.name,
            mediaBase64: mediaBase64 || undefined,
            mediaUrl: mediaUrl || undefined,
            mediaName: mediaName || "santinho.jpg",
            mediaMimeType: mediaFile?.type || "image/jpeg",
          }),
        });

        const result = await response.json();
        const success = response.ok && result.success;

        setLogs((prev) =>
          prev.map((log, idx) =>
            idx === i
              ? {
                  ...log,
                  status: success ? "sent" : "error",
                  error: success ? undefined : result.error || "Falha no envio",
                  time: new Date().toLocaleTimeString("pt-BR"),
                }
              : log,
          ),
        );
      } catch (err) {
        setLogs((prev) =>
          prev.map((log, idx) =>
            idx === i
              ? {
                  ...log,
                  status: "error",
                  error: err instanceof Error ? err.message : "Erro de conexão",
                  time: new Date().toLocaleTimeString("pt-BR"),
                }
              : log,
          ),
        );
      }

      // Anti-ban delay between dispatches
      if (i < targetedRecipients.length - 1 && !abortControllerRef.current) {
        await new Promise((r) => setTimeout(r, Math.max(2, delaySeconds) * 1000));
      }
    }

    setIsExecuting(false);
  };

  const togglePause = () => {
    const next = !isPaused;
    setIsPaused(next);
    pausedRef.current = next;
  };

  const cancelBroadcast = () => {
    abortControllerRef.current = true;
    setIsExecuting(false);
    setIsPaused(false);
  };

  // Stats Counters
  const sentCount = logs.filter((l) => l.status === "sent").length;
  const errorCount = logs.filter((l) => l.status === "error").length;
  const totalCount = logs.length || targetedRecipients.length;
  const progressPercent = totalCount > 0 ? Math.round((logs.filter((l) => l.status === "sent" || l.status === "error").length / totalCount) * 100) : 0;

  return (
    <>
      {/* Backdrop Overlay */}
      <div
        className={`wt-drawer-overlay ${isOpen ? "is-open" : ""}`}
        onClick={() => !isExecuting && setIsOpen(false)}
      />

      {/* Right Slide-over Drawer */}
      <aside className={`wt-drawer ${isOpen ? "is-open" : ""}`} aria-hidden={!isOpen}>
        {/* Header */}
        <header className="wt-drawer-header">
          <div className="wt-drawer-title-group">
            <div className="wt-header-logo">
              <img
                src="/voto-forte-bandeira-icon.jpg"
                alt="VOTO FORTE"
                style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "8px" }}
              />
            </div>
            <div>
              <h2>
                Central de Disparos <span>⚡</span>
              </h2>
              <p>Integração Whaticket & ZapAPI em tempo real</p>
            </div>
          </div>
          <button
            type="button"
            className="wt-close-btn"
            onClick={() => setIsOpen(false)}
            title="Fechar painel"
          >
            ✕
          </button>
        </header>

        {/* Navigation Tabs */}
        <nav className="wt-tabs">
          <button
            type="button"
            className={`wt-tab-btn ${activeTab === "disparo" ? "is-active" : ""}`}
            onClick={() => setActiveTab("disparo")}
          >
            Campanha & Mensagem
          </button>
          <button
            type="button"
            className={`wt-tab-btn ${activeTab === "logs" ? "is-active" : ""}`}
            onClick={() => setActiveTab("logs")}
          >
            Progresso ao Vivo {isExecuting && "●"}
          </button>
          <button
            type="button"
            className={`wt-tab-btn ${activeTab === "config" ? "is-active" : ""}`}
            onClick={() => setActiveTab("config")}
          >
            Configurar API
          </button>
        </nav>

        {/* Body Content */}
        <div className="wt-drawer-body">
          {activeTab === "disparo" && (
            <>
              {/* Audience Selection Card */}
              <section className="wt-card">
                <div className="wt-card-title">
                  <span>👥</span> 1. Destinatários da Campanha
                </div>

                <div className="wt-form-group">
                  <label>Filtrar por Bairro</label>
                  <select
                    className="wt-select"
                    value={selectedDistrict}
                    onChange={(e) => setSelectedDistrict(e.target.value)}
                  >
                    <option value="Todos">Todos os Bairros ({contacts.length} contatos)</option>
                    {distinctDistricts.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="wt-form-group">
                    <label>Perfil</label>
                    <select
                      className="wt-select"
                      value={selectedKind}
                      onChange={(e) => setSelectedKind(e.target.value as any)}
                    >
                      <option value="Todos">Todos os Tipos</option>
                      <option value="Eleitor">Apenas Eleitores</option>
                      <option value="Liderança">Apenas Lideranças</option>
                    </select>
                  </div>

                  <div className="wt-form-group">
                    <label>Limite de Envios</label>
                    <select
                      className="wt-select"
                      value={recipientLimit}
                      onChange={(e) => setRecipientLimit(Number(e.target.value))}
                    >
                      <option value={20}>20 contatos</option>
                      <option value={50}>50 contatos</option>
                      <option value={100}>100 contatos</option>
                      <option value={300}>300 contatos</option>
                      <option value={9999}>Todos os contatos</option>
                    </select>
                  </div>
                </div>

                <div style={{ fontSize: "12px", color: "var(--wt-primary)", marginTop: "8px", fontWeight: 600 }}>
                  ✓ {targetedRecipients.length} contato(s) elegível(is) com WhatsApp válido
                </div>
              </section>

              {/* Message Composer Card */}
              <section className="wt-card">
                <div className="wt-card-title">
                  <span>✍️</span> 2. Conteúdo da Mensagem
                </div>

                <div className="wt-form-group">
                  <label>Tags Dinâmicas (Clique para inserir)</label>
                  <div className="wt-tags-bar">
                    <button type="button" className="wt-tag-pill" onClick={() => insertTag("{nome}")}>
                      + &#123;nome&#125;
                    </button>
                    <button type="button" className="wt-tag-pill" onClick={() => insertTag("{primeiro_nome}")}>
                      + &#123;primeiro_nome&#125;
                    </button>
                    <button type="button" className="wt-tag-pill" onClick={() => insertTag("{bairro}")}>
                      + &#123;bairro&#125;
                    </button>
                    <button type="button" className="wt-tag-pill" onClick={() => insertTag("{lideranca}")}>
                      + &#123;lideranca&#125;
                    </button>
                  </div>

                  <textarea
                    className="wt-textarea"
                    value={messageTemplate}
                    onChange={(e) => setMessageTemplate(e.target.value)}
                    placeholder="Digite a mensagem ou legenda da imagem do disparo..."
                  />
                </div>

                {/* ANEXO DE IMAGEM / SANTINHO DIGITAL */}
                <div className="wt-form-group" style={{ marginTop: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <label style={{ margin: 0, fontWeight: 700, fontSize: "12px", color: "var(--wt-text)" }}>
                      🖼️ Anexar Santinho / Panfleto (Opcional)
                    </label>
                    {mediaBase64 && (
                      <button
                        type="button"
                        onClick={clearMedia}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#ef4444",
                          fontSize: "11px",
                          fontWeight: 700,
                          cursor: "pointer",
                          textDecoration: "underline",
                        }}
                      >
                        ✕ Remover foto
                      </button>
                    )}
                  </div>

                  {!mediaBase64 ? (
                    <div
                      className="wt-upload-zone"
                      onClick={() => mediaInputRef.current?.click()}
                    >
                      <span style={{ fontSize: "24px" }}>📸</span>
                      <strong style={{ fontSize: "13px", color: "var(--wt-primary)" }}>
                        Clique para anexar foto ou panfleto
                      </strong>
                      <small style={{ color: "var(--wt-text-muted)", fontSize: "11px" }}>
                        Formatos JPG, PNG ou WebP (máx. 5MB)
                      </small>
                    </div>
                  ) : (
                    <div className="wt-media-attached-bar">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={mediaBase64}
                        alt="Santinho"
                        className="wt-media-thumb"
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <b style={{ fontSize: "12px", display: "block", color: "var(--wt-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {mediaName || "santinho.jpg"}
                        </b>
                        <small style={{ color: "#16a34a", fontWeight: 700, fontSize: "11px" }}>
                          ✓ Imagem anexada com sucesso
                        </small>
                      </div>
                      <button
                        type="button"
                        className="wt-btn-replace-img"
                        onClick={() => mediaInputRef.current?.click()}
                      >
                        Trocar
                      </button>
                    </div>
                  )}

                  <input
                    ref={mediaInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    style={{ display: "none" }}
                    onChange={handleSelectMedia}
                  />
                </div>

                <div className="wt-form-group" style={{ marginTop: "12px" }}>
                  <label>Pré-Visualização no WhatsApp</label>
                  <div className="wt-preview-box">
                    <div className="wt-wa-bubble">
                      {mediaBase64 && (
                        <div className="wt-wa-bubble-img-wrap">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={mediaBase64} alt="Santinho Preview" className="wt-wa-bubble-img" />
                        </div>
                      )}
                      <div className="wt-wa-bubble-text">{previewMessage}</div>
                      <span className="wt-wa-time">
                        {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} ✓✓
                      </span>
                    </div>
                  </div>
                </div>
              </section>

              {/* Anti-Ban & Dispatch Trigger */}
              <section className="wt-card">
                <div className="wt-card-title">
                  <span>🛡️</span> 3. Proteção Anti-Bloqueio & Envio
                </div>

                <div className="wt-form-group">
                  <label>
                    Intervalo entre mensagens: <strong>{delaySeconds}s</strong>
                  </label>
                  <input
                    type="range"
                    min="3"
                    max="20"
                    step="1"
                    value={delaySeconds}
                    onChange={(e) => saveConfig(apiUrl, apiToken, Number(e.target.value))}
                    style={{ width: "100%", accentColor: "var(--wt-primary)" }}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--wt-text-muted)", marginTop: "4px" }}>
                    <span>Mais rápido (3s)</span>
                    <span>Recomendado (5-10s)</span>
                    <span>Mais seguro (20s)</span>
                  </div>
                </div>

                <button
                  type="button"
                  className="wt-primary-btn"
                  onClick={startBroadcast}
                  disabled={isExecuting || targetedRecipients.length === 0}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  <span>Iniciar Disparo para {targetedRecipients.length} Contato(s)</span>
                </button>
              </section>
            </>
          )}

          {activeTab === "logs" && (
            <>
              {/* Real-time Status Card */}
              <section className="wt-card">
                <div className="wt-card-title">
                  <span>📊</span> Status do Disparo em Tempo Real
                </div>

                <div className="wt-stats-grid">
                  <div className="wt-stat-card">
                    <strong>{totalCount}</strong>
                    <span>Total</span>
                  </div>
                  <div className="wt-stat-card is-success">
                    <strong>{sentCount}</strong>
                    <span>Enviados</span>
                  </div>
                  <div className="wt-stat-card is-error">
                    <strong>{errorCount}</strong>
                    <span>Falhas</span>
                  </div>
                </div>

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: 600 }}>
                    <span>Progresso do Envio</span>
                    <span>{progressPercent}%</span>
                  </div>
                  <div className="wt-progress-bar-bg">
                    <div className="wt-progress-fill" style={{ width: `${progressPercent}%` }} />
                  </div>
                </div>

                {isExecuting && (
                  <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
                    <button type="button" className="wt-secondary-btn" style={{ flex: 1 }} onClick={togglePause}>
                      {isPaused ? "▶ Retomar" : "⏸ Pausar"}
                    </button>
                    <button type="button" className="wt-danger-btn" style={{ flex: 1 }} onClick={cancelBroadcast}>
                      ⏹ Cancelar Disparo
                    </button>
                  </div>
                )}
              </section>

              {/* Logs List */}
              <section className="wt-card" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                <div className="wt-card-title">
                  <span>📜</span> Fila e Registro de Envios
                </div>

                <div className="wt-logs-list" style={{ flex: 1 }}>
                  {logs.length === 0 ? (
                    <div style={{ textAlign: "center", color: "var(--wt-text-muted)", padding: "20px", fontSize: "13px" }}>
                      Nenhum disparo em andamento. Clique na aba &quot;Campanha & Mensagem&quot; para iniciar.
                    </div>
                  ) : (
                    logs.map((log, index) => (
                      <div
                        key={log.id}
                        className={`wt-log-row status-${log.status}`}
                        style={{
                          background: index === currentIndex && isExecuting ? "rgba(45, 221, 127, 0.1)" : undefined,
                        }}
                      >
                        <div>
                          <strong>{log.name}</strong>
                          <div style={{ fontSize: "11px", color: "var(--wt-text-muted)" }}>
                            {log.phone} {log.district ? `· ${log.district}` : ""}
                          </div>
                          {log.error && (
                            <div style={{ fontSize: "11px", color: "#f87171", marginTop: "2px" }}>
                              {log.error}
                            </div>
                          )}
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: 700,
                              color:
                                log.status === "sent"
                                  ? "var(--wt-primary)"
                                  : log.status === "error"
                                  ? "#f87171"
                                  : log.status === "sending"
                                  ? "#38bdf8"
                                  : "var(--wt-text-muted)",
                            }}
                          >
                            {log.status === "sent" && "✓ Enviado"}
                            {log.status === "sending" && "⏳ Enviando..."}
                            {log.status === "error" && "✕ Erro"}
                            {log.status === "pending" && "Fila"}
                          </span>
                          {log.time && (
                            <div style={{ fontSize: "10px", color: "var(--wt-text-muted)" }}>{log.time}</div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </>
          )}

          {activeTab === "config" && (
            <>
              {/* API Configuration Form */}
              <section className="wt-card">
                <div className="wt-card-title">
                  <span>⚙️</span> Configurações da API Whaticket / ZapAPI
                </div>

                <div className="wt-form-group">
                  <label>URL do Servidor / API</label>
                  <input
                    type="url"
                    className="wt-input"
                    value={apiUrl}
                    onChange={(e) => saveConfig(e.target.value, apiToken, delaySeconds)}
                    placeholder="https://zapapi.dgsis.com.br"
                  />
                  <small style={{ fontSize: "11px", color: "var(--wt-text-muted)", marginTop: "4px", display: "block" }}>
                    URL base da sua instância Whaticket ou ZapAPI.
                  </small>
                </div>

                <div className="wt-form-group">
                  <label>Token / Chave de API (Bearer Token)</label>
                  <input
                    type="password"
                    className="wt-input"
                    value={apiToken}
                    onChange={(e) => saveConfig(apiUrl, e.target.value, delaySeconds)}
                    placeholder="Insira o token de autenticação gerado na ZapAPI"
                  />
                  <small style={{ fontSize: "11px", color: "var(--wt-text-muted)", marginTop: "4px", display: "block" }}>
                    Chave gerada no painel de conexões do Whaticket/ZapAPI.
                  </small>
                </div>
              </section>

              {/* Test Connection Card */}
              <section className="wt-card">
                <div className="wt-card-title">
                  <span>🧪</span> Teste de Conexão Rápido
                </div>

                <div className="wt-form-group">
                  <label>Número para Teste (com DDD)</label>
                  <input
                    type="tel"
                    className="wt-input"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    placeholder="Ex: 43999998888"
                  />
                </div>

                <button type="button" className="wt-secondary-btn" style={{ width: "100%" }} onClick={handleTestSend}>
                  Disparar Mensagem de Teste
                </button>

                {testStatus && (
                  <div
                    style={{
                      marginTop: "12px",
                      padding: "10px",
                      borderRadius: "8px",
                      fontSize: "12px",
                      background: testStatus.includes("✅") ? "rgba(45, 221, 127, 0.15)" : "rgba(239, 68, 68, 0.15)",
                      color: testStatus.includes("✅") ? "var(--wt-primary)" : "#f87171",
                    }}
                  >
                    {testStatus}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
