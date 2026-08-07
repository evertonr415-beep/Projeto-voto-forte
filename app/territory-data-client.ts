export type SharedTerritoryRecord = {
  id?: number | string;
  ownerEmail?: string;
  kind?: string;
  payload?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
};

type RecordsResponse = {
  records?: SharedTerritoryRecord[];
};

const MEMORY_CACHE_TTL_MS = 2 * 60_000;
const SESSION_CACHE_TTL_MS = 10 * 60_000;
const SESSION_CACHE_KEY = "vf:territory-contacts:v2";

let cachedRecords: SharedTerritoryRecord[] | null = null;
let cachedAt = 0;
let pendingRequest: Promise<SharedTerritoryRecord[]> | null = null;
let listenersInstalled = false;

function readSessionCache(now: number) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      savedAt?: number;
      records?: SharedTerritoryRecord[];
    };
    if (
      !parsed.savedAt ||
      !Array.isArray(parsed.records) ||
      now - parsed.savedAt >= SESSION_CACHE_TTL_MS
    ) {
      window.sessionStorage.removeItem(SESSION_CACHE_KEY);
      return null;
    }
    cachedRecords = parsed.records;
    cachedAt = parsed.savedAt;
    return cachedRecords;
  } catch {
    return null;
  }
}

function writeSessionCache(records: SharedTerritoryRecord[], savedAt: number) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      SESSION_CACHE_KEY,
      JSON.stringify({ savedAt, records }),
    );
  } catch {
    // Cache persistente e opcional; memória continua disponível.
  }
}

function clearSessionCache() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(SESSION_CACHE_KEY);
  } catch {
    // Sem impacto funcional caso o navegador bloqueie sessionStorage.
  }
}

export async function loadSharedTerritoryContacts(options?: {
  force?: boolean;
}) {
  const now = Date.now();
  const force = Boolean(options?.force);

  if (!force && cachedRecords && now - cachedAt < MEMORY_CACHE_TTL_MS) {
    return cachedRecords;
  }

  if (!force) {
    const sessionRecords = readSessionCache(now);
    if (sessionRecords) return sessionRecords;
  }

  if (!force && pendingRequest) return pendingRequest;

  pendingRequest = fetch("/api/records?owner=all&kind=contact", {
    headers: { accept: "application/json" },
    cache: "no-store",
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Falha ao carregar contatos: ${response.status}`);
      }
      const data = (await response.json()) as RecordsResponse;
      cachedRecords = data.records || [];
      cachedAt = Date.now();
      writeSessionCache(cachedRecords, cachedAt);
      return cachedRecords;
    })
    .finally(() => {
      pendingRequest = null;
    });

  return pendingRequest;
}

export function invalidateSharedTerritoryContacts() {
  cachedRecords = null;
  cachedAt = 0;
  pendingRequest = null;
  clearSessionCache();
}

function installInvalidationListeners() {
  if (typeof window === "undefined" || listenersInstalled) return;
  listenersInstalled = true;
  const invalidate = () => invalidateSharedTerritoryContacts();
  window.addEventListener("voto-forte:records-changed", invalidate);
  window.addEventListener("voto-forte:geocoding-complete", invalidate);
}

installInvalidationListeners();
