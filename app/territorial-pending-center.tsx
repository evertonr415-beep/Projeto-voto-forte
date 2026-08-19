"use client";

import { useEffect } from "react";
import { apiFetch } from "./supabase-client";

type Issue = {
  record_id: number;
  owner_email: string;
  contact_name: string;
  phone: string;
  district_original: string;
  district_key: string | null;
  category: string;
  suggested_district: string | null;
};

type ReferenceIssue = {
  district: string;
  total: number;
  key: string;
  postalReferences: Array<{ cepStart: string; cepEnd: string }>;
};

type ReferencePoint = {
  latitude: number;
  longitude: number;
};

type MapClickEvent = {
  latlng?: { lat?: number; lng?: number };
};

type ElectoralMap = {
  _container?: HTMLElement;
  on?: (event: string, handler: (event: MapClickEvent) => void) => void;
  off?: (event: string, handler: (event: MapClickEvent) => void) => void;
};

type PendingResponse = {
  total: number;
  page: number;
  totalPages: number;
  issues: Issue[];
  districts: string[];
  referenceIssues: ReferenceIssue[];
  referenceIssueContacts: number;
  canManageReferences: boolean;
};

const CATEGORY_LABELS: Record<string, string> = {
  provavel_alias: "Provável nome equivalente",
  revisao_manual: "Revisão manual",
  sem_valor_util: "Bairro não informado",
  cidade_ou_nao_encontrado: "Cidade ou não encontrado",
  rural_localidade: "Zona rural / localidade",
};

function currentScope() {
  return document.querySelector<HTMLSelectElement>(".scope-picker select")?.value || "";
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function installStyles() {
  const id = "vf-territorial-pending-center-style";
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = `
    .vf-territorial-center-host{width:100%}.vf-territorial-center{margin:0 0 14px;border:1px solid rgba(23,52,92,.12);border-radius:16px;background:#fff;box-shadow:0 10px 28px rgba(15,35,65,.08);overflow:hidden;color:#17345c}
    .vf-territorial-center>header{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:13px 15px;background:linear-gradient(135deg,#fff,#f7f9fc)}
    .vf-territorial-center>header div{min-width:0}.vf-territorial-center>header strong{display:block;font:800 14px/1.2 Arial,sans-serif}.vf-territorial-center>header small{display:block;margin-top:3px;color:#64748b;font:600 10px/1.35 Arial,sans-serif}
    .vf-territorial-center button{cursor:pointer}.vf-territorial-center>header button{flex:0 0 auto;border:1px solid #d8e1ec;border-radius:10px;background:#fff;color:#17345c;padding:8px 11px;font:800 11px/1 Arial,sans-serif}
    .vf-territorial-body{border-top:1px solid #edf1f5;padding:12px 14px 14px}.vf-territorial-intro{margin:0 0 10px;color:#52657f;font:600 11px/1.45 Arial,sans-serif}
    .vf-territorial-tabs{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin:0 0 11px}.vf-territorial-tabs button{border:1px solid #d8e1ec;border-radius:10px;background:#fff;color:#52657f;padding:8px 10px;font:800 10px/1.2 Arial,sans-serif}.vf-territorial-tabs button[data-active="true"]{background:#17345c;color:#fff;border-color:#17345c}
    .vf-territorial-list{display:grid;gap:9px}.vf-territorial-row{display:grid;grid-template-columns:minmax(180px,1fr) minmax(220px,1.1fr);gap:12px;align-items:center;border:1px solid #e4eaf1;border-radius:12px;padding:10px;background:#fbfcfe}
    .vf-territorial-person strong{display:block;font:800 12px/1.25 Arial,sans-serif;color:#17345c}.vf-territorial-person span{display:block;margin-top:3px;color:#66758a;font:600 10px/1.35 Arial,sans-serif}.vf-territorial-person em{display:inline-block;margin-top:6px;border-radius:999px;background:#eef3f8;color:#52657f;padding:3px 7px;font:700 9px/1 Arial,sans-serif;font-style:normal}
    .vf-territorial-actions{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px}.vf-territorial-actions select{min-width:0;border:1px solid #cfd9e5;border-radius:9px;background:#fff;color:#17345c;padding:8px;font:700 10px/1.2 Arial,sans-serif}.vf-territorial-actions button{border:0;border-radius:9px;background:#17345c;color:#fff;padding:8px 10px;font:800 10px/1 Arial,sans-serif}.vf-territorial-actions button:disabled{opacity:.55;cursor:wait}.vf-territorial-matching{grid-column:1/-1;display:flex;align-items:center;gap:6px;color:#64748b;font:650 9px/1.25 Arial,sans-serif}.vf-territorial-matching input{margin:0}
    .vf-territorial-reference-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:7px}.vf-territorial-reference-actions button{border:0;border-radius:9px;background:#17345c;color:#fff;padding:8px 10px;font:800 10px/1 Arial,sans-serif}.vf-territorial-reference-actions button[data-role="capture"]{background:#fff;color:#17345c;border:1px solid #cfd9e5}.vf-territorial-reference-actions button:disabled{opacity:.5;cursor:not-allowed}.vf-territorial-coordinate{grid-column:1/-1;color:#326644;font:750 9px/1.35 Arial,sans-serif}.vf-territorial-capture{margin:0 0 10px;padding:10px;border-radius:10px;background:#eef6ff;color:#23558a;font:750 10px/1.4 Arial,sans-serif}
    .vf-territorial-footer{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:11px}.vf-territorial-footer span{color:#64748b;font:650 10px/1 Arial,sans-serif}.vf-territorial-footer div{display:flex;gap:6px}.vf-territorial-footer button{border:1px solid #d8e1ec;border-radius:8px;background:#fff;color:#17345c;padding:7px 9px;font:800 10px/1 Arial,sans-serif}.vf-territorial-footer button:disabled{opacity:.4;cursor:not-allowed}.vf-territorial-empty{margin:0;padding:12px;border-radius:10px;background:#f3f8f4;color:#326644;font:750 11px/1.4 Arial,sans-serif}.vf-territorial-error{margin:0 0 10px;padding:10px;border-radius:10px;background:#fff4f4;color:#9d2f2f;font:700 10px/1.4 Arial,sans-serif}
    @media(max-width:760px){.vf-territorial-center{margin:0 0 12px;border-radius:14px}.vf-territorial-center>header{padding:11px 12px}.vf-territorial-center>header strong{font-size:12px}.vf-territorial-center>header small{font-size:9px}.vf-territorial-body{padding:10px}.vf-territorial-row{grid-template-columns:1fr;gap:9px;padding:9px}.vf-territorial-actions{grid-template-columns:minmax(0,1fr) auto}.vf-territorial-actions select{font-size:9px}.vf-territorial-actions button{padding:8px;font-size:9px}.vf-territorial-reference-actions{justify-content:stretch}.vf-territorial-reference-actions button{flex:1 1 120px}.vf-territorial-tabs{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
}

export default function TerritorialPendingCenter() {
  useEffect(() => {
    installStyles();
    let disposed = false;
    let host: HTMLElement | null = null;
    let open = false;
    let section: "contacts" | "references" = "contacts";
    let page = 1;
    let scope = currentScope();
    let data: PendingResponse | null = null;
    let loading = false;
    let error = "";
    let requestId = 0;
    let captureDistrict = "";
    let captureCleanup: (() => void) | null = null;
    const choices = new Map<number, string>();
    const matching = new Set<number>();
    const saving = new Set<number>();
    const referenceDrafts = new Map<string, ReferencePoint>();
    const referenceSaving = new Set<string>();

    const stopCapture = () => {
      captureCleanup?.();
      captureCleanup = null;
      captureDistrict = "";
    };

    const render = () => {
      if (!host || !host.isConnected) return;
      const contactTotal = data?.total ?? 0;
      const referenceTotal = data?.referenceIssues.length ?? 0;
      const headerTotals = data
        ? ` · ${contactTotal.toLocaleString("pt-BR")} contatos · ${referenceTotal.toLocaleString("pt-BR")} bairros sem ponto`
        : "";
      const errorHtml = error
        ? `<p class="vf-territorial-error">${escapeHtml(error)}</p>`
        : "";
      let body = "";

      if (open) {
        const tabs = `<div class="vf-territorial-tabs">
          <button type="button" data-role="tab-contacts" data-active="${section === "contacts"}">Contatos para revisar · ${contactTotal.toLocaleString("pt-BR")}</button>
          <button type="button" data-role="tab-references" data-active="${section === "references"}">Bairros sem ponto · ${referenceTotal.toLocaleString("pt-BR")}</button>
        </div>`;

        if (loading && !data) {
          body = `<div class="vf-territorial-body">${tabs}<p class="vf-territorial-intro">Carregando pendências…</p></div>`;
        } else if (section === "references") {
          const captureHtml = captureDistrict
            ? `<p class="vf-territorial-capture">Agora toque no mapa no ponto que representa <b>${escapeHtml(captureDistrict)}</b>. Esse ponto será apenas uma referência territorial do bairro, nunca uma coordenada individual.</p>`
            : "";
          const rows = (data?.referenceIssues ?? [])
            .map((issue) => {
              const draft = referenceDrafts.get(issue.district);
              const isSaving = referenceSaving.has(issue.district);
              const postal = issue.postalReferences.length
                ? issue.postalReferences
                    .slice(0, 2)
                    .map((ref) =>
                      ref.cepStart === ref.cepEnd || !ref.cepEnd
                        ? ref.cepStart
                        : `${ref.cepStart} a ${ref.cepEnd}`,
                    )
                    .filter(Boolean)
                    .join(" · ")
                : "sem referência postal cadastrada";
              return `<div class="vf-territorial-row" data-ref-district="${escapeHtml(issue.district)}">
                <div class="vf-territorial-person">
                  <strong>${escapeHtml(issue.district)}</strong>
                  <span><b>${issue.total.toLocaleString("pt-BR")}</b> contato(s) aguardando ponto azul · ${escapeHtml(postal)}</span>
                  <em>bairro reconhecido · falta referência no mapa</em>
                </div>
                <div class="vf-territorial-reference-actions">
                  <button type="button" data-role="capture"${!data?.canManageReferences || isSaving ? " disabled" : ""}>${captureDistrict === issue.district ? "Toque no mapa…" : draft ? "Remarcar no mapa" : "Marcar no mapa"}</button>
                  <button type="button" data-role="save-reference"${!draft || !data?.canManageReferences || isSaving ? " disabled" : ""}>${isSaving ? "Salvando…" : "Salvar ponto azul"}</button>
                  ${draft ? `<span class="vf-territorial-coordinate">Ponto selecionado: ${draft.latitude.toFixed(6)}, ${draft.longitude.toFixed(6)}</span>` : ""}
                </div>
              </div>`;
            })
            .join("");
          const permissionNote = data?.canManageReferences
            ? "Escolha um bairro, toque em “Marcar no mapa” e depois toque no local de referência. Ao salvar, todos os contatos desse bairro passam a contribuir para o ponto azul."
            : "As referências territoriais globais podem ser definidas somente pelo Administrador Master.";
          body = `<div class="vf-territorial-body">${tabs}
            <p class="vf-territorial-intro">${permissionNote}</p>
            ${captureHtml}${errorHtml}
            ${rows ? `<div class="vf-territorial-list">${rows}</div>` : `<p class="vf-territorial-empty">Todos os bairros com contatos já possuem referência territorial no mapa.</p>`}
          </div>`;
        } else if (data?.issues.length) {
          const rows = data.issues
            .map((issue) => {
              if (!choices.has(issue.record_id) && issue.suggested_district)
                choices.set(issue.record_id, issue.suggested_district);
              const selected = choices.get(issue.record_id) ?? issue.suggested_district ?? "";
              const optionNames = [...data!.districts];
              if (issue.suggested_district && !optionNames.includes(issue.suggested_district))
                optionNames.unshift(issue.suggested_district);
              const options = [
                `<option value="">Selecionar bairro…</option>`,
                ...optionNames.map(
                  (district) =>
                    `<option value="${escapeHtml(district)}"${district === selected ? " selected" : ""}>${escapeHtml(district)}${district === issue.suggested_district ? " — sugerido" : ""}</option>`,
                ),
              ].join("");
              const isSaving = saving.has(issue.record_id);
              return `<div class="vf-territorial-row" data-record-id="${issue.record_id}">
                <div class="vf-territorial-person">
                  <strong>${escapeHtml(issue.contact_name || "Contato sem nome")}</strong>
                  <span>Bairro informado: <b>${escapeHtml(issue.district_original || "não informado")}</b>${issue.phone ? ` · ${escapeHtml(issue.phone)}` : ""}</span>
                  <em>${escapeHtml(CATEGORY_LABELS[issue.category] || "Revisão territorial")}</em>
                </div>
                <div class="vf-territorial-actions">
                  <select data-role="district" aria-label="Bairro correto">${options}</select>
                  <button type="button" data-role="save"${isSaving ? " disabled" : ""}>${isSaving ? "Salvando…" : "Associar"}</button>
                  ${
                    issue.district_key
                      ? `<label class="vf-territorial-matching"><input type="checkbox" data-role="matching"${matching.has(issue.record_id) ? " checked" : ""}/> Aplicar também aos contatos deste ambiente com o mesmo bairro informado</label>`
                      : ""
                  }
                </div>
              </div>`;
            })
            .join("");
          body = `<div class="vf-territorial-body">${tabs}
            <p class="vf-territorial-intro">Ao associar um bairro, o contato passa a contribuir para o ponto azul territorial quando esse bairro já possui uma referência no mapa. Ele só recebe pino individual se já possuir coordenadas exatas confiáveis.</p>
            ${errorHtml}
            <div class="vf-territorial-list">${rows}</div>
            <div class="vf-territorial-footer"><span>Página ${data.page} de ${data.totalPages}</span><div>
              <button type="button" data-role="previous"${page <= 1 || loading ? " disabled" : ""}>Anterior</button>
              <button type="button" data-role="next"${page >= data.totalPages || loading ? " disabled" : ""}>Próxima</button>
            </div></div>
          </div>`;
        } else {
          body = `<div class="vf-territorial-body">${tabs}${errorHtml}<p class="vf-territorial-empty">Nenhum contato com bairro não reconhecido neste ambiente.</p></div>`;
        }
      }

      host.innerHTML = `<section class="vf-territorial-center" aria-label="Pendências territoriais">
        <header><div><strong>Pendências territoriais${headerTotals}</strong><small>Corrija nomes de bairro e também referências territoriais ausentes, sem inventar localização individual.</small></div>
        <button type="button" data-role="toggle" aria-expanded="${open ? "true" : "false"}">${open ? "Fechar" : "Revisar"}</button></header>${body}
      </section>`;

      host.querySelector<HTMLButtonElement>("[data-role='toggle']")?.addEventListener("click", () => {
        open = !open;
        if (!open) stopCapture();
        render();
      });
      host.querySelector<HTMLButtonElement>("[data-role='tab-contacts']")?.addEventListener("click", () => {
        stopCapture();
        section = "contacts";
        render();
      });
      host.querySelector<HTMLButtonElement>("[data-role='tab-references']")?.addEventListener("click", () => {
        section = "references";
        render();
      });
      host.querySelector<HTMLButtonElement>("[data-role='previous']")?.addEventListener("click", () => {
        page = Math.max(1, page - 1);
        void load();
      });
      host.querySelector<HTMLButtonElement>("[data-role='next']")?.addEventListener("click", () => {
        page += 1;
        void load();
      });
      host.querySelectorAll<HTMLElement>("[data-record-id]").forEach((row) => {
        const recordId = Number(row.dataset.recordId);
        const select = row.querySelector<HTMLSelectElement>("[data-role='district']");
        const checkbox = row.querySelector<HTMLInputElement>("[data-role='matching']");
        const save = row.querySelector<HTMLButtonElement>("[data-role='save']");
        select?.addEventListener("change", () => choices.set(recordId, select.value));
        checkbox?.addEventListener("change", () => {
          if (checkbox.checked) matching.add(recordId);
          else matching.delete(recordId);
        });
        save?.addEventListener("click", () => void resolveIssue(recordId));
      });
      host.querySelectorAll<HTMLElement>("[data-ref-district]").forEach((row) => {
        const district = row.dataset.refDistrict || "";
        row.querySelector<HTMLButtonElement>("[data-role='capture']")?.addEventListener("click", () => {
          startReferenceCapture(district);
        });
        row.querySelector<HTMLButtonElement>("[data-role='save-reference']")?.addEventListener("click", () => {
          void saveReference(district);
        });
      });
    };

    const load = async () => {
      if (!host || disposed) return;
      const id = ++requestId;
      loading = true;
      error = "";
      render();
      try {
        const params = new URLSearchParams({ page: String(page), pageSize: "12" });
        if (scope) params.set("owner", scope);
        const response = await apiFetch(`/api/territorial-pending?${params.toString()}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as PendingResponse & { error?: string };
        if (!response.ok) throw new Error(payload.error || "Falha ao carregar pendências");
        if (disposed || id !== requestId) return;
        data = payload;
      } catch (cause) {
        if (disposed || id !== requestId) return;
        error = cause instanceof Error ? cause.message : "Não foi possível carregar as pendências";
      } finally {
        if (!disposed && id === requestId) {
          loading = false;
          render();
        }
      }
    };

    const resolveIssue = async (recordId: number) => {
      if (!data || saving.has(recordId)) return;
      const issue = data.issues.find((item) => item.record_id === recordId);
      if (!issue) return;
      const district = choices.get(recordId) ?? issue.suggested_district ?? "";
      if (!district) {
        error = "Selecione o bairro correto antes de confirmar.";
        render();
        return;
      }
      saving.add(recordId);
      error = "";
      render();
      try {
        const response = await apiFetch("/api/territorial-pending", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            recordId,
            district,
            applyToMatching: matching.has(recordId),
            owner: scope || undefined,
          }),
        });
        const payload = (await response.json()) as { error?: string };
        if (!response.ok) throw new Error(payload.error || "Não foi possível corrigir a pendência");
        choices.delete(recordId);
        matching.delete(recordId);
        window.dispatchEvent(new CustomEvent("voto-forte:records-changed"));
        window.dispatchEvent(new CustomEvent("voto-forte:geocoding-complete"));
        await load();
      } catch (cause) {
        error = cause instanceof Error ? cause.message : "Não foi possível corrigir a pendência";
      } finally {
        saving.delete(recordId);
        render();
      }
    };

    const startReferenceCapture = (district: string) => {
      if (!district || !data?.canManageReferences) return;
      stopCapture();
      const map = (window as Window & { __vfElectoralMap?: ElectoralMap }).__vfElectoralMap;
      if (!map?._container || !map.on || !map.off) {
        error = "O mapa ainda não está pronto para selecionar a referência. Aguarde alguns segundos e tente novamente.";
        render();
        return;
      }
      captureDistrict = district;
      error = "";
      const handler = (event: MapClickEvent) => {
        const latitude = Number(event.latlng?.lat);
        const longitude = Number(event.latlng?.lng);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
        referenceDrafts.set(district, { latitude, longitude });
        stopCapture();
        render();
      };
      map.on("click", handler);
      captureCleanup = () => map.off?.("click", handler);
      render();
    };

    const saveReference = async (district: string) => {
      if (!data?.canManageReferences || referenceSaving.has(district)) return;
      const draft = referenceDrafts.get(district);
      if (!draft) {
        error = "Marque primeiro o ponto de referência no mapa.";
        render();
        return;
      }
      referenceSaving.add(district);
      error = "";
      render();
      try {
        const response = await apiFetch("/api/territorial-pending", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            referenceDistrict: district,
            latitude: draft.latitude,
            longitude: draft.longitude,
          }),
        });
        const payload = (await response.json()) as { error?: string };
        if (!response.ok)
          throw new Error(payload.error || "Não foi possível salvar a referência territorial");
        referenceDrafts.delete(district);
        window.dispatchEvent(new CustomEvent("voto-forte:records-changed"));
        window.dispatchEvent(new CustomEvent("voto-forte:geocoding-complete"));
        await load();
      } catch (cause) {
        error = cause instanceof Error ? cause.message : "Não foi possível salvar a referência territorial";
      } finally {
        referenceSaving.delete(district);
        render();
      }
    };

    const ensureHost = () => {
      const fullMap = document.querySelector<HTMLElement>(".full-map");
      if (!fullMap?.parentElement) {
        stopCapture();
        if (host?.isConnected) host.remove();
        host = null;
        return;
      }
      if (host?.isConnected && host.nextElementSibling === fullMap) return;
      if (host?.isConnected) host.remove();
      host = document.createElement("div");
      host.className = "vf-territorial-center-host";
      fullMap.parentElement.insertBefore(host, fullMap);
      scope = currentScope();
      page = 1;
      data = null;
      void load();
    };

    const handleScope = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (!target?.matches(".scope-picker select")) return;
      stopCapture();
      scope = (target as HTMLSelectElement).value;
      page = 1;
      data = null;
      choices.clear();
      matching.clear();
      referenceDrafts.clear();
      void load();
    };

    let frameId = 0;
    const observer = new MutationObserver(() => {
      if (frameId) return;
      frameId = window.requestAnimationFrame(() => {
        frameId = 0;
        ensureHost();
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("change", handleScope, true);
    ensureHost();

    return () => {
      disposed = true;
      requestId += 1;
      stopCapture();
      if (frameId) window.cancelAnimationFrame(frameId);
      observer.disconnect();
      document.removeEventListener("change", handleScope, true);
      host?.remove();
    };
  }, []);

  return null;
}
