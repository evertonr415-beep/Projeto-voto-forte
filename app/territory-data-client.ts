import { apiFetch } from "./supabase-client";

export type SharedTerritoryRecord = {
  id?: number | string;
  ownerEmail?: string;
  kind?: string;
  payload?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
};

export type SharedTerritorySummary = {
  total: number;
  voters: number;
  leaders: number;
  meetings: number;
  districtsReached: number;
  districts: { district: string; total: number }[];
};

export type SharedMappedTerritoryData = {
  records: SharedTerritoryRecord[];
  total: number;
  truncated: boolean;
};

type DashboardRecordsResponse = {
  records?: SharedTerritoryRecord[];
  mappedContactsTotal?: number;
  mappedContactRecords?: number;
  mappedContactsTruncated?: boolean;
};

const MEMORY_CACHE_TTL_MS = 2 * 60_000;
const SESSION_CACHE_TTL_MS = 10 * 60_000;
const MAPPED_SESSION_CACHE_KEY = "vf:territory-mapped-contacts:v6";
const SUMMARY_SESSION_CACHE_KEY = "vf:territory-summary:v5";

let cachedMappedData: SharedMappedTerritoryData | null = null;
let mappedCachedAt = 0;
let pendingMappedRequest: Promise<SharedMappedTerritoryData> | null = null;
let mappedGeneration = 0;
let cachedSummary: SharedTerritorySummary | null = null;
let summaryCachedAt = 0;
let pendingSummaryRequest: Promise<SharedTerritorySummary> | null = null;
let summaryGeneration = 0;
let listenersInstalled = false;

function finiteNumber(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : fallback;
}

function readSessionCache<T>(key: string, now: number): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt?: number; data?: T };
    if (
      !parsed.savedAt ||
      parsed.data === undefined ||
      now - parsed.savedAt >= SESSION_CACHE_TTL_MS
    ) {
      window.sessionStorage.removeItem(key);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

function writeSessionCache<T>(key: string, data: T, savedAt: number) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify({ savedAt, data }));
  } catch {
    // O cache de sessão é opcional; o cache em memória continua disponível.
  }
}

function clearSessionCache() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(MAPPED_SESSION_CACHE_KEY);
    window.sessionStorage.removeItem(SUMMARY_SESSION_CACHE_KEY);
  } catch {
    // Sem impacto funcional caso o navegador bloqueie sessionStorage.
  }
}

export async function loadSharedTerritorySummary(options?: { force?: boolean }) {
  const now = Date.now();
  const force = Boolean(options?.force);

  if (!force && cachedSummary && now - summaryCachedAt < MEMORY_CACHE_TTL_MS) {
    return cachedSummary;
  }

  if (!force) {
    const sessionSummary = readSessionCache<SharedTerritorySummary>(
      SUMMARY_SESSION_CACHE_KEY,
      now,
    );
    if (sessionSummary) {
      cachedSummary = sessionSummary;
      summaryCachedAt = now;
      return sessionSummary;
    }
  }

  if (!force && pendingSummaryRequest) return pendingSummaryRequest;

  const generation = summaryGeneration;
  const request: Promise<SharedTerritorySummary> = apiFetch(
    "/api/contacts?mode=summary&owner=all",
    {
      headers: { accept: "application/json" },
      cache: "no-store",
    },
  )
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Falha ao carregar resumo territorial: ${response.status}`);
      }
      const data = (await response.json()) as Partial<SharedTerritorySummary>;
      const summary: SharedTerritorySummary = {
        total: finiteNumber(data.total),
        voters: finiteNumber(data.voters),
        leaders: finiteNumber(data.leaders),
        meetings: finiteNumber(data.meetings),
        districtsReached: finiteNumber(data.districtsReached),
        districts: Array.isArray(data.districts)
          ? data.districts.map((item) => ({
              district: String(item.district || "").trim(),
              total: finiteNumber(item.total),
            }))
          : [],
      };
      if (generation === summaryGeneration) {
        cachedSummary = summary;
        summaryCachedAt = Date.now();
        writeSessionCache(SUMMARY_SESSION_CACHE_KEY, summary, summaryCachedAt);
      }
      return summary;
    })
    .finally(() => {
      if (pendingSummaryRequest === request) pendingSummaryRequest = null;
    });

  pendingSummaryRequest = request;
  return request;
}

export async function loadSharedMappedTerritoryData(options?: {
  force?: boolean;
}) {
  const now = Date.now();
  const force = Boolean(options?.force);

  if (
    !force &&
    cachedMappedData &&
    now - mappedCachedAt < MEMORY_CACHE_TTL_MS
  ) {
    return cachedMappedData;
  }

  if (!force) {
    const sessionData = readSessionCache<SharedMappedTerritoryData>(
      MAPPED_SESSION_CACHE_KEY,
      now,
    );
    if (sessionData) {
      cachedMappedData = sessionData;
      mappedCachedAt = now;
      return sessionData;
    }
  }

  if (!force && pendingMappedRequest) return pendingMappedRequest;

  const generation = mappedGeneration;
  const request: Promise<SharedMappedTerritoryData> = apiFetch(
    "/api/records?owner=all&mode=dashboard",
    {
      headers: { accept: "application/json" },
      cache: "no-store",
    },
  )
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Falha ao carregar pontos do mapa: ${response.status}`);
      }
      const data = (await response.json()) as DashboardRecordsResponse;
      const records = (data.records || []).filter(
        (record) => record.kind === "contact",
      );
      const reportedTotal = finiteNumber(data.mappedContactsTotal, records.length);
      const total = Math.max(records.length, reportedTotal);
      const mappedData: SharedMappedTerritoryData = {
        records,
        total,
        truncated: Boolean(data.mappedContactsTruncated) || total > records.length,
      };
      if (generation === mappedGeneration) {
        cachedMappedData = mappedData;
        mappedCachedAt = Date.now();
        writeSessionCache(MAPPED_SESSION_CACHE_KEY, mappedData, mappedCachedAt);
      }
      return mappedData;
    })
    .finally(() => {
      if (pendingMappedRequest === request) pendingMappedRequest = null;
    });

  pendingMappedRequest = request;
  return request;
}

export async function loadSharedMappedTerritoryContacts(options?: {
  force?: boolean;
}) {
  return (await loadSharedMappedTerritoryData(options)).records;
}

export function invalidateSharedTerritoryData() {
  mappedGeneration += 1;
  summaryGeneration += 1;
  cachedMappedData = null;
  mappedCachedAt = 0;
  pendingMappedRequest = null;
  cachedSummary = null;
  summaryCachedAt = 0;
  pendingSummaryRequest = null;
  clearSessionCache();
}

// Compatibilidade temporária para módulos ainda em migração. Esta função agora
// representa somente contatos com coordenadas, nunca a base completa.
export const loadSharedTerritoryContacts = loadSharedMappedTerritoryContacts;
export const invalidateSharedTerritoryContacts = invalidateSharedTerritoryData;

function installInvalidationListeners() {
  if (typeof window === "undefined" || listenersInstalled) return;
  listenersInstalled = true;
  const invalidate = () => invalidateSharedTerritoryData();
  window.addEventListener("voto-forte:records-changed", invalidate);
  window.addEventListener("voto-forte:geocoding-complete", invalidate);
}

installInvalidationListeners();
