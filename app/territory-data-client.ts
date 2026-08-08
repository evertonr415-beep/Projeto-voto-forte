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

type DashboardRecordsResponse = {
  records?: SharedTerritoryRecord[];
  mappedContacts?: number;
  mappedContactsTruncated?: boolean;
};

const MEMORY_CACHE_TTL_MS = 2 * 60_000;
const SESSION_CACHE_TTL_MS = 10 * 60_000;
const MAPPED_SESSION_CACHE_KEY = "vf:territory-mapped-contacts:v3";
const SUMMARY_SESSION_CACHE_KEY = "vf:territory-summary:v3";

let cachedMappedRecords: SharedTerritoryRecord[] | null = null;
let mappedCachedAt = 0;
let pendingMappedRequest: Promise<SharedTerritoryRecord[]> | null = null;
let cachedSummary: SharedTerritorySummary | null = null;
let summaryCachedAt = 0;
let pendingSummaryRequest: Promise<SharedTerritorySummary> | null = null;
let listenersInstalled = false;

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

  pendingSummaryRequest = fetch("/api/contacts?mode=summary&owner=all", {
    headers: { accept: "application/json" },
    cache: "no-store",
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Falha ao carregar resumo territorial: ${response.status}`);
      }
      const data = (await response.json()) as Partial<SharedTerritorySummary>;
      const summary: SharedTerritorySummary = {
        total: Number(data.total ?? 0),
        voters: Number(data.voters ?? 0),
        leaders: Number(data.leaders ?? 0),
        meetings: Number(data.meetings ?? 0),
        districtsReached: Number(data.districtsReached ?? 0),
        districts: Array.isArray(data.districts)
          ? data.districts.map((item) => ({
              district: String(item.district || "").trim(),
              total: Number(item.total ?? 0),
            }))
          : [],
      };
      cachedSummary = summary;
      summaryCachedAt = Date.now();
      writeSessionCache(SUMMARY_SESSION_CACHE_KEY, summary, summaryCachedAt);
      return summary;
    })
    .finally(() => {
      pendingSummaryRequest = null;
    });

  return pendingSummaryRequest;
}

export async function loadSharedMappedTerritoryContacts(options?: {
  force?: boolean;
}) {
  const now = Date.now();
  const force = Boolean(options?.force);

  if (
    !force &&
    cachedMappedRecords &&
    now - mappedCachedAt < MEMORY_CACHE_TTL_MS
  ) {
    return cachedMappedRecords;
  }

  if (!force) {
    const sessionRecords = readSessionCache<SharedTerritoryRecord[]>(
      MAPPED_SESSION_CACHE_KEY,
      now,
    );
    if (sessionRecords) {
      cachedMappedRecords = sessionRecords;
      mappedCachedAt = now;
      return sessionRecords;
    }
  }

  if (!force && pendingMappedRequest) return pendingMappedRequest;

  pendingMappedRequest = fetch("/api/records?owner=all&mode=dashboard", {
    headers: { accept: "application/json" },
    cache: "no-store",
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Falha ao carregar pontos do mapa: ${response.status}`);
      }
      const data = (await response.json()) as DashboardRecordsResponse;
      cachedMappedRecords = (data.records || []).filter(
        (record) => record.kind === "contact",
      );
      mappedCachedAt = Date.now();
      writeSessionCache(
        MAPPED_SESSION_CACHE_KEY,
        cachedMappedRecords,
        mappedCachedAt,
      );
      return cachedMappedRecords;
    })
    .finally(() => {
      pendingMappedRequest = null;
    });

  return pendingMappedRequest;
}

export function invalidateSharedTerritoryData() {
  cachedMappedRecords = null;
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
