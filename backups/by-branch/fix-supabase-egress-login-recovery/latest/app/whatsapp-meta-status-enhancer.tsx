"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { apiFetch } from "./supabase-client";

type MetaStatusResponse = {
  success?: boolean;
  connected?: boolean;
  status?: string;
  statusLabel?: string;
  statusTone?: "success" | "warning" | "danger" | "neutral";
  statusObservedAt?: string;
  statusDetail?: string;
  accountReviewStatus?: string;
  paymentIssueDetected?: boolean;
  lastPaymentIssueAt?: string;
  latestDeliveryAt?: string;
  lastRestriction?: { code?: string; message?: string; at?: string } | null;
  data?: {
    display_phone_number?: string;
    verified_name?: string;
    quality_rating?: string;
    code_verification_status?: string;
    name_status?: string;
  };
  error?: string;
};

function formatDate(value?: string) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function qualityLabel(value?: string) {
  const normalized = String(value || "").toUpperCase();
  if (normalized === "GREEN") return "Alta";
  if (normalized === "YELLOW") return "Média";
  if (normalized === "RED") return "Baixa";
  if (normalized === "NA" || normalized === "UNKNOWN") return "Não definida";
  return value || "—";
}

function tonePalette(tone?: MetaStatusResponse["statusTone"]) {
  if (tone === "danger") {
    return {
      border: "rgba(248,113,113,.45)",
      background: "rgba(127,29,29,.18)",
      badge: "rgba(239,68,68,.18)",
      badgeText: "#fecaca",
      dot: "#ef4444",
    };
  }
  if (tone === "warning") {
    return {
      border: "rgba(251,191,36,.42)",
      background: "rgba(120,53,15,.16)",
      badge: "rgba(245,158,11,.17)",
      badgeText: "#fde68a",
      dot: "#f59e0b",
    };
  }
  if (tone === "success") {
    return {
      border: "rgba(45,221,127,.36)",
      background: "rgba(6,78,59,.18)",
      badge: "rgba(45,221,127,.14)",
      badgeText: "#86efac",
      dot: "#2ddd7f",
    };
  }
  return {
    border: "rgba(148,163,184,.3)",
    background: "rgba(30,41,59,.38)",
    badge: "rgba(148,163,184,.14)",
    badgeText: "#cbd5e1",
    dot: "#94a3b8",
  };
}

export default function WhatsappMetaStatusEnhancer() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [data, setData] = useState<MetaStatusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);

  useEffect(() => {
    let observer: MutationObserver | null = null;

    const attach = () => {
      const panel = document.querySelector<HTMLElement>("article.panel:has(.wt-kpi-grid-5)");
      const kpis = panel?.querySelector<HTMLElement>(".wt-kpi-grid-5");
      if (!panel || !kpis) {
        if (host?.isConnected === false) setHost(null);
        return;
      }

      let current = panel.querySelector<HTMLElement>("#vf-meta-status-host");
      if (!current) {
        current = document.createElement("div");
        current.id = "vf-meta-status-host";
        kpis.insertAdjacentElement("beforebegin", current);
      }
      if (current !== host) setHost(current);
    };

    attach();
    observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer?.disconnect();
  }, [host]);

  const refresh = useCallback(async () => {
    if (!host) return;
    setLoading(true);
    try {
      const response = await apiFetch("/api/whatsapp/status", {
        method: "POST",
        cache: "no-store",
      });

      if (response.status === 401 || response.status === 403) {
        setHidden(true);
        return;
      }

      const payload = (await response.json()) as MetaStatusResponse;
      setHidden(false);
      setData(payload);
      setCheckedAt(new Date());
    } catch {
      setData({
        status: "error",
        statusLabel: "Não foi possível verificar",
        statusTone: "neutral",
        statusDetail: "A consulta de status da Meta falhou temporariamente.",
      });
      setCheckedAt(new Date());
    } finally {
      setLoading(false);
    }
  }, [host]);

  useEffect(() => {
    if (!host) return;
    void refresh();
    const timer = window.setInterval(() => void refresh(), 60_000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [host, refresh]);

  const palette = useMemo(() => tonePalette(data?.statusTone), [data?.statusTone]);

  if (!host || hidden) return null;

  const phone = data?.data?.display_phone_number || "Número configurado na Meta";
  const name = data?.data?.verified_name || "WhatsApp Business";
  const quality = qualityLabel(data?.data?.quality_rating);
  const restriction = data?.lastRestriction;
  const paymentWarning = Boolean(data?.paymentIssueDetected);

  return createPortal(
    <section
      aria-label="Status da conta Meta WhatsApp Business"
      style={{
        margin: "0 0 16px",
        padding: "14px 16px",
        borderRadius: "12px",
        border: `1px solid ${palette.border}`,
        background: palette.background,
      }}
    >
      <div
        style={{
          display: "flex",
          gap: "12px",
          alignItems: "flex-start",
          justifyContent: "space-between",
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 0, flex: "1 1 330px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <span
              aria-hidden="true"
              style={{
                width: "9px",
                height: "9px",
                borderRadius: "999px",
                background: palette.dot,
                boxShadow: `0 0 0 4px ${palette.badge}`,
              }}
            />
            <strong style={{ color: "#f8fafc", fontSize: "14px" }}>Meta / WhatsApp Business</strong>
            <span
              style={{
                padding: "4px 8px",
                borderRadius: "999px",
                background: palette.badge,
                color: palette.badgeText,
                fontSize: "11px",
                fontWeight: 800,
                letterSpacing: ".02em",
              }}
            >
              {loading && !data ? "VERIFICANDO…" : data?.statusLabel || "Verificando…"}
            </span>
          </div>

          <div style={{ marginTop: "8px", color: "#e2e8f0", fontSize: "13px", fontWeight: 700 }}>
            {name} · {phone}
          </div>
          <p style={{ margin: "5px 0 0", color: "#94a3b8", fontSize: "12px", lineHeight: 1.45 }}>
            {data?.statusDetail || "Consultando a situação atual da conta na Meta…"}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          style={{
            border: "1px solid rgba(148,163,184,.28)",
            background: "rgba(15,23,42,.72)",
            color: "#e2e8f0",
            borderRadius: "8px",
            padding: "7px 11px",
            fontSize: "11px",
            fontWeight: 700,
            cursor: loading ? "wait" : "pointer",
          }}
        >
          {loading ? "Verificando…" : "Verificar agora"}
        </button>
      </div>

      <div
        style={{
          marginTop: "12px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
          gap: "8px",
        }}
      >
        <div style={{ padding: "8px 10px", borderRadius: "8px", background: "rgba(15,23,42,.46)" }}>
          <small style={{ display: "block", color: "#64748b", fontSize: "9px", fontWeight: 800 }}>QUALIDADE</small>
          <b style={{ color: "#f8fafc", fontSize: "12px" }}>{quality}</b>
        </div>
        <div style={{ padding: "8px 10px", borderRadius: "8px", background: "rgba(15,23,42,.46)" }}>
          <small style={{ display: "block", color: "#64748b", fontSize: "9px", fontWeight: 800 }}>REVISÃO WABA</small>
          <b style={{ color: "#f8fafc", fontSize: "12px" }}>{data?.accountReviewStatus || "—"}</b>
        </div>
        <div style={{ padding: "8px 10px", borderRadius: "8px", background: "rgba(15,23,42,.46)" }}>
          <small style={{ display: "block", color: "#64748b", fontSize: "9px", fontWeight: 800 }}>ÚLTIMO ESTADO CONFIRMADO</small>
          <b style={{ color: "#f8fafc", fontSize: "12px" }}>{formatDate(data?.statusObservedAt)}</b>
        </div>
        <div style={{ padding: "8px 10px", borderRadius: "8px", background: "rgba(15,23,42,.46)" }}>
          <small style={{ display: "block", color: "#64748b", fontSize: "9px", fontWeight: 800 }}>ÚLTIMA ENTREGA</small>
          <b style={{ color: "#f8fafc", fontSize: "12px" }}>{formatDate(data?.latestDeliveryAt)}</b>
        </div>
      </div>

      {(restriction || paymentWarning) && (
        <div
          style={{
            marginTop: "10px",
            padding: "9px 11px",
            borderRadius: "8px",
            background: "rgba(127,29,29,.18)",
            border: "1px solid rgba(248,113,113,.2)",
            color: "#fecaca",
            fontSize: "11px",
            lineHeight: 1.45,
          }}
        >
          {restriction && (
            <div>
              <b>Última restrição Meta:</b> {restriction.code || "—"} · {restriction.message || "Falha de conta"} · {formatDate(restriction.at)}
            </div>
          )}
          {paymentWarning && (
            <div style={{ marginTop: restriction ? "4px" : 0 }}>
              <b>Atenção:</b> também há registro de pendência de pagamento (erro 131042) sem entrega posterior confirmando normalização.
            </div>
          )}
        </div>
      )}

      <div
        style={{
          marginTop: "9px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "8px",
          flexWrap: "wrap",
          color: "#64748b",
          fontSize: "10px",
        }}
      >
        <span>Atualizado {checkedAt ? checkedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "agora"}</span>
        {(data?.status === "locked" || data?.status === "banned" || data?.status === "review_rejected") && (
          <a
            href="https://business.facebook.com/accountquality"
            target="_blank"
            rel="noreferrer"
            style={{ color: "#93c5fd", fontWeight: 700, textDecoration: "none" }}
          >
            Abrir Qualidade da Conta na Meta ↗
          </a>
        )}
      </div>
    </section>,
    host,
  );
}
