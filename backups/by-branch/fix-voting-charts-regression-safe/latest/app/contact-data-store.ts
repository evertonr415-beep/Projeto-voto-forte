export type SharedContactRecord = {
  id?: string | number;
  ownerEmail?: string;
  kind?: string;
  payload?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
};

type ContactDataState = {
  records: SharedContactRecord[];
  loading: boolean;
  error: string | null;
  updatedAt: number;
};

type Listener = (state: ContactDataState) => void;

const CACHE_TTL = 30_000;
const listeners = new Set<Listener>();

let state: ContactDataState = {
  records: [],
  loading: false,
  error: null,
  updatedAt: 0,
};

let pendingRequest: Promise<SharedContactRecord[]> | null = null;

function emit() {
  listeners.forEach((listener) => listener(state));
}

export function getContactDataState() {
  return state;
}

export function subscribeToContactData(listener: Listener) {
  listeners.add(listener);
  listener(state);
  return () => listeners.delete(listener);
}

export function invalidateContactData() {
  state = { ...state, updatedAt: 0 };
  emit();
}

export async function loadSharedContacts(options?: { force?: boolean }) {
  const force = Boolean(options?.force);
  const cacheIsFresh =
    state.records.length > 0 && Date.now() - state.updatedAt < CACHE_TTL;

  if (!force && cacheIsFresh) return state.records;
  if (pendingRequest) return pendingRequest;

  state = { ...state, loading: true, error: null };
  emit();

  pendingRequest = fetch("/api/records?owner=all&kind=contact", {
    headers: { accept: "application/json" },
    cache: "no-store",
  })
    .then(async (response) => {
      const data = (await response.json().catch(() => null)) as
        | { records?: SharedContactRecord[]; error?: string }
        | null;

      if (!response.ok) {
        throw new Error(data?.error || "Não foi possível carregar os contatos.");
      }

      const records = data?.records || [];
      state = {
        records,
        loading: false,
        error: null,
        updatedAt: Date.now(),
      };
      emit();
      return records;
    })
    .catch((error: unknown) => {
      state = {
        ...state,
        loading: false,
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível carregar os contatos.",
      };
      emit();
      throw error;
    })
    .finally(() => {
      pendingRequest = null;
    });

  return pendingRequest;
}

if (typeof window !== "undefined") {
  window.addEventListener("voto-forte:records-changed", () => {
    invalidateContactData();
    void loadSharedContacts({ force: true }).catch(() => undefined);
  });
}
