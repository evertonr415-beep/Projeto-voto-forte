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

const CACHE_TTL_MS = 30_000;

let cachedRecords: SharedTerritoryRecord[] | null = null;
let cachedAt = 0;
let pendingRequest: Promise<SharedTerritoryRecord[]> | null = null;

export async function loadSharedTerritoryContacts(options?: {
  force?: boolean;
}) {
  const now = Date.now();
  const force = Boolean(options?.force);

  if (!force && cachedRecords && now - cachedAt < CACHE_TTL_MS) {
    return cachedRecords;
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
}

if (typeof window !== "undefined") {
  const invalidate = () => invalidateSharedTerritoryContacts();
  window.addEventListener("voto-forte:records-changed", invalidate);
}
