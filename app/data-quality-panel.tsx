"use client";

import { useEffect, useMemo, useState } from "react";
import { normalizeTerritoryText } from "./territory-statistics";

type RecordPayload = {
  name?: string;
  phone?: string;
  email?: string;
  cep?: string;
  street?: string;
  address?: string;
  number?: string;
  district?: string;
  city?: string;
  municipality?: string;
  latitude?: number | string;
  longitude?: number | string;
};

type ContactRecord = {
  id?: string;
  kind?: string;
  payload?: RecordPayload;
};

type IssueType =
  | "complete"
  | "unmapped"
  | "incomplete"
  | "duplicate"
  | "district-variant";

type QualityIssue = {
  id: string;
  title: string;
  description: string;
  district?: string;
  type: IssueType;
};

const labels: Record<IssueType, string> = {
  complete: "Completos",
  unmapped: "Sem geolocalização",
  incomplete: "Endereço incompleto",
  duplicate: "Possíveis duplicados",
  "district-variant": "Grafias de bairro",
};

function hasValidCoordinates(record: ContactRecord) {
  const latitude = Number(record.payload?.latitude);
  const longitude = Number(record.payload?.longitude);
  return Number.isFinite(latitude) && Number.isFinite(longitude);
}

function getAddress(record: ContactRecord) {
  return String(record.payload?.street || record.payload?.address || "").trim();
}

function getCity(record: ContactRecord) {
  return String(record.payload?.city || record.payload?.municipality || "").trim();
}

function isComplete(record: ContactRecord) {
  return Boolean(
    String(record.payload?.name || "").trim() &&
      String(record.payload?.cep || "").replace(/\D/g, "").length === 8 &&
      getAddress(record) &&
      String(record.payload?.number || "").trim() &&
      String(record.payload?.district || "").trim() &&
      getCity(record) &&
      hasValidCoordinates(record),
  );
}

function duplicateKey(record: ContactRecord) {
  const name = normalizeTerritoryText(record.payload?.name);
  const phone = String(record.payload?.phone || "").replace(/\D/g, "");
  const email = normalizeTerritoryText(record.payload?.email);
  const address = normalizeTerritoryText(
    `${getAddress(record)} ${record.payload?.number || ""}`,
  );
  return [name, phone || email, address].filter(Boolean).join("|");
}

function districtFamily(value: string) {
  return normalizeTerritoryText(value)
    .replace(/\bJD\b/g, "JARDIM")
    .replace(/\bVL\b/g, "VILA")
    .replace(/\bRES\b/g, "RESIDENCIAL")
    .replace(/\bPQ\b/g, "PARQUE")
    .replace(/\bCONJ\b/g, "CONJUNTO")
    .replace(/\s+/g, " ")
    .trim();
}

export default function DataQualityPanel() {
  const [records, setRecords] = useState<ContactRecord[]>([]);
  const [visible, setVisible] = useState(false);
  const [active, setActive] = useState<IssueType>("incomplete");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/location-issues?owner=all&page=1", {
          headers: { accept: "application/json" },
          cache: "no-store",
        });
        if (!response.ok) return;
        const data = (await response.json()) as { issues?: any[] };
        if (!cancelled && Array.isArray(data.issues)) {
          setRecords(data.issues.map((i: any) => ({
            id: String(i.record_id),
            kind: "contact",
            payload: {
              name: i.contact_name,
              phone: i.phone,
              street: i.street,
              number: i.street_number,
              district: i.district_original,
              city: i.city,
              cep: i.cep,
            },
          })));
        }
      } catch {
        // O restante do sistema permanece disponível.
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const handleToggle = (event: Event) => {
      const open = Boolean(
        (event as CustomEvent<{ open?: boolean }>).detail?.open,
      );
      setVisible(open);
      if (open) void load();
    };

    window.addEventListener("voto-forte:data-quality-toggle", handleToggle);
    return () => {
      cancelled = true;
      window.removeEventListener("voto-forte:data-quality-toggle", handleToggle);
    };
  }, []);

  const issues = useMemo(() => {
    const result: Record<IssueType, QualityIssue[]> = {
      complete: [],
      unmapped: [],
      incomplete: [],
      duplicate: [],
      "district-variant": [],
    };

    const duplicateGroups = new Map<string, ContactRecord[]>();
    const districtGroups = new Map<string, Set<string>>();

    for (const record of records) {
      const name = String(record.payload?.name || "Cadastro sem nome").trim();
      const district = String(record.payload?.district || "").trim();
      const id = String(record.id || `${name}-${Math.random()}`);

      if (isComplete(record)) {
        result.complete.push({
          id,
          title: name,
          description: "Cadastro completo e georreferenciado.",
          district,
          type: "complete",
        });
      }

      if (!hasValidCoordinates(record)) {
        result.unmapped.push({
          id,
          title: name,
          description: "O cadastro ainda não possui coordenadas válidas.",
          district,
          type: "unmapped",
        });
      }

      const missing: string[] = [];
      if (!String(record.payload?.cep || "").trim()) missing.push("CEP");
      if (!getAddress(record)) missing.push("rua");
      if (!String(record.payload?.number || "").trim()) missing.push("número");
      if (!district) missing.push("bairro");
      if (!getCity(record)) missing.push("município");

      if (missing.length) {
        result.incomplete.push({
          id,
          title: name,
          description: `Faltam: ${missing.join(", ")}.`,
          district,
          type: "incomplete",
        });
      }

      const key = duplicateKey(record);
      if (key) {
        const group = duplicateGroups.get(key) || [];
        group.push(record);
        duplicateGroups.set(key, group);
      }

      if (district) {
        const family = districtFamily(district);
        const variants = districtGroups.get(family) || new Set<string>();
        variants.add(district);
        districtGroups.set(family, variants);
      }
    }

    for (const [key, group] of duplicateGroups) {
      if (group.length < 2) continue;
      result.duplicate.push({
        id: `duplicate-${key}`,
        title: `${group.length} cadastros semelhantes`,
        description: group
          .map((record) => String(record.payload?.name || "Sem nome"))
          .join(" · "),
        district: String(group[0]?.payload?.district || ""),
        type: "duplicate",
      });
    }

    for (const [family, variants] of districtGroups) {
      if (variants.size < 2) continue;
      result["district-variant"].push({
        id: `district-${family}`,
        title: Array.from(variants).join(" / "),
        description: "Possíveis grafias diferentes para o mesmo bairro.",
        district: Array.from(variants)[0],
        type: "district-variant",
      });
    }

    return result;
  }, [records]);

  if (!visible) return null;

  const close = () => {
    setVisible(false);
    window.dispatchEvent(
      new CustomEvent("voto-forte:data-quality-toggle", {
        detail: { open: false },
      }),
    );
  };

  const selectDistrict = (district?: string) => {
    if (!district) return;
    window.dispatchEvent(
      new CustomEvent("voto-forte:district-selected", {
        detail: { district },
      }),
    );
    window.dispatchEvent(
      new CustomEvent("voto-forte:district-filter-change", {
        detail: { district },
      }),
    );
  };

  return (
    <aside className="vf-data-quality-panel" aria-label="Qualidade dos dados">
      <header>
        <div>
          <small>SAÚDE DA BASE</small>
          <strong>Qualidade dos dados</strong>
          <p>Identificação automática de inconsistências nos cadastros.</p>
        </div>
        <button type="button" onClick={close}>Fechar</button>
      </header>

      <nav aria-label="Categorias de qualidade">
        {(Object.keys(labels) as IssueType[]).map((type) => (
          <button
            type="button"
            key={type}
            className={active === type ? "active" : ""}
            onClick={() => setActive(type)}
          >
            <span>{labels[type]}</span>
            <b>{issues[type].length}</b>
          </button>
        ))}
      </nav>

      {loading ? (
        <div className="vf-data-quality-loading">Analisando cadastros...</div>
      ) : (
        <div className="vf-data-quality-list">
          {issues[active].length ? (
            issues[active].map((issue) => (
              <button
                type="button"
                key={issue.id}
                className={`vf-quality-${issue.type}`}
                onClick={() => selectDistrict(issue.district)}
              >
                <div>
                  <strong>{issue.title}</strong>
                  <small>{issue.description}</small>
                </div>
                {issue.district && <span>{issue.district}</span>}
              </button>
            ))
          ) : (
            <p>Nenhum registro encontrado nesta categoria.</p>
          )}
        </div>
      )}
    </aside>
  );
}
