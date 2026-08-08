"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "./supabase-client";
import styles from "./contact-district-ranking.module.css";

type DistrictItem = {
  district: string;
  total: number;
};

type SummaryResponse = {
  districts?: DistrictItem[];
  error?: string;
};

function finiteNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
}

export default function ContactDistrictRanking({ scope }: { scope: string }) {
  const [districts, setDistricts] = useState<DistrictItem[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestVersion = useRef(0);

  const load = useCallback(async () => {
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
        .filter((item) => item.district && item.total > 0)
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
          : "Não foi possível carregar os bairros agora.",
      );
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    void load();
    const refresh = () => void load();
    window.addEventListener("voto-forte:records-changed", refresh);
    return () => {
      requestVersion.current += 1;
      window.removeEventListener("voto-forte:records-changed", refresh);
    };
  }, [load]);

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("pt-BR");
    if (!term) return districts;
    return districts.filter((item) =>
      item.district.toLocaleLowerCase("pt-BR").includes(term),
    );
  }, [districts, query]);

  return (
    <section className={styles.panel} aria-busy={loading}>
      <div className={styles.header}>
        <div className={styles.heading}>
          <small>RELAÇÃO DE BAIRROS</small>
          <h2>Bairros por quantidade de cadastros</h2>
          <p>Distribuição descritiva da base, do maior para o menor total.</p>
        </div>
        <span className={styles.count}>
          {districts.length.toLocaleString("pt-BR")} bairros
        </span>
      </div>

      <div className={styles.toolbar}>
        <input
          className={styles.search}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar bairro"
          aria-label="Buscar bairro"
        />
      </div>

      {loading ? (
        <div className={styles.state}>Carregando relação de bairros…</div>
      ) : error ? (
        <div className={styles.state}>{error}</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Posição</th>
                <th>Bairro</th>
                <th>Cadastros</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const position = districts.findIndex(
                  (district) => district.district === item.district,
                ) + 1;
                return (
                  <tr key={item.district}>
                    <td><span className={styles.rank}>{position}</span></td>
                    <td className={styles.district}>{item.district}</td>
                    <td className={styles.total}>{item.total.toLocaleString("pt-BR")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!filtered.length && (
            <div className={styles.state}>Nenhum bairro encontrado.</div>
          )}
        </div>
      )}

      <p className={styles.note}>
        A ordem representa somente a quantidade de cadastros registrada em cada bairro.
      </p>
    </section>
  );
}
