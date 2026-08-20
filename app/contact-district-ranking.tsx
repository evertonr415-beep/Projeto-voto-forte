"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { apiFetch } from "./supabase-client";

type DistrictItem = {
  district: string;
  total: number;
};

type SummaryResponse = {
  districts?: DistrictItem[];
  error?: string;
};

type SessionResponse = {
  user?: {
    email?: string;
    role?: string;
    accessRole?: string;
  };
};

type OrderMode = "rank" | "alphabetical";
type MobileSection = "contacts" | "sidebar";

const ADMIN_ROLES = new Set(["master", "gestor", "lider"]);
const DESKTOP_QUERY = "(min-width: 860px)";
const MOBILE_QUERY = "(max-width: 760px)";

function finiteNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
}

export default function ContactDistrictRanking() {
  const [scope, setScope] = useState("all");
  const [districts, setDistricts] = useState<DistrictItem[]>([]);
  const [mode, setMode] = useState<OrderMode>("rank");
  const [showAll, setShowAll] = useState(false);
  const [mobileSection, setMobileSection] = useState<MobileSection>("contacts");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const requestVersion = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let requested = false;
    let authObserver: MutationObserver | null = null;

    const loadScope = () => {
      if (cancelled || requested) return;
      requested = true;
      authObserver?.disconnect();
      authObserver = null;

      void apiFetch("/api/session", { cache: "no-store" })
        .then(async (response) => ({
          response,
          data: (await response.json()) as SessionResponse,
        }))
        .then(({ response, data }) => {
          if (cancelled || !response.ok) return;
          const email = String(data.user?.email || "").trim().toLowerCase();
          const role = String(data.user?.role || "").trim().toLowerCase();
          const accessRole = String(data.user?.accessRole || "").trim().toLowerCase();
          if (!email) return;
          const isAdmin =
            ADMIN_ROLES.has(role) || accessRole === "gestor" || accessRole === "adm";
          setScope(isAdmin ? "all" : email);
        })
        .catch(() => {
          if (!cancelled) setError("Não foi possível identificar o escopo dos bairros.");
        });
    };

    if (!document.querySelector(".auth-page")) {
      loadScope();
      authObserver = new MutationObserver(() => {
        if (!document.querySelector(".auth-page")) {
          authObserver?.disconnect();
          authObserver = null;
          loadScope();
        }
      });
      authObserver.observe(document.body, { childList: true, subtree: true });
    }

    const handleScopeChange = (event: Event) => {
      const control = event.target as HTMLSelectElement | null;
      if (!control?.matches(".optimized-scope-control select")) return;
      setScope(control.value);
      setShowAll(false);
    };

    document.addEventListener("change", handleScopeChange, true);
    return () => {
      cancelled = true;
      authObserver?.disconnect();
      document.removeEventListener("change", handleScopeChange, true);
    };
  }, []);

  useEffect(() => {
    let observed = true;
    let grid: HTMLElement | null = null;
    let previousGridTemplate = "";
    let media: MediaQueryList | null = null;

    const syncGrid = () => {
      if (!grid || !media) return;
      grid.style.gridTemplateColumns = media.matches
        ? "minmax(0, 1fr) 350px"
        : "1fr";
    };

    const attach = () => {
      const next = document.querySelector<HTMLElement>(".optimized-content");
      if (!next || !observed) return false;
      grid = next;
      previousGridTemplate = next.style.gridTemplateColumns;
      media = window.matchMedia(DESKTOP_QUERY);
      syncGrid();
      media.addEventListener("change", syncGrid);
      setTarget(next);
      return true;
    };

    if (attach()) {
      return () => {
        observed = false;
        media?.removeEventListener("change", syncGrid);
        if (grid) grid.style.gridTemplateColumns = previousGridTemplate;
      };
    }

    const observer = new MutationObserver(() => {
      if (!attach()) return;
      observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observed = false;
      observer.disconnect();
      media?.removeEventListener("change", syncGrid);
      if (grid) grid.style.gridTemplateColumns = previousGridTemplate;
    };
  }, []);

  useEffect(() => {
    if (!target) return;
    target.classList.toggle("mobile-show-districts", mobileSection === "sidebar");
    return () => target.classList.remove("mobile-show-districts");
  }, [mobileSection, target]);

  useEffect(() => {
    const hideDuplicatedTseShortcut = () => {
      document
        .querySelectorAll<HTMLButtonElement>(".optimized-active-district button")
        .forEach((button) => {
          if (!button.textContent?.includes("Colégios & Dados TSE")) return;
          button.hidden = true;
          button.setAttribute("aria-hidden", "true");
          button.tabIndex = -1;
        });
    };

    hideDuplicatedTseShortcut();
    const observer = new MutationObserver(hideDuplicatedTseShortcut);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  const switchMobileSection = useCallback(
    (next: MobileSection) => {
      setMobileSection(next);
      if (!target || !window.matchMedia(MOBILE_QUERY).matches) return;
      window.requestAnimationFrame(() => {
        const top = target.getBoundingClientRect().top + window.scrollY - 8;
        window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      });
    },
    [target],
  );

  const load = useCallback(async () => {
    if (!scope) return;
    const version = ++requestVersion.current;
    setLoading(true);
    setError("");

    try {
      const response = await apiFetch(
        `/api/contacts?mode=summary&owner=${encodeURIComponent(scope)}`,
        { cache: "no-store" },
      );
      const data = (await response.json()) as SummaryResponse;
      if (!response.ok) throw new Error(data.error || "Falha ao carregar bairros");
      if (version !== requestVersion.current) return;

      const normalized = (Array.isArray(data.districts) ? data.districts : [])
        .map((item) => ({
          district: String(item.district || "").trim(),
          total: finiteNumber(item.total),
        }))
        .filter((item) => item.district)
        .sort(
          (left, right) =>
            right.total - left.total ||
            left.district.localeCompare(right.district, "pt-BR"),
        );

      setDistricts(normalized);
    } catch (loadError) {
      if (version !== requestVersion.current) return;
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Não foi possível carregar a relação de bairros agora.",
      );
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    if (!scope) return;
    void load();
    const refresh = () => void load();
    window.addEventListener("voto-forte:records-changed", refresh);
    window.addEventListener("voto-forte:contacts-imported", refresh);
    window.addEventListener("voto-forte:refresh-dashboard", refresh);
    return () => {
      requestVersion.current += 1;
      window.removeEventListener("voto-forte:records-changed", refresh);
      window.removeEventListener("voto-forte:contacts-imported", refresh);
      window.removeEventListener("voto-forte:refresh-dashboard", refresh);
    };
  }, [load, scope]);

  const ranked = useMemo(
    () =>
      [...districts].sort(
        (left, right) =>
          right.total - left.total ||
          left.district.localeCompare(right.district, "pt-BR"),
      ),
    [districts],
  );

  const rows = useMemo(() => {
    if (mode === "alphabetical") {
      return [...districts].sort((left, right) =>
        left.district.localeCompare(right.district, "pt-BR"),
      );
    }
    return ranked;
  }, [districts, mode, ranked]);

  const visibleRows = showAll ? rows : rows.slice(0, 12);
  const maxTotal = Math.max(1, ranked[0]?.total || 0);
  const reached = districts.filter((item) => item.total > 0).length;

  const openDistrict = (district: string) => {
    window.dispatchEvent(
      new CustomEvent("voto-forte:filter-district-contacts", {
        detail: { district },
      }),
    );
    switchMobileSection("contacts");
  };

  const openElectoralPanel = () => {
    window.dispatchEvent(new CustomEvent("voto-forte:navigate-electoral-panel"));
  };

  const mobileSwitch = (
    <nav className="contact-mobile-switch" aria-label="Visualização do painel de contatos">
      <button
        type="button"
        className={mobileSection === "contacts" ? "is-active" : ""}
        aria-pressed={mobileSection === "contacts"}
        onClick={() => switchMobileSection("contacts")}
      >
        Contatos
      </button>
      <button
        type="button"
        className={mobileSection === "sidebar" ? "is-active" : ""}
        aria-pressed={mobileSection === "sidebar"}
        onClick={() => switchMobileSection("sidebar")}
      >
        Bairros
      </button>
    </nav>
  );

  const panel = (
    <aside className="optimized-panel district-panel" aria-busy={loading}>
      <div className="district-panel-head">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "8px",
          }}
        >
          <div>
            <small style={{ color: "#0284c7", fontWeight: 800 }}>
              INTELIGÊNCIA TERRITORIAL
            </small>
            <h2 style={{ fontSize: "18px", margin: "2px 0 0" }}>Bairros</h2>
            <span
              style={{
                display: "block",
                marginTop: "3px",
                color: "#64748b",
                fontSize: "11px",
              }}
            >
              {loading
                ? "Atualizando…"
                : `${reached.toLocaleString("pt-BR")} bairros com cadastros`}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              gap: "5px",
              flexWrap: "wrap",
              justifyContent: "flex-end",
            }}
          >
            <button
              type="button"
              onClick={openElectoralPanel}
              title="Abrir o Painel Eleitoral"
              style={{
                padding: "6px 9px",
                borderRadius: "8px",
                background: "#ffffff",
                color: "#17345c",
                fontSize: "10.5px",
                fontWeight: 800,
                border: "1px solid #cbd5e1",
                cursor: "pointer",
              }}
            >
              🗳️ Painel Eleitoral
            </button>
            <button
              type="button"
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent("voto-forte:open-whatsapp-district-modal"),
                )
              }
              style={{
                padding: "6px 9px",
                borderRadius: "8px",
                background: "#16a34a",
                color: "#ffffff",
                fontSize: "10.5px",
                fontWeight: 800,
                border: 0,
                cursor: "pointer",
                boxShadow: "0 2px 6px rgba(22, 163, 74, 0.25)",
              }}
            >
              📲 Disparo
            </button>
          </div>
        </div>
      </div>

      <div
        className="district-tabs"
        role="tablist"
        aria-label="Ordenação dos bairros"
        style={{
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          margin: "8px 0 12px",
        }}
      >
        <button
          type="button"
          className={mode === "rank" ? "is-active" : ""}
          onClick={() => {
            setMode("rank");
            setShowAll(false);
          }}
        >
          Mais cadastros
        </button>
        <button
          type="button"
          className={mode === "alphabetical" ? "is-active" : ""}
          onClick={() => {
            setMode("alphabetical");
            setShowAll(false);
          }}
        >
          A–Z
        </button>
      </div>

      {loading || !scope ? (
        <p className="optimized-empty">Carregando bairros…</p>
      ) : error ? (
        <p className="optimized-empty">{error}</p>
      ) : (
        <>
          <ol
            style={{
              listStyle: "none",
              padding: 0,
              margin: "10px 0 0",
              display: "grid",
              gap: "10px",
              maxHeight: "58vh",
              overflowY: "auto",
              paddingRight: "4px",
            }}
          >
            {visibleRows.map((item) => (
              <li
                key={item.district}
                className={item.total === 0 ? "is-empty" : undefined}
                style={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "12px",
                  padding: "10px 12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "7px",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                  }}
                >
                  <span
                    style={{
                      fontWeight: 800,
                      fontSize: "13.5px",
                      color: "#1e293b",
                    }}
                  >
                    {item.district}
                  </span>
                  <strong
                    style={{
                      fontSize: "14px",
                      color: "#b45309",
                      fontWeight: 850,
                    }}
                  >
                    {item.total.toLocaleString("pt-BR")}
                  </strong>
                </div>

                <div
                  className="district-bar"
                  aria-hidden="true"
                  style={{
                    height: "4px",
                    background: "#f1f5f9",
                    borderRadius: "99px",
                    overflow: "hidden",
                  }}
                >
                  <i
                    style={{
                      display: "block",
                      height: "100%",
                      background: "#d97706",
                      width: `${
                        item.total
                          ? Math.max((item.total / maxTotal) * 100, 4)
                          : 0
                      }%`,
                      borderRadius: "99px",
                    }}
                  />
                </div>

                <button
                  type="button"
                  disabled={item.total <= 0}
                  onClick={() => openDistrict(item.district)}
                  title={`Abrir todos os contatos de ${item.district}`}
                  style={{
                    width: "100%",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "5px",
                    padding: "8px 10px",
                    fontSize: "11px",
                    fontWeight: 800,
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    background: item.total > 0 ? "#f8fafc" : "#f1f5f9",
                    color: item.total > 0 ? "#0f172a" : "#94a3b8",
                    cursor: item.total > 0 ? "pointer" : "not-allowed",
                  }}
                >
                  👥 Abrir contatos
                </button>
              </li>
            ))}
          </ol>

          {!visibleRows.length && (
            <p className="optimized-empty">Nenhum bairro disponível.</p>
          )}

          {rows.length > 12 && (
            <button
              className="district-show-more"
              type="button"
              onClick={() => setShowAll((value) => !value)}
            >
              {showAll
                ? "Mostrar menos"
                : `Ver todos (${rows.length.toLocaleString("pt-BR")})`}
            </button>
          )}
        </>
      )}
    </aside>
  );

  return target ? createPortal(<>{mobileSwitch}{panel}</>, target) : null;
}
