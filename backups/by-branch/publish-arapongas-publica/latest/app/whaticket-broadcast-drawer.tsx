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

type DistrictSummary = {
  district: string;
  total: number;
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

type LiveMessageItem = {
  id: string;
  phone: string;
  contactName: string;
  district?: string;
  status: "sent" | "delivered" | "read" | "error" | "replied";
  errorMessage?: string;
  lastMessageText?: string;
  sentAt?: string;
  repliedAt?: string;
  replyText?: string;
  direction: "outbound" | "inbound";
};

type LiveFeedKpis = {
  totalOutbound: number;
  deliveredCount: number;
  failedCount: number;
  deliveryRate: number;
  repliedCount: number;
  responseRate: number;
  activeContacts: number;
};

const STORAGE_DELAY_KEY = "voto-forte:meta:delaySeconds";
const STORAGE_TEMPLATE_KEY = "voto-forte:meta:templateName";
const STORAGE_LANGUAGE_KEY = "voto-forte:meta:templateLanguage";

function normalizeWhatsappPhone(raw: string): string {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return digits;
  }
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  return digits.length >= 10 ? digits : "";
}

function formatPhoneDisplay(raw: string): string {
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
}

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
  const [activeTab, setActiveTab] = useState<"disparo" | "tempo-real" | "logs">("disparo");
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [districtList, setDistrictList] = useState<DistrictSummary[]>([]);
  const [totalMunicipalityContacts, setTotalMunicipalityContacts] = useState(0);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [selectedDistrict, setSelectedDistrict] = useState("Todos");
  const [selectedKind, setSelectedKind] = useState<"Todos" | "Eleitor" | "Liderança">("Todos");
  const [recipientLimit, setRecipientLimit] = useState(50);
  const [delaySeconds, setDelaySeconds] = useState(3);

  const [templates, setTemplates] = useState<MetaTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateLanguage, setTemplateLanguage] = useState("pt_BR");
  const [parameterMappings, setParameterMappings] = useState<string[]>([]);
  const [templateStatus, setTemplateStatus] = useState("");

  const [isExecuting, setIsExecuting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const abortRef = useRef(false);
  const pausedRef = useRef(false);

  // Live Feed State
  const [liveItems, setLiveItems] = useState<LiveMessageItem[]>([]);
  const [liveKpis, setLiveKpis] = useState<LiveFeedKpis>({
    totalOutbound: 0,
    deliveredCount: 0,
    failedCount: 0,
    deliveryRate: 0,
    repliedCount: 0,
    responseRate: 0,
    activeContacts: 0,
  });
  const [liveFilter, setLiveFilter] = useState<"all" | "errors" | "replies" | "no_reply">("all");
  const [liveSearch, setLiveSearch] = useState("");
  const [liveLoading, setLiveLoading] = useState(false);
  const [failedNumbers, setFailedNumbers] = useState<{ phone: string; name: string; error: string }[]>([]);

  // Carrega feed de mensagens em tempo real
  const loadLiveFeed = useCallback(async (silent = false) => {
    if (!silent) setLiveLoading(true);
    try {
      const url = `/api/whatsapp/live-feed?filter=${liveFilter}&search=${encodeURIComponent(liveSearch)}`;
      const res = await apiFetch(url, { cache: "no-store" });
      const data = await res.json();
      if (res.ok && data.success) {
        setLiveItems(data.items || []);
        if (data.kpis) setLiveKpis(data.kpis);
        if (Array.isArray(data.failedNumbers)) setFailedNumbers(data.failedNumbers);
      }
    } catch {
      // Silencia
    } finally {
      if (!silent) setLiveLoading(false);
    }
  }, [liveFilter, liveSearch]);

  // Polling em tempo real quando o drawer e a aba estiverem abertos
  useEffect(() => {
    if (!isOpen) return;
    void loadLiveFeed();

    const interval = setInterval(() => {
      void loadLiveFeed(true);
    }, 4000);

    return () => clearInterval(interval);
  }, [isOpen, loadLiveFeed]);

  useEffect(() => {
    try {
      const savedDelay = Number(localStorage.getItem(STORAGE_DELAY_KEY) || 3);
      const savedTemplate = localStorage.getItem(STORAGE_TEMPLATE_KEY) || "";
      const savedLanguage = localStorage.getItem(STORAGE_LANGUAGE_KEY) || "pt_BR";
      setDelaySeconds(Number.isFinite(savedDelay) ? savedDelay : 3);
      setTemplateName(savedTemplate);
      setTemplateLanguage(savedLanguage);
    } catch {}

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
      button.title = "Disparo em Massa";
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

  // Carrega sumário de bairros completo
  const loadDistrictsSummary = useCallback(async () => {
    try {
      const response = await apiFetch("/api/contacts?mode=summary", { cache: "no-store" });
      const data = await response.json();
      if (response.ok && data) {
        if (Array.isArray(data.districts)) {
          setDistrictList(
            data.districts.map((d: { district?: string; total?: number }) => ({
              district: String(d.district || "").trim(),
              total: Number(d.total || 0),
            })).filter((d: DistrictSummary) => Boolean(d.district)),
          );
        }
        if (Number.isFinite(data.total)) {
          setTotalMunicipalityContacts(Number(data.total));
        }
      }
    } catch {
      // Silencia
    }
  }, []);

  // Carrega contatos com filtro no servidor (rápido e preciso)
  const fetchFilteredContacts = useCallback(async (
    district: string,
    kind: "Todos" | "Eleitor" | "Liderança",
    limit: number,
  ) => {
    setLoadingContacts(true);
    try {
      const maxToFetch = limit === 99999 ? 500 : limit;
      const params = new URLSearchParams({
        page: "1",
        pageSize: String(Math.min(200, maxToFetch)),
      });

      if (district && district !== "Todos") {
        params.set("district", district);
      }
      if (kind && kind !== "Todos") {
        params.set("profile", kind);
      }

      const response = await apiFetch(`/api/contacts?${params.toString()}`, { cache: "no-store" });
      const data = await response.json();

      if (response.ok && Array.isArray(data.contacts)) {
        const loaded: ContactItem[] = data.contacts.map((c: any) => ({
          id: c.id,
          name: c.name || "Contato",
          phone: c.phone || "",
          district: c.district || district || "Arapongas",
          leader: c.leader || "",
          kind: c.kind || "Eleitor",
        }));

        // Se o usuário pediu mais do que 200 (ex: 250, 500), busca páginas seguintes
        if (maxToFetch > 200 && data.totalPages > 1) {
          const remainingPages = Math.min(Math.ceil(maxToFetch / 200), data.totalPages);
          for (let p = 2; p <= remainingPages; p++) {
            params.set("page", String(p));
            try {
              const nextRes = await apiFetch(`/api/contacts?${params.toString()}`, { cache: "no-store" });
              const nextData = await nextRes.json();
              if (nextRes.ok && Array.isArray(nextData.contacts)) {
                loaded.push(
                  ...nextData.contacts.map((c: any) => ({
                    id: c.id,
                    name: c.name || "Contato",
                    phone: c.phone || "",
                    district: c.district || district || "Arapongas",
                    leader: c.leader || "",
                    kind: c.kind || "Eleitor",
                  })),
                );
              }
            } catch {
              break;
            }
          }
        }

        setContacts(loaded);
      } else {
        setContacts([]);
      }
    } catch {
      setContacts([]);
    } finally {
      setLoadingContacts(false);
    }
  }, []);

  const syncParameterMappings = useCallback((count: number) => {
    const defaults = ["{primeiro_nome}", "{bairro}", "{cidade}", "{lideranca}"];
    setParameterMappings((current) =>
      Array.from({ length: count }, (_, index) => current[index] || defaults[index] || "{nome}"),
    );
  }, []);

  const loadTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    setTemplateStatus("Atualizando modelos aprovados...");
    try {
      const response = await apiFetch("/api/whatsapp/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível carregar os modelos.");

      const approved: MetaTemplate[] = Array.isArray(data.templates) ? data.templates : [];
      setTemplates(approved);

      let next = approved.find(
        (item) => item.name === templateName && item.language === templateLanguage,
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
        setTemplateStatus(`✓ ${approved.length} modelo(s) aprovado(s) disponível(is)`);
      } else {
        setTemplateName("");
        setTemplateStatus("Aguardando aprovação de um modelo pela Meta.");
      }
    } catch (error) {
      setTemplateStatus(
        error instanceof Error
          ? error.message
          : "Integração de envio ainda não está disponível no servidor.",
      );
    } finally {
      setTemplatesLoading(false);
    }
  }, [syncParameterMappings, templateLanguage, templateName]);

  // Ao abrir o drawer
  useEffect(() => {
    if (!isOpen) return;
    void loadDistrictsSummary();
    void loadTemplates();
    void fetchFilteredContacts(selectedDistrict, selectedKind, recipientLimit);
  }, [isOpen]);

  // Ao alterar qualquer filtro
  const handleDistrictChange = (district: string) => {
    setSelectedDistrict(district);
    void fetchFilteredContacts(district, selectedKind, recipientLimit);
  };

  const handleKindChange = (kind: "Todos" | "Eleitor" | "Liderança") => {
    setSelectedKind(kind);
    void fetchFilteredContacts(selectedDistrict, kind, recipientLimit);
  };

  const handleLimitChange = (limit: number) => {
    setRecipientLimit(limit);
    void fetchFilteredContacts(selectedDistrict, selectedKind, limit);
  };

  const recipients = useMemo(() => {
    const seen = new Set<string>();
    return contacts
      .filter((contact) => {
        const normalized = normalizeWhatsappPhone(contact.phone || "");
        if (!normalized || normalized.length < 10 || seen.has(normalized)) return false;
        seen.add(normalized);
        return true;
      })
      .slice(0, recipientLimit > 0 ? recipientLimit : undefined);
  }, [contacts, recipientLimit]);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.name === templateName && template.language === templateLanguage) || null,
    [templateLanguage, templateName, templates],
  );

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

  const resolveParameters = (contact: ContactItem) =>
    parameterMappings.map((mapping) => resolveTag(mapping, contact));

  // Reenviar para quem deu erro
  const handleRetryFailed = () => {
    if (!failedNumbers.length) return;
    const failedPhones = new Set(failedNumbers.map((f) => normalizeWhatsappPhone(f.phone)));
    const retryContacts = contacts.filter((c) => failedPhones.has(normalizeWhatsappPhone(c.phone)));
    if (retryContacts.length > 0) {
      setContacts(retryContacts);
      setActiveTab("disparo");
    }
  };

  // Exportar relatório em CSV
  const handleExportCsv = () => {
    if (!liveItems.length) {
      alert("Nenhum dado para exportar no momento.");
      return;
    }

    const headers = ["Nome", "Telefone", "Status", "Motivo do Erro", "Texto da Resposta", "Data de Envio", "Data da Resposta"];
    const rows = liveItems.map((item) => [
      `"${item.contactName.replace(/"/g, '""')}"`,
      `"${item.phone}"`,
      `"${item.status === "error" ? "Falha no Envio" : item.status === "replied" ? "Respondeu" : item.status === "delivered" ? "Entregue" : "Enviado"}"`,
      `"${(item.errorMessage || "").replace(/"/g, '""')}"`,
      `"${(item.replyText || "").replace(/"/g, '""')}"`,
      `"${item.sentAt ? new Date(item.sentAt).toLocaleString("pt-BR") : ""}"`,
      `"${item.repliedAt ? new Date(item.repliedAt).toLocaleString("pt-BR") : ""}"`,
    ]);

    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `relatorio-whatsapp-voto-forte-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const startBroadcast = async () => {
    if (!selectedTemplate) {
      alert("Aguarde a aprovação de um modelo da Meta e selecione-o antes de iniciar o disparo.");
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
      while (pausedRef.current && !abortRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
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
        await new Promise((resolve) =>
          setTimeout(resolve, Math.max(1, delaySeconds) * 1000),
        );
      }
    }
    setIsExecuting(false);
    // Atualiza o feed em tempo real ao finalizar
    void loadLiveFeed();
  };

  const sentCount = logs.filter((item) => item.status === "sent").length;
  const errorCount = logs.filter((item) => item.status === "error").length;
  const processed = logs.filter((item) => item.status === "sent" || item.status === "error").length;
  const progress = logs.length ? Math.round((processed / logs.length) * 100) : 0;

  return (
    <>
      <div
        className={`wt-drawer-overlay ${isOpen ? "is-open" : ""}`}
        onClick={() => !isExecuting && setIsOpen(false)}
      />
      <aside className={`wt-drawer ${isOpen ? "is-open" : ""}`} aria-hidden={!isOpen}>
        <header className="wt-drawer-header">
          <div className="wt-drawer-title-group">
            <div className="wt-header-logo">
              <img
                src="/voto-forte-bandeira-icon.jpg"
                alt="VOTO FORTE"
                style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }}
              />
            </div>
            <div>
              <h2>Central de Disparos <span>⚡</span></h2>
              <p>Envio oficial pelo WhatsApp (Meta Cloud API)</p>
            </div>
          </div>
          <button type="button" className="wt-close-btn" onClick={() => setIsOpen(false)}>✕</button>
        </header>

        <nav className="wt-tabs">
          <button
            type="button"
            className={`wt-tab-btn ${activeTab === "disparo" ? "is-active" : ""}`}
            onClick={() => setActiveTab("disparo")}
          >
            Campanha
          </button>
          <button
            type="button"
            className={`wt-tab-btn ${activeTab === "tempo-real" ? "is-active" : ""}`}
            onClick={() => {
              setActiveTab("tempo-real");
              void loadLiveFeed();
            }}
          >
            ⚡ Monitor Ao Vivo
            {liveKpis.responseRate > 0 && (
              <span style={{ marginLeft: 4, fontSize: 10, color: "#fbbf24", fontWeight: 800 }}>
                {liveKpis.responseRate}%
              </span>
            )}
          </button>
          <button
            type="button"
            className={`wt-tab-btn ${activeTab === "logs" ? "is-active" : ""}`}
            onClick={() => setActiveTab("logs")}
          >
            Fila {isExecuting ? "●" : ""}
          </button>
          <button
            type="button"
            className="wt-tab-btn"
            style={{ marginLeft: "auto", background: "rgba(56,189,248,0.15)", color: "#0284c7", fontWeight: 700 }}
            onClick={() => {
              setIsOpen(false);
              window.dispatchEvent(new CustomEvent("voto-forte:open-survey-intelligence"));
            }}
          >
            📊 Apuração
          </button>
        </nav>

        <div className="wt-drawer-body">
          {activeTab === "disparo" && (
            <>
              <section className="wt-card">
                <div className="wt-card-title"><span>👥</span> 1. Destinatários</div>
                <div className="wt-form-group">
                  <label>Bairro</label>
                  <select
                    className="wt-select"
                    value={selectedDistrict}
                    onChange={(event) => handleDistrictChange(event.target.value)}
                  >
                    <option value="Todos">
                      Todos os Bairros ({totalMunicipalityContacts > 0 ? `${totalMunicipalityContacts.toLocaleString("pt-BR")} contatos` : "Total"})
                    </option>
                    {districtList.map((d) => (
                      <option key={d.district} value={d.district}>
                        {d.district} ({d.total.toLocaleString("pt-BR")})
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div className="wt-form-group">
                    <label>Perfil</label>
                    <select
                      className="wt-select"
                      value={selectedKind}
                      onChange={(event) => handleKindChange(event.target.value as "Todos" | "Eleitor" | "Liderança")}
                    >
                      <option value="Todos">Todos</option>
                      <option value="Eleitor">Eleitores</option>
                      <option value="Liderança">Lideranças</option>
                    </select>
                  </div>
                  <div className="wt-form-group">
                    <label>Limite</label>
                    <select
                      className="wt-select"
                      value={recipientLimit}
                      onChange={(event) => handleLimitChange(Number(event.target.value))}
                    >
                      <option value={20}>20 contatos</option>
                      <option value={50}>50 contatos</option>
                      <option value={100}>100 contatos</option>
                      <option value={250}>250 contatos</option>
                      <option value={500}>500 contatos</option>
                      <option value={1000}>1.000 contatos</option>
                      <option value={99999}>Todos os contatos</option>
                    </select>
                  </div>
                </div>
                <small style={{ color: loadingContacts ? "#38bdf8" : recipients.length > 0 ? "#4ade80" : "#f87171" }}>
                  {loadingContacts
                    ? `⏳ Carregando contatos de ${selectedDistrict}...`
                    : `✓ ${recipients.length} contato(s) elegível(is) carregado(s)`}
                </small>
              </section>

              <section className="wt-card">
                <div className="wt-card-title"><span>💬</span> 2. Modelo aprovado</div>
                <div className="wt-form-group">
                  <label>Mensagem</label>
                  <select
                    className="wt-select"
                    value={templateName ? `${templateName}::${templateLanguage}` : ""}
                    onChange={(event) => handleTemplateChange(event.target.value)}
                    disabled={templatesLoading || templates.length === 0}
                  >
                    <option value="">
                      {templatesLoading ? "Atualizando modelos..." : templates.length ? "Selecione..." : "Nenhum modelo aprovado"}
                    </option>
                    {templates.map((template) => (
                      <option key={`${template.id}-${template.language}`} value={`${template.name}::${template.language}`}>
                        {template.name} · {template.language}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedTemplate ? (
                  <>
                    <div className="wt-preview-box">
                      <div style={{ whiteSpace: "pre-wrap", fontSize: 13 }}>
                        {selectedTemplate.body || "Modelo sem corpo de texto exibido."}
                      </div>
                      <small style={{ color: "#4ade80", fontWeight: 700 }}>
                        {selectedTemplate.category} · APROVADO PELA META ✅
                      </small>
                    </div>
                    {parameterMappings.map((mapping, index) => (
                      <div className="wt-form-group" key={index}>
                        <label>Variável {`{{${index + 1}}}`}</label>
                        <input
                          className="wt-input"
                          value={mapping}
                          onChange={(event) =>
                            setParameterMappings((current) =>
                              current.map((item, itemIndex) => itemIndex === index ? event.target.value : item),
                            )
                          }
                        />
                        <small>Tags: {"{primeiro_nome}, {nome}, {bairro}, {cidade}, {lideranca}"}</small>
                      </div>
                    ))}
                  </>
                ) : (
                  <div style={{ fontSize: 13 }}>
                    {templateStatus || "Aguardando um modelo aprovado para liberar o envio."}
                  </div>
                )}

                <button
                  type="button"
                  className="wt-secondary-btn"
                  style={{ width: "100%", marginTop: 10 }}
                  onClick={() => void loadTemplates()}
                  disabled={templatesLoading}
                >
                  {templatesLoading ? "Atualizando..." : "Atualizar modelos aprovados"}
                </button>
              </section>

              <section className="wt-card">
                <div className="wt-card-title"><span>🚀</span> 3. Enviar</div>
                <div className="wt-form-group">
                  <label>Intervalo entre mensagens: <strong>{delaySeconds}s</strong></label>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    value={delaySeconds}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      setDelaySeconds(value);
                      try { localStorage.setItem(STORAGE_DELAY_KEY, String(value)); } catch {}
                    }}
                    style={{ width: "100%" }}
                  />
                </div>
                <button
                  type="button"
                  className="wt-primary-btn"
                  disabled={isExecuting || !recipients.length || !selectedTemplate}
                  onClick={startBroadcast}
                >
                  {isExecuting ? "Enviando campanha..." : `Enviar para ${recipients.length} contato(s)`}
                </button>
              </section>
            </>
          )}

          {activeTab === "tempo-real" && (
            <>
              {/* Header com Indicador Ao Vivo */}
              <section className="wt-card">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div className="wt-live-indicator">
                    <span className="wt-live-pulse-dot" />
                    <span>Transmissão Ao Vivo</span>
                  </div>
                  <button
                    type="button"
                    className="wt-secondary-btn"
                    style={{ padding: "4px 10px", fontSize: 11 }}
                    onClick={() => void loadLiveFeed()}
                    disabled={liveLoading}
                  >
                    {liveLoading ? "Atualizando..." : "🔄 Atualizar"}
                  </button>
                </div>

                {/* 5 Cards de KPIs em Tempo Real (CLICÁVEIS) */}
                <div className="wt-kpi-grid-5">
                  <div
                    className={`wt-kpi-card is-primary ${liveFilter === "all" ? "is-active-kpi" : ""}`}
                    onClick={() => setLiveFilter("all")}
                    title="Clique para ver todos os disparos"
                  >
                    <strong>{liveKpis.totalOutbound}</strong>
                    <span>Disparos</span>
                  </div>
                  <div
                    className={`wt-kpi-card is-success ${liveFilter === "sent" ? "is-active-kpi" : ""}`}
                    onClick={() => setLiveFilter("sent")}
                    title="Clique para ver apenas mensagens entregues"
                  >
                    <strong>{liveKpis.deliveredCount}</strong>
                    <span>Entregues ({liveKpis.deliveryRate}%)</span>
                  </div>
                  <div
                    className={`wt-kpi-card is-error ${liveFilter === "errors" ? "is-active-kpi" : ""}`}
                    onClick={() => setLiveFilter("errors")}
                    title="Clique para ver apenas erros/falhas"
                  >
                    <strong>{liveKpis.failedCount}</strong>
                    <span>Falhas</span>
                  </div>
                  <div
                    className={`wt-kpi-card is-reply ${liveFilter === "replies" ? "is-active-kpi" : ""}`}
                    onClick={() => setLiveFilter("replies")}
                    title="Clique para ver respostas recebidas"
                  >
                    <strong>{liveKpis.repliedCount}</strong>
                    <span>Respostas</span>
                  </div>
                  <div
                    className={`wt-kpi-card is-rate ${liveFilter === "replies" ? "is-active-kpi" : ""}`}
                    onClick={() => setLiveFilter("replies")}
                    title="Clique para ver respostas"
                    style={{ background: liveFilter === "replies" ? "rgba(251, 191, 36, 0.25)" : "rgba(251, 191, 36, 0.12)", border: "1px solid rgba(251, 191, 36, 0.5)" }}
                  >
                    <strong style={{ color: "#fbbf24" }}>{liveKpis.responseRate}%</strong>
                    <span style={{ color: "#fef08a" }}>Taxa de Resposta</span>
                  </div>
                </div>

                {/* Busca rápida */}
                <div className="wt-search-input-wrap">
                  <span className="search-icon">🔍</span>
                  <input
                    type="text"
                    placeholder="Buscar por nome, telefone ou mensagem..."
                    value={liveSearch}
                    onChange={(e) => setLiveSearch(e.target.value)}
                  />
                </div>

                {/* Filtros rápidos */}
                <div className="wt-filter-bar">
                  <button
                    type="button"
                    className={`wt-filter-pill ${liveFilter === "all" ? "is-active" : ""}`}
                    onClick={() => setLiveFilter("all")}
                  >
                    Todos ({liveKpis.totalOutbound || liveItems.length})
                  </button>
                  <button
                    type="button"
                    className={`wt-filter-pill ${liveFilter === "sent" ? "is-active" : ""}`}
                    onClick={() => setLiveFilter("sent")}
                  >
                    ✓ Entregues ({liveKpis.deliveredCount})
                  </button>
                  <button
                    type="button"
                    className={`wt-filter-pill is-error ${liveFilter === "errors" ? "is-active" : ""}`}
                    onClick={() => setLiveFilter("errors")}
                  >
                    ❌ Falhas / Erros ({liveKpis.failedCount})
                  </button>
                  <button
                    type="button"
                    className={`wt-filter-pill is-reply ${liveFilter === "replies" ? "is-active" : ""}`}
                    onClick={() => setLiveFilter("replies")}
                  >
                    💬 Respostas ({liveKpis.repliedCount})
                  </button>
                  <button
                    type="button"
                    className={`wt-filter-pill ${liveFilter === "no_reply" ? "is-active" : ""}`}
                    onClick={() => setLiveFilter("no_reply")}
                  >
                    ⏳ Sem Resposta
                  </button>
                </div>
              </section>

              {/* Feed de Mensagens */}
              <section className="wt-card">
                <div className="wt-card-title">
                  <span>📱</span> Mensagens ({liveItems.length})
                </div>

                <div className="wt-live-feed-list">
                  {liveItems.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "20px 0", color: "#94a3b8", fontSize: 13 }}>
                      {liveLoading ? "Carregando monitor ao vivo..." : "Nenhuma mensagem encontrada neste filtro."}
                    </div>
                  ) : (
                    liveItems.map((item) => {
                      const isError = item.status === "error";
                      const isReplied = item.status === "replied";

                      return (
                        <div
                          key={item.id}
                          className={`wt-live-item ${isError ? "is-error" : isReplied ? "is-replied" : "is-delivered"}`}
                        >
                          <div className="wt-live-item-header">
                            <div className="wt-live-contact-info">
                              <strong style={{ fontSize: "14px" }}>{item.contactName}</strong>
                              <span style={{ fontSize: "12px", color: "#38bdf8", fontWeight: 600 }}>{formatPhoneDisplay(item.phone)}</span>
                            </div>

                            <div>
                              {isError && (
                                <span className="wt-status-badge badge-error">
                                  ✕ Falha no Envio
                                </span>
                              )}
                              {isReplied && (
                                <span className="wt-status-badge badge-replied">
                                  💬 Respondeu
                                </span>
                              )}
                              {!isError && !isReplied && (
                                <span className="wt-status-badge badge-delivered">
                                  ✓ Entregue
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Se for erro, mostra o motivo exato */}
                          {isError && (
                            <div className="wt-error-detail">
                              <span>⚠️</span>
                              <div>
                                <strong>Motivo da falha:</strong> {item.errorMessage || "Número não recebeu a mensagem (inválido ou sem WhatsApp)."}
                              </div>
                            </div>
                          )}

                          {/* Se respondeu, mostra a mensagem de resposta */}
                          {isReplied && item.replyText && (
                            <div className="wt-reply-detail" style={{ borderLeft: "3px solid #c084fc", background: "rgba(168, 85, 247, 0.15)", padding: "8px 12px" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                                <strong style={{ color: "#d8b4fe", fontSize: "11px" }}>
                                  💬 Resposta de {item.contactName}:
                                </strong>
                                {item.repliedAt && (
                                  <span style={{ fontSize: "10px", color: "#c084fc" }}>
                                    {new Date(item.repliedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: "13px", color: "#f8fafc", fontStyle: "italic", whiteSpace: "pre-wrap", lineHeight: 1.4 }}>
                                "{item.replyText}"
                              </div>
                            </div>
                          )}

                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10, color: "#64748b", marginTop: 2 }}>
                            <span>{item.sentAt ? `Disparo: ${new Date(item.sentAt).toLocaleTimeString("pt-BR")}` : ""}</span>
                            {item.repliedAt && <span style={{ color: "#a855f7", fontWeight: 600 }}>Respondido: {new Date(item.repliedAt).toLocaleTimeString("pt-BR")}</span>}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Ações Rápidas de Reenvio e Exportação */}
                <div className="wt-live-actions-bar">
                  {failedNumbers.length > 0 && (
                    <button
                      type="button"
                      className="wt-action-btn-small btn-retry"
                      onClick={handleRetryFailed}
                    >
                      🔁 Reenviar {failedNumbers.length} Falhas
                    </button>
                  )}
                  <button
                    type="button"
                    className="wt-action-btn-small"
                    onClick={handleExportCsv}
                  >
                    📥 Exportar CSV
                  </button>
                </div>
              </section>
            </>
          )}

          {activeTab === "logs" && (
            <>
              <section className="wt-card">
                <div className="wt-card-title"><span>📊</span> Progresso da Sessão</div>
                <div className="wt-stats-grid">
                  <div className="wt-stat-card"><strong>{logs.length}</strong><span>Total</span></div>
                  <div className="wt-stat-card is-success"><strong>{sentCount}</strong><span>Enviados</span></div>
                  <div className="wt-stat-card is-error"><strong>{errorCount}</strong><span>Falhas</span></div>
                </div>
                <div className="wt-progress-bar-bg"><div className="wt-progress-fill" style={{ width: `${progress}%` }} /></div>
                {isExecuting && (
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <button
                      type="button"
                      className="wt-secondary-btn"
                      style={{ flex: 1 }}
                      onClick={() => {
                        pausedRef.current = !pausedRef.current;
                        setIsPaused(pausedRef.current);
                      }}
                    >
                      {isPaused ? "▶ Retomar" : "⏸ Pausar"}
                    </button>
                    <button
                      type="button"
                      className="wt-danger-btn"
                      style={{ flex: 1 }}
                      onClick={() => {
                        abortRef.current = true;
                        pausedRef.current = false;
                        setIsPaused(false);
                        setIsExecuting(false);
                      }}
                    >
                      ⏹ Cancelar
                    </button>
                  </div>
                )}
              </section>

              <section className="wt-card">
                <div className="wt-card-title"><span>📜</span> Registro</div>
                <div className="wt-logs-list">
                  {logs.length === 0 ? (
                    <div style={{ fontSize: 13 }}>Nenhum disparo iniciado nesta sessão.</div>
                  ) : (
                    logs.map((log, index) => (
                      <div
                        key={log.id}
                        className={`wt-log-row status-${log.status}`}
                        style={{ background: index === currentIndex && isExecuting ? "rgba(45,221,127,.1)" : undefined }}
                      >
                        <div>
                          <strong>{log.name}</strong>
                          {log.error && <div style={{ fontSize: 11, color: "#f87171" }}>{log.error}</div>}
                        </div>
                        <div style={{ fontSize: 11 }}>
                          {log.status === "sent" ? "✓ Enviado" : log.status === "sending" ? "⏳ Enviando" : log.status === "error" ? "✕ Erro" : "Fila"}
                          <div>{log.time}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
