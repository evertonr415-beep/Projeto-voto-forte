"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "./supabase-client";

type ContactItem = {
  id: number;
  name: string;
  phone: string;
  district?: string;
  leader?: string;
  kind?: "Eleitor" | "Liderança";
};

type MetaTemplate = {
  id: string;
  name: string;
  status: string;
  language: string;
  category: string;
  body: string;
  bodyParameterCount: number;
  unsupportedHeader: boolean;
};

type LogItem = {
  id: string;
  name: string;
  phone: string;
  status: "pending" | "sending" | "sent" | "error";
  error?: string;
  time: string;
};

const STORAGE_DELAY_KEY = "voto-forte:meta:delaySeconds";
const STORAGE_TEMPLATE_KEY = "voto-forte:meta:templateName";
const STORAGE_LANGUAGE_KEY = "voto-forte:meta:templateLanguage";

function resolveTag(value: string, contact: ContactItem) {
  const firstName = (contact.name || "").trim().split(/\s+/)[0] || "Amigo(a)";
  return String(value || "")
    .replace(/\{nome\}/gi, contact.name || "Amigo(a)")
    .replace(/\{primeiro_nome\}/gi, firstName)
    .replace(/\{bairro\}/gi, contact.district || "sua região")
    .replace(/\{cidade\}/gi, "Arapongas")
    .replace(/\{lideranca\}/gi, contact.leader || "Liderança");
}

export default function WhaticketBroadcastDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"disparo" | "config" | "logs">("disparo");
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [selectedDistrict, setSelectedDistrict] = useState("Todos");
  const [selectedKind, setSelectedKind] = useState<"Todos" | "Eleitor" | "Liderança">("Todos");
  const [recipientLimit, setRecipientLimit] = useState(50);
  const [delaySeconds, setDelaySeconds] = useState(5);

  // O token fica somente em memória no navegador. O modo definitivo é usar
  // META_WHATSAPP_ACCESS_TOKEN como segredo do servidor na Vercel.
  const [apiToken, setApiToken] = useState("");
  const [templates, setTemplates] = useState<MetaTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateLanguage, setTemplateLanguage] = useState("pt_BR");
  const [parameterMappings, setParameterMappings] = useState<string[]>([]);
  const [connectionStatus, setConnectionStatus] = useState("");
  const [testPhone, setTestPhone] = useState("");
  const [testStatus, setTestStatus] = useState("");

  const [isExecuting, setIsExecuting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const abortRef = useRef(false);
  const pausedRef = useRef(false);

  useEffect(() => {
    try {
      const savedDelay = Number(localStorage.getItem(STORAGE_DELAY_KEY) || 5);
      const savedTemplate = localStorage.getItem(STORAGE_TEMPLATE_KEY) || "";
      const savedLanguage = localStorage.getItem(STORAGE_LANGUAGE_KEY) || "pt_BR";
      setDelaySeconds(Number.isFinite(savedDelay) ? savedDelay : 5);
      setTemplateName(savedTemplate);
      setTemplateLanguage(savedLanguage);
    } catch {
      // Sem persistência local disponível.
    }

    const open = () => setIsOpen(true);
    window.addEventListener("voto-forte:open-whaticket-drawer", open);
    return () => window.removeEventListener("voto-forte:open-whaticket-drawer", open);
  }, []);

  useEffect(() => {
    let frame = 0;
    const ensureSidebarItem = () => {
      const nav = document.querySelector<HTMLElement>(".sidebar nav");
      if (!nav || nav.querySelector(".whaticket-broadcast-sidebar-btn")) return;
      const buttons = Array.from(nav.querySelectorAll("button"));
      const waButton = buttons.find((button) => button.textContent?.includes("WhatsApp"));
      const anchor = waButton?.nextSibling || nav.querySelector(".administration-nav-item") || null;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "whaticket-broadcast-sidebar-btn";
      button.title = "Disparo em Massa pela API oficial da Meta";
      const icon = document.createElement("span");
      icon.className = "nav-icon";
      icon.style.color = "#2ddd7f";
      icon.textContent = "⚡";
      const label = document.createElement("span");
      label.className = "nav-name";
      label.textContent = "Disparo em Massa";
      button.append(icon, label);
      button.addEventListener("click", () => setIsOpen(true));
      if (anchor) nav.insertBefore(button, anchor);
      else nav.appendChild(button);
    };
    ensureSidebarItem();
    const observer = new MutationObserver(() => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        ensureSidebarItem();
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  const loadContacts = useCallback(async () => {
    setLoadingContacts(true);
    try {
      const response = await apiFetch("/api/contacts?pageSize=200&owner=all", { cache: "no-store" });
      const data = await response.json();
      if (response.ok && Array.isArray(data.contacts)) setContacts(data.contacts);
    } finally {
      setLoadingContacts(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && contacts.length === 0) void loadContacts();
  }, [isOpen, contacts.length, loadContacts]);

  const districts = useMemo(() => {
    const values = new Set<string>();
    contacts.forEach((contact) => {
      const district = contact.district?.trim();
      if (district) values.add(district);
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [contacts]);

  const recipients = useMemo(
    () =>
      contacts
        .filter((contact) => {
          if (String(contact.phone || "").replace(/\D/g, "").length < 10) return false;
          if (selectedDistrict !== "Todos" && contact.district !== selectedDistrict) return false;
          if (selectedKind !== "Todos" && contact.kind !== selectedKind) return false;
          return true;
        })
        .slice(0, recipientLimit > 0 ? recipientLimit : undefined),
    [contacts, recipientLimit, selectedDistrict, selectedKind],
  );

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.name === templateName && template.language === templateLanguage) || null,
    [templateLanguage, templateName, templates],
  );

  const syncParameterMappings = useCallback((count: number) => {
    const defaults = ["{primeiro_nome}", "{bairro}", "{cidade}", "{lideranca}"];
    setParameterMappings((current) =>
      Array.from({ length: count }, (_, index) => current[index] || defaults[index] || "{nome}"),
    );
  }, []);

  const loadTemplates = async () => {
    setTemplatesLoading(true);
    setConnectionStatus("Consultando modelos aprovados na Meta...");
    try {
      const response = await apiFetch("/api/whatsapp/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiToken: apiToken || undefined }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível carregar os modelos.");
      const approved = Array.isArray(data.templates) ? data.templates : [];
      setTemplates(approved);
      let next = approved.find(
        (item: MetaTemplate) => item.name === templateName && item.language === templateLanguage,
      );
      if (!next && approved.length) next = approved[0];
      if (next) {
        setTemplateName(next.name);
        setTemplateLanguage(next.language || "pt_BR");
        syncParameterMappings(Number(next.bodyParameterCount || 0));
        try {
          localStorage.setItem(STORAGE_TEMPLATE_KEY, next.name);
          localStorage.setItem(STORAGE_LANGUAGE_KEY, next.language || "pt_BR");
        } catch {}
      }
      setConnectionStatus(
        approved.length
          ? `✅ Meta conectada. ${approved.length} modelo(s) aprovado(s) encontrado(s).`
          : "⚠️ Conexão feita, mas nenhum modelo aprovado foi encontrado.",
      );
    } catch (error) {
      setConnectionStatus(`❌ ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setTemplatesLoading(false);
    }
  };

  const testConnection = async () => {
    setConnectionStatus("Testando conexão com a Meta...");
    try {
      const response = await apiFetch("/api/whatsapp/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiToken: apiToken || undefined }),
      });
      const data = await response.json();
      if (!response.ok || !data.connected) throw new Error(data.error || "Conexão não confirmada.");
      setConnectionStatus("✅ API oficial da Meta conectada e número de produção acessível.");
    } catch (error) {
      setConnectionStatus(`❌ ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleTemplateChange = (value: string) => {
    const [name, language] = value.split("::");
    const template = templates.find((item) => item.name === name && item.language === language);
    setTemplateName(name || "");
    setTemplateLanguage(language || "pt_BR");
    syncParameterMappings(Number(template?.bodyParameterCount || 0));
    try {
      localStorage.setItem(STORAGE_TEMPLATE_KEY, name || "");
      localStorage.setItem(STORAGE_LANGUAGE_KEY, language || "pt_BR");
    } catch {}
  };

  const resolveParameters = (contact: ContactItem) => parameterMappings.map((mapping) => resolveTag(mapping, contact));

  const handleTestSend = async () => {
    if (!testPhone.trim()) {
      setTestStatus("❌ Informe um número para o teste.");
      return;
    }
    if (!selectedTemplate) {
      setTestStatus("❌ Carregue e selecione um modelo aprovado da Meta.");
      return;
    }
    if (selectedTemplate.unsupportedHeader) {
      setTestStatus("❌ Este modelo possui cabeçalho de mídia. Use um modelo de texto para este disparo.");
      return;
    }
    setTestStatus("⏳ Enviando pela Meta...");
    const sample: ContactItem = {
      id: 0,
      name: "Contato Teste",
      phone: testPhone,
      district: "Centro",
      leader: "Liderança",
    };
    try {
      const response = await apiFetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiToken: apiToken || undefined,
          phone: testPhone,
          contactName: "Teste",
          templateName: selectedTemplate.name,
          templateLanguage: selectedTemplate.language,
          templateParameters: resolveParameters(sample),
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Falha no envio.");
      setTestStatus("✅ Mensagem enviada pela API oficial da Meta.");
    } catch (error) {
      setTestStatus(`❌ ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const startBroadcast = async () => {
    if (!selectedTemplate) {
      setActiveTab("config");
      alert("Carregue e selecione o modelo aprovado da Meta antes de iniciar o disparo.");
      return;
    }
    if (selectedTemplate.unsupportedHeader) {
      alert("O modelo selecionado exige mídia no cabeçalho e ainda não é compatível com este disparador.");
      return;
    }
    if (!recipients.length) return;

    setLogs(
      recipients.map((contact, index) => ({
        id: `${contact.id || index}-${contact.phone}`,
        name: contact.name || "Contato",
        phone: contact.phone,
        status: "pending",
        time: "",
      })),
    );
    setIsExecuting(true);
    setIsPaused(false);
    setActiveTab("logs");
    abortRef.current = false;
    pausedRef.current = false;

    for (let index = 0; index < recipients.length; index++) {
      if (abortRef.current) break;
      while (pausedRef.current && !abortRef.current) await new Promise((resolve) => setTimeout(resolve, 400));
      if (abortRef.current) break;

      const contact = recipients[index];
      setCurrentIndex(index);
      setLogs((current) =>
        current.map((log, logIndex) =>
          logIndex === index
            ? { ...log, status: "sending", time: new Date().toLocaleTimeString("pt-BR") }
            : log,
        ),
      );

      try {
        const response = await apiFetch("/api/whatsapp/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            apiToken: apiToken || undefined,
            phone: contact.phone,
            contactName: contact.name,
            templateName: selectedTemplate.name,
            templateLanguage: selectedTemplate.language,
            templateParameters: resolveParameters(contact),
          }),
        });
        const data = await response.json();
        const success = response.ok && data.success;
        setLogs((current) =>
          current.map((log, logIndex) =>
            logIndex === index
              ? {
                  ...log,
                  status: success ? "sent" : "error",
                  error: success ? undefined : data.error || "Falha no envio",
                  time: new Date().toLocaleTimeString("pt-BR"),
                }
              : log,
          ),
        );
      } catch (error) {
        setLogs((current) =>
          current.map((log, logIndex) =>
            logIndex === index
              ? {
                  ...log,
                  status: "error",
                  error: error instanceof Error ? error.message : "Erro de conexão",
                  time: new Date().toLocaleTimeString("pt-BR"),
                }
              : log,
          ),
        );
      }

      if (index < recipients.length - 1 && !abortRef.current) {
        await new Promise((resolve) => setTimeout(resolve, Math.max(1, delaySeconds) * 1000));
      }
    }
    setIsExecuting(false);
  };

  const sentCount = logs.filter((item) => item.status === "sent").length;
  const errorCount = logs.filter((item) => item.status === "error").length;
  const processed = logs.filter((item) => item.status === "sent" || item.status === "error").length;
  const progress = logs.length ? Math.round((processed / logs.length) * 100) : 0;

  return (
    <>
      <div className={`wt-drawer-overlay ${isOpen ? "is-open" : ""}`} onClick={() => !isExecuting && setIsOpen(false)} />
      <aside className={`wt-drawer ${isOpen ? "is-open" : ""}`} aria-hidden={!isOpen}>
        <header className="wt-drawer-header">
          <div className="wt-drawer-title-group">
            <div className="wt-header-logo">
              <img src="/voto-forte-bandeira-icon.jpg" alt="VOTO FORTE" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }} />
            </div>
            <div>
              <h2>Central de Disparos <span>⚡</span></h2>
              <p>WhatsApp Cloud API oficial da Meta</p>
            </div>
          </div>
          <button type="button" className="wt-close-btn" onClick={() => setIsOpen(false)}>✕</button>
        </header>

        <nav className="wt-tabs">
          <button type="button" className={`wt-tab-btn ${activeTab === "disparo" ? "is-active" : ""}`} onClick={() => setActiveTab("disparo")}>Campanha</button>
          <button type="button" className={`wt-tab-btn ${activeTab === "logs" ? "is-active" : ""}`} onClick={() => setActiveTab("logs")}>Progresso {isExecuting ? "●" : ""}</button>
          <button type="button" className={`wt-tab-btn ${activeTab === "config" ? "is-active" : ""}`} onClick={() => setActiveTab("config")}>Meta API</button>
        </nav>

        <div className="wt-drawer-body">
          {activeTab === "disparo" && (
            <>
              <section className="wt-card">
                <div className="wt-card-title"><span>👥</span> 1. Destinatários</div>
                <div className="wt-form-group">
                  <label>Bairro</label>
                  <select className="wt-select" value={selectedDistrict} onChange={(event) => setSelectedDistrict(event.target.value)}>
                    <option value="Todos">Todos os Bairros ({contacts.length})</option>
                    {districts.map((district) => <option key={district} value={district}>{district}</option>)}
                  </select>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div className="wt-form-group">
                    <label>Perfil</label>
                    <select className="wt-select" value={selectedKind} onChange={(event) => setSelectedKind(event.target.value as "Todos" | "Eleitor" | "Liderança")}>
                      <option value="Todos">Todos</option><option value="Eleitor">Eleitores</option><option value="Liderança">Lideranças</option>
                    </select>
                  </div>
                  <div className="wt-form-group">
                    <label>Limite</label>
                    <select className="wt-select" value={recipientLimit} onChange={(event) => setRecipientLimit(Number(event.target.value))}>
                      <option value={20}>20</option><option value={50}>50</option><option value={100}>100</option><option value={300}>300</option><option value={9999}>Todos</option>
                    </select>
                  </div>
                </div>
                <small>{loadingContacts ? "Carregando contatos..." : `✓ ${recipients.length} contato(s) elegível(is)`}</small>
              </section>

              <section className="wt-card">
                <div className="wt-card-title"><span>💬</span> 2. Modelo aprovado da Meta</div>
                {selectedTemplate ? (
                  <>
                    <div className="wt-form-group">
                      <label>Modelo</label>
                      <div className="wt-preview-box">
                        <strong>{selectedTemplate.name}</strong>
                        <div style={{ marginTop: 6, whiteSpace: "pre-wrap", fontSize: 13 }}>{selectedTemplate.body || "Modelo sem corpo de texto exibido."}</div>
                        <small>{selectedTemplate.category} · {selectedTemplate.language} · APROVADO</small>
                      </div>
                    </div>
                    {parameterMappings.map((mapping, index) => (
                      <div className="wt-form-group" key={index}>
                        <label>Variável {`{{${index + 1}}}`}</label>
                        <input className="wt-input" value={mapping} onChange={(event) => setParameterMappings((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} />
                        <small>Tags disponíveis: {"{primeiro_nome}, {nome}, {bairro}, {cidade}, {lideranca}"}</small>
                      </div>
                    ))}
                  </>
                ) : (
                  <div style={{ fontSize: 13 }}>Vá em <strong>Meta API</strong>, conecte a conta e selecione o modelo que você criou.</div>
                )}
              </section>

              <section className="wt-card">
                <div className="wt-card-title"><span>🚀</span> 3. Envio oficial</div>
                <div className="wt-form-group">
                  <label>Intervalo entre mensagens: <strong>{delaySeconds}s</strong></label>
                  <input type="range" min="1" max="20" value={delaySeconds} onChange={(event) => { const value = Number(event.target.value); setDelaySeconds(value); try { localStorage.setItem(STORAGE_DELAY_KEY, String(value)); } catch {} }} style={{ width: "100%" }} />
                </div>
                <button type="button" className="wt-primary-btn" disabled={isExecuting || !recipients.length || !selectedTemplate} onClick={startBroadcast}>Iniciar Disparo pela Meta para {recipients.length} contato(s)</button>
              </section>
            </>
          )}

          {activeTab === "config" && (
            <>
              <section className="wt-card">
                <div className="wt-card-title"><span>✅</span> API oficial da Meta</div>
                <p style={{ fontSize: 13, marginTop: 0 }}>Número de produção e webhook já ficam no servidor. A ZapAPI não é mais usada pelo envio.</p>
                <div className="wt-form-group">
                  <label>Token permanente da Meta</label>
                  <input type="password" className="wt-input" value={apiToken} onChange={(event) => setApiToken(event.target.value)} placeholder="Cole o token novo somente para esta sessão" autoComplete="off" />
                  <small>O token não é salvo no navegador. Quando META_WHATSAPP_ACCESS_TOKEN estiver configurado na Vercel, este campo pode ficar vazio.</small>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <button type="button" className="wt-secondary-btn" onClick={testConnection}>Testar Meta API</button>
                  <button type="button" className="wt-secondary-btn" onClick={loadTemplates} disabled={templatesLoading}>{templatesLoading ? "Carregando..." : "Carregar modelos"}</button>
                </div>
                {connectionStatus && <div style={{ marginTop: 10, fontSize: 12 }}>{connectionStatus}</div>}
              </section>

              <section className="wt-card">
                <div className="wt-card-title"><span>📋</span> Modelo da campanha</div>
                <div className="wt-form-group">
                  <label>Modelo aprovado</label>
                  <select className="wt-select" value={templateName ? `${templateName}::${templateLanguage}` : ""} onChange={(event) => handleTemplateChange(event.target.value)}>
                    <option value="">Selecione...</option>
                    {templates.map((template) => <option key={`${template.id}-${template.language}`} value={`${template.name}::${template.language}`}>{template.name} · {template.language}</option>)}
                  </select>
                </div>
                {selectedTemplate?.unsupportedHeader && <div style={{ fontSize: 12, color: "#f87171" }}>Este modelo usa mídia no cabeçalho; selecione um modelo de texto para disparos em massa.</div>}
              </section>

              <section className="wt-card">
                <div className="wt-card-title"><span>🧪</span> Teste de envio</div>
                <div className="wt-form-group"><label>Número de teste</label><input type="tel" className="wt-input" value={testPhone} onChange={(event) => setTestPhone(event.target.value)} placeholder="43999999999" /></div>
                <button type="button" className="wt-secondary-btn" style={{ width: "100%" }} onClick={handleTestSend}>Enviar modelo de teste</button>
                {testStatus && <div style={{ marginTop: 10, fontSize: 12 }}>{testStatus}</div>}
              </section>
            </>
          )}

          {activeTab === "logs" && (
            <>
              <section className="wt-card">
                <div className="wt-card-title"><span>📊</span> Progresso</div>
                <div className="wt-stats-grid">
                  <div className="wt-stat-card"><strong>{logs.length}</strong><span>Total</span></div>
                  <div className="wt-stat-card is-success"><strong>{sentCount}</strong><span>Enviados</span></div>
                  <div className="wt-stat-card is-error"><strong>{errorCount}</strong><span>Falhas</span></div>
                </div>
                <div className="wt-progress-bar-bg"><div className="wt-progress-fill" style={{ width: `${progress}%` }} /></div>
                {isExecuting && <div style={{ display: "flex", gap: 8, marginTop: 10 }}><button type="button" className="wt-secondary-btn" style={{ flex: 1 }} onClick={() => { pausedRef.current = !pausedRef.current; setIsPaused(pausedRef.current); }}>{isPaused ? "▶ Retomar" : "⏸ Pausar"}</button><button type="button" className="wt-danger-btn" style={{ flex: 1 }} onClick={() => { abortRef.current = true; pausedRef.current = false; setIsPaused(false); setIsExecuting(false); }}>⏹ Cancelar</button></div>}
              </section>
              <section className="wt-card">
                <div className="wt-card-title"><span>📜</span> Registro</div>
                <div className="wt-logs-list">
                  {logs.length === 0 ? <div style={{ fontSize: 13 }}>Nenhum disparo iniciado.</div> : logs.map((log, index) => <div key={log.id} className={`wt-log-row status-${log.status}`} style={{ background: index === currentIndex && isExecuting ? "rgba(45,221,127,.1)" : undefined }}><div><strong>{log.name}</strong><div style={{ fontSize: 11 }}>{log.phone}</div>{log.error && <div style={{ fontSize: 11, color: "#f87171" }}>{log.error}</div>}</div><div style={{ fontSize: 11 }}>{log.status === "sent" ? "✓ Enviado" : log.status === "sending" ? "⏳ Enviando" : log.status === "error" ? "✕ Erro" : "Fila"}<div>{log.time}</div></div></div>)}
                </div>
              </section>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
