import { apiFetch } from "./supabase-client";

const SUMMARY_TTL_MS = 30_000;

type SummaryPayload = Record<string, unknown>;

type SummaryEntry = {
  data?: SummaryPayload;
  expiresAt: number;
  promise?: Promise<SummaryPayload>;
};

const cache = new Map<string, SummaryEntry>();

function normalizeOwner(owner: string) {
  return String(owner || "").trim().toLowerCase();
}

export async function loadContactSummary(owner: string, options?: { force?: boolean }) {
  const key = normalizeOwner(owner);
  const now = Date.now();
  const current = cache.get(key);

  if (!options?.force && current?.data && current.expiresAt > now) {
    return current.data;
  }

  if (!options?.force && current?.promise) return current.promise;

  const promise = apiFetch(
    `/api/contacts?mode=summary&owner=${encodeURIComponent(key)}`,
    { cache: "no-store" },
  )
    .then(async (response) => {
      const data = (await response.json().catch(() => ({}))) as SummaryPayload & {
        error?: string;
      };
      if (!response.ok) throw new Error(String(data.error || "Falha ao carregar resumo"));
      cache.set(key, {
        data,
        expiresAt: Date.now() + SUMMARY_TTL_MS,
      });
      return data;
    })
    .catch((error) => {
      const latest = cache.get(key);
      if (latest?.promise === promise) cache.delete(key);
      throw error;
    });

  cache.set(key, {
    data: current?.data,
    expiresAt: current?.expiresAt ?? 0,
    promise,
  });

  return promise;
}

export function prefetchContactSummary(owner: string) {
  void loadContactSummary(owner).catch(() => undefined);
}

export function invalidateContactSummary(owner?: string) {
  if (owner) cache.delete(normalizeOwner(owner));
  else cache.clear();
}
