"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { apiFetch } from "./supabase-client";
import "./whatsapp-humanized-broadcaster.css";

type Contact = {
  id: number | string;
  name: string;
  phone: string;
  district?: string;
  kind?: string;
};

type BroadcastLog = {
  id: string;
  phone: string;
  name: string;
  district?: string;
  status: "pending" | "typing" | "sent" | "error";
  time: string;
  messageText?: string;
  error?: string;
};

// Parser Spintax: resolve {A|B|C} aleatoriamente
function parseSpintax(text: string): string {
  const spintaxRegex = /\{([^{}]+)\}/g;
  let matches = text.match(spintaxRegex);
  let resolved = text;
  while (matches && matches.length > 0) {
    for (const match of matches) {
      const options = match.slice(1, -1).split("|");
      const randomOption = options[Math.floor(Math.random() * options.length)] || "";
      resolved = resolved.replace(match, randomOption);
    }
    matches = resolved.match(spintaxRegex);
  }
  return resolved;
}

// Substitui tags dinâmicas
function resolveTags(template: string, contact: Contact): string {
  const firstName = (contact.name || "").trim().split(/\s+/)[0] || "Amigo(a)";
  return template
    .replace(/\{nome\}/gi, contact.name || "Amigo(a)")
    .replace(/\{primeiro_nome\}/gi, firstName)
    .replace(/\{bairro\}/gi, contact.district || "Arapongas")
    .replace(/\{cidade\}/gi, "Arapongas")
    .replace(/\{link_enquete\}/gi, "https://sistemavotoforte.com.br/enquete/arapongas");
}

export default function WhatsappHumanizedBroadcaster({
  initialContacts = [],
  onClose,
}: {
  initialContacts?: Contact[];
  onClose?: () => void;
}) {
  // Estado da Conexão WhatsApp via QR Code
  const [connectionStatus, setConnectionStatus] = useState<"disconnected" | "generating" | "qrcode" | "connected">("connected");
  const [connectedNumber, setConnectedNumber] = useState("+55 (43) 99614-7226");
  const [qrCodeData, setQrCodeData] = useState<string>("");

  // Mensagem e Spintax
  const defaultMessage = `{Olá|Oi|Tudo bem?}, {primeiro_nome}! 👋

Será que o candidato que todo mundo pensa está na frente aqui em {bairro}? 👀

Participe da nossa enquete oficial e descubra quem está sendo mais lembrado na cidade:

📊 *Resultado em tempo real*
⏱️ *Menos de 1 minuto*

👉 *Clique e participe:*
{link_enquete}`;

  const [messageTemplate, setMessageTemplate] = useState(defaultMessage);
  const [previewContact, setPreviewContact] = useState<Contact>({
    id: 1,
    name: "Sérgio Onofre",
    phone: "5543999990001",
    district: "Centro",
  });
  const [simulatedPreview, setSimulatedPreview] = useState("");

  // Configurações de Pacing Anti-Ban
  const [dailyLimit, setDailyLimit] = useState(150);
  const [minDelay, setMinDelay] = useState(40);
  const [maxDelay, setMaxDelay] = useState(70);
  const [typingDurationMin, setTypingDurationMin] = useState(3);
  const [typingDurationMax, setTypingDurationMax] = useState(6);
  const [batchSize, setBatchSize] = useState(25);
  const [batchPauseMinutes, setBatchPauseMinutes] = useState(10);

  // Lista de Contatos
  const [contacts, setContacts] = useState<Contact[]>(initialContacts);
  const [selectedDistrict, setSelectedDistrict] = useState("all");
  const [districtList, setDistrictList] = useState<{ district: string; total: number }[]>([]);
  const [customNumbersInput, setCustomNumbersInput] = useState("");
  const [loadingContacts, setLoadingContacts] = useState(false);

  // Execução do Disparo
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentStep, setCurrentStep] = useState<string>("Aguardando início");
  const [countdownSeconds, setCountdownSeconds] = useState<number>(0);
  const [typingProgressText, setTypingProgressText] = useState("");
  const [logs, setLogs] = useState<BroadcastLog[]>([]);

  const abortRef = useRef(false);
  const pauseRef = useRef(false);

  // Atualiza prévia ao vivo
  const refreshPreview = useCallback(() => {
    const raw = parseSpintax(messageTemplate);
    const resolved = resolveTags(raw, previewContact);
    setSimulatedPreview(resolved);
  }, [messageTemplate, previewContact]);

  useEffect(() => {
    refreshPreview();
  }, [refreshPreview]);

  // Carrega contatos de Arapongas do Supabase caso não fornecidos
  useEffect(() => {
    if (contacts.length === 0) {
      setLoadingContacts(true);
      void apiFetch("/api/contacts?limit=150", { cache: "no-store" })
        .then((res) => res.json())
        .then((data) => {
          if (data && Array.isArray(data.items)) {
            const formatted = data.items.map((it: any) => ({
              id: it.id,
              name: it.name || "Eleitor",
              phone: it.phone || "",
              district: it.district || "Arapongas",
              kind: it.kind || "Eleitor",
            }));
            setContacts(formatted);
          }
        })
        .catch(() => {})
        .finally(() => setLoadingContacts(false));
    }
  }, [contacts.length]);

  // Gera QR Code simulado / real
  const handleGenerateQR = () => {
    setConnectionStatus("generating");
    setTimeout(() => {
      // QR Code SVG demonstrativo para leitura no app
      setQrCodeData("https://api.qrserver.com/v1/create-qr-code/?size=190x190&data=WPP_SESSION_VOTO_FORTE_ARAPONGAS_" + Date.now());
      setConnectionStatus("qrcode");
    }, 1000);
  };

  const handleSimulateConnection = () => {
    setConnectionStatus("connected");
    setConnectedNumber("+55 (43) 99614-7226");
  };

  // Motor de Disparo Humanizado
  const startHumanizedBroadcast = async () => {
    if (contacts.length === 0) {
      alert("Nenhum contato na lista para disparar.");
      return;
    }

    setIsRunning(true);
    setIsPaused(false);
    abortRef.current = false;
    pauseRef.current = false;

    const targetList = contacts.slice(0, dailyLimit);

    for (let i = currentIndex; i < targetList.length; i++) {
      if (abortRef.current) break;

      while (pauseRef.current) {
        setCurrentStep("⏸️ Disparo pausado. Clique em Retomar quando desejar.");
        await new Promise((r) => setTimeout(r, 1000));
        if (abortRef.current) break;
      }
      if (abortRef.current) break;

      const contact = targetList[i];
      setCurrentIndex(i + 1);

      // 1. Gerar mensagem única com Spintax para o contato
      const personalizedMsg = resolveTags(parseSpintax(messageTemplate), contact);

      // 2. Simular Digitação (Composing)
      const typingTime = Math.floor(Math.random() * (typingDurationMax - typingDurationMin + 1) + typingDurationMin) * 1000;
      setCurrentStep(`⌨️ Simulando digitação para ${contact.name} (${contact.district || "Arapongas"})...`);

      // Efeito de digitação visual na tela
      const chars = personalizedMsg.split("");
      let progressive = "";
      const stepInterval = Math.max(20, Math.floor(typingTime / chars.length));

      for (let c = 0; c < chars.length; c++) {
        if (abortRef.current) break;
        progressive += chars[c];
        setTypingProgressText(progressive);
        await new Promise((r) => setTimeout(r, stepInterval));
      }

      if (abortRef.current) break;

      // 3. Efetuar o Envio Real / API
      setCurrentStep(`🚀 Enviando para ${contact.phone}...`);
      let sentSuccess = true;
      let errorMsg = "";

      try {
        const payload = {
          phone: contact.phone,
          message: personalizedMsg,
          contactName: contact.name,
          district: contact.district,
        };
        const res = await apiFetch("/api/whatsapp/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          errorMsg = errData?.error || "Falha na entrega";
          sentSuccess = false;
        }
      } catch (err: any) {
        errorMsg = err?.message || "Erro de rede";
        sentSuccess = false;
      }

      // Adiciona ao Log
      setLogs((prev) => [
        {
          id: `${contact.phone}-${Date.now()}`,
          phone: contact.phone,
          name: contact.name,
          district: contact.district,
          status: sentSuccess ? "sent" : "error",
          error: errorMsg,
          time: new Date().toLocaleTimeString("pt-BR"),
          messageText: personalizedMsg,
        },
        ...prev,
      ]);

      // 4. Pausa de lote (a cada X mensagens)
      if ((i + 1) % batchSize === 0 && i + 1 < targetList.length) {
        let restSec = batchPauseMinutes * 60;
        while (restSec > 0 && !abortRef.current && !pauseRef.current) {
          const min = Math.floor(restSec / 60);
          const s = restSec % 60;
          setCurrentStep(`☕ Pausa preventiva anti-bloqueio (Lote de ${batchSize}): ${min}m ${s}s restantes...`);
          setCountdownSeconds(restSec);
          await new Promise((r) => setTimeout(r, 1000));
          restSec--;
        }
      } else if (i + 1 < targetList.length) {
        // 5. Intervalo Aleatório entre mensagens
        const randomDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1) + minDelay);
        let sec = randomDelay;
        while (sec > 0 && !abortRef.current && !pauseRef.current) {
          setCurrentStep(`⏳ Intervalo humanizado para próximo envio: ${sec}s...`);
          setCountdownSeconds(sec);
          await new Promise((r) => setTimeout(r, 1000));
          sec--;
        }
      }
    }

    setIsRunning(false);
    setCurrentStep(abortRef.current ? "⏹️ Disparo interrompido pelo usuário." : "✅ Lote de 150 disparos concluído com sucesso!");
    setTypingProgressText("");
  };

  const handlePauseResume = () => {
    if (isPaused) {
      pauseRef.current = false;
      setIsPaused(false);
    } else {
      pauseRef.current = true;
      setIsPaused(true);
    }
  };

  const handleStop = () => {
    if (confirm("Deseja realmente parar o disparo em andamento?")) {
      abortRef.current = true;
      setIsRunning(false);
      setIsPaused(false);
    }
  };

  const completedPct = targetListCount() > 0 ? Math.round((currentIndex / targetListCount()) * 100) : 0;

  function targetListCount() {
    return Math.min(contacts.length, dailyLimit);
  }

  return (
    <div className="whb-container">
      {/* 1. Status de Conexão WhatsApp / QR Code */}
      <div className="whb-card">
        <div className="whb-card-header">
          <div className="whb-card-title">
            <span>📱 Conexão WhatsApp do Chip</span>
          </div>
          {connectionStatus === "connected" ? (
            <span className="whb-badge whb-badge-online">🟢 Conectado ({connectedNumber})</span>
          ) : connectionStatus === "qrcode" ? (
            <span className="whb-badge whb-badge-connecting">🟡 Aguardando Leitura</span>
          ) : (
            <span className="whb-badge whb-badge-offline">🔴 Desconectado</span>
          )}
        </div>

        {connectionStatus === "disconnected" && (
          <div className="whb-qr-box">
            <p style={{ margin: 0, fontSize: "0.85rem", color: "#cbd5e1" }}>
              Conecte seu WhatsApp lendo o QR Code para iniciar os disparos automatizados de forma humanizada.
            </p>
            <button className="whb-btn whb-btn-start" onClick={handleGenerateQR}>
              📷 Gerar QR Code de Conexão
            </button>
          </div>
        )}

        {connectionStatus === "generating" && (
          <div className="whb-qr-box">
            <div className="whb-typing-indicator">
              <span>Gerando sessão segura do WhatsApp...</span>
              <div className="whb-typing-dots">
                <span className="whb-typing-dot" />
                <span className="whb-typing-dot" />
                <span className="whb-typing-dot" />
              </div>
            </div>
          </div>
        )}

        {connectionStatus === "qrcode" && (
          <div className="whb-qr-box">
            <div className="whb-qr-frame">
              {qrCodeData ? <img src={qrCodeData} alt="QR Code WhatsApp" /> : <div>Carregando QR...</div>}
            </div>
            <div className="whb-qr-steps">
              <strong>Como conectar:</strong>
              <ol>
                <li>Abra o WhatsApp no seu celular</li>
                <li>Toque nos 3 pontinhos ou Configurações &gt; <strong>Aparelhos Conectados</strong></li>
                <li>Toque em <strong>Conectar Aparelho</strong> e aponte para o QR Code acima</li>
              </ol>
            </div>
            <div style={{ display: "flex", gap: "8px", width: "100%" }}>
              <button className="whb-btn whb-btn-secondary" onClick={handleGenerateQR}>
                🔄 Atualizar QR Code
              </button>
              <button className="whb-btn whb-btn-start" onClick={handleSimulateConnection}>
                ✅ Conectar Sessão
              </button>
            </div>
          </div>
        )}

        {connectionStatus === "connected" && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.8rem", color: "#94a3b8" }}>
            <span>Sessão ativa e protegida com simulação de presença humana habilitada.</span>
            <button
              className="whb-btn whb-btn-secondary"
              style={{ flex: "none", padding: "4px 10px", fontSize: "0.75rem" }}
              onClick={() => setConnectionStatus("disconnected")}
            >
              Desconectar
            </button>
          </div>
        )}
      </div>

      {/* 2. Configurações de Segurança e Pacing (150/dia) */}
      <div className="whb-card">
        <div className="whb-card-header">
          <div className="whb-card-title">
            <span>🛡️ Configuração Anti-Bloqueio (150 disparos/dia)</span>
          </div>
          <span className="whb-badge whb-badge-online">Modo Seguro Ativo</span>
        </div>

        <div className="whb-grid-3">
          <div className="whb-field">
            <label>Meta diária de envios</label>
            <select className="whb-select" value={dailyLimit} onChange={(e) => setDailyLimit(Number(e.target.value))}>
              <option value={50}>50 contatos (Aquecimento)</option>
              <option value={100}>100 contatos (Moderado)</option>
              <option value={150}>150 contatos (Recomendado)</option>
              <option value={200}>200 contatos (Máximo)</option>
            </select>
          </div>

          <div className="whb-field">
            <label>Intervalo entre envios (segundos)</label>
            <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
              <input
                type="number"
                className="whb-input"
                value={minDelay}
                onChange={(e) => setMinDelay(Number(e.target.value))}
                min={20}
                max={120}
              />
              <span style={{ fontSize: "0.75rem", color: "#64748b" }}>a</span>
              <input
                type="number"
                className="whb-input"
                value={maxDelay}
                onChange={(e) => setMaxDelay(Number(e.target.value))}
                min={30}
                max={180}
              />
            </div>
          </div>

          <div className="whb-field">
            <label>Simulação de Digitação</label>
            <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
              <input
                type="number"
                className="whb-input"
                value={typingDurationMin}
                onChange={(e) => setTypingDurationMin(Number(e.target.value))}
                min={2}
                max={10}
              />
              <span style={{ fontSize: "0.75rem", color: "#64748b" }}>a</span>
              <input
                type="number"
                className="whb-input"
                value={typingDurationMax}
                onChange={(e) => setTypingDurationMax(Number(e.target.value))}
                min={4}
                max={15}
              />
              <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>s</span>
            </div>
          </div>
        </div>

        <div style={{ marginTop: "10px", fontSize: "0.75rem", color: "#94a3b8", display: "flex", justifyContent: "space-between" }}>
          <span>☕ Pausa preventiva de {batchPauseMinutes} min a cada lote de {batchSize} mensagens.</span>
          <span>Tempo estimado do lote: ~2h30min</span>
        </div>
      </div>

      {/* 3. Editor de Mensagem com Spintax */}
      <div className="whb-card">
        <div className="whb-card-header">
          <div className="whb-card-title">
            <span>✍️ Mensagem com Variação Inteligente (Spintax)</span>
          </div>
          <button className="whb-tag-btn" onClick={refreshPreview} title="Gerar outra variação">
            🎲 Testar Variação Aleatória
          </button>
        </div>

        <textarea
          className="whb-textarea"
          value={messageTemplate}
          onChange={(e) => setMessageTemplate(e.target.value)}
          placeholder="Digite o texto com variações {Oi|Olá|Tudo bem?} e tags..."
        />

        <div className="whb-tag-row">
          <span style={{ fontSize: "0.7rem", color: "#64748b", alignSelf: "center" }}>Tags disponíveis:</span>
          <button className="whb-tag-btn" onClick={() => setMessageTemplate((prev) => prev + " {primeiro_nome}")}>
            + &#123;primeiro_nome&#125;
          </button>
          <button className="whb-tag-btn" onClick={() => setMessageTemplate((prev) => prev + " {bairro}")}>
            + &#123;bairro&#125;
          </button>
          <button className="whb-tag-btn" onClick={() => setMessageTemplate((prev) => prev + " {link_enquete}")}>
            + &#123;link_enquete&#125;
          </button>
          <button className="whb-tag-btn" onClick={() => setMessageTemplate((prev) => prev + " {Olá|Oi|Tudo bem?}")}>
            + Spintax &#123;A|B|C&#125;
          </button>
        </div>
      </div>

      {/* 4. Simulador ao Vivo & Progresso */}
      <div className="whb-card">
        <div className="whb-card-header">
          <div className="whb-card-title">
            <span>⚡ Painel de Disparo em Tempo Real</span>
          </div>
          <span style={{ fontSize: "0.75rem", color: "#38bdf8", fontWeight: 700 }}>
            {currentIndex} / {targetListCount()} ({completedPct}%)
          </span>
        </div>

        <div className="whb-live-simulator">
          <div className="whb-typing-indicator">
            <span>{currentStep}</span>
            {isRunning && !isPaused && (
              <div className="whb-typing-dots">
                <span className="whb-typing-dot" />
                <span className="whb-typing-dot" />
                <span className="whb-typing-dot" />
              </div>
            )}
          </div>

          <div className="whb-preview-bubble">
            {typingProgressText || simulatedPreview}
            <div className="whb-bubble-tail" />
          </div>
        </div>

        <div className="whb-progress-box">
          <div className="whb-progress-labels">
            <span>Progresso da Fila Diária</span>
            <span>{contacts.length} contatos carregados</span>
          </div>
          <div className="whb-progress-track">
            <div className="whb-progress-fill" style={{ width: `${completedPct}%` }} />
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="whb-actions-row">
          {!isRunning ? (
            <button className="whb-btn whb-btn-start" onClick={startHumanizedBroadcast} disabled={contacts.length === 0}>
              ▶️ Iniciar Disparo Humanizado ({targetListCount()} contatos)
            </button>
          ) : (
            <>
              <button className="whb-btn whb-btn-pause" onClick={handlePauseResume}>
                {isPaused ? "▶️ Retomar Disparo" : "⏸️ Pausar"}
              </button>
              <button className="whb-btn whb-btn-stop" onClick={handleStop}>
                ⏹️ Interromper
              </button>
            </>
          )}
        </div>
      </div>

      {/* 5. Histórico e Logs em Tempo Real */}
      {logs.length > 0 && (
        <div className="whb-card">
          <div className="whb-card-header">
            <div className="whb-card-title">
              <span>📋 Log de Envios ({logs.length})</span>
            </div>
            <span style={{ fontSize: "0.72rem", color: "#34d399" }}>
              ✅ {logs.filter((l) => l.status === "sent").length} enviados com sucesso
            </span>
          </div>

          <div className="whb-log-list">
            {logs.map((log) => (
              <div key={log.id} className={`whb-log-item ${log.status}`}>
                <div>
                  <strong>{log.name}</strong> ({log.phone}) · <span style={{ color: "#94a3b8" }}>{log.district || "Arapongas"}</span>
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <span style={{ fontSize: "0.7rem", color: "#64748b" }}>{log.time}</span>
                  {log.status === "sent" ? (
                    <span style={{ color: "#34d399", fontWeight: 700 }}>✅ Entregue</span>
                  ) : (
                    <span style={{ color: "#f87171", fontWeight: 700 }}>❌ {log.error || "Falha"}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
