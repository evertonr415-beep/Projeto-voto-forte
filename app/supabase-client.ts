import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;
const inFlightReads = new Map<string, Promise<Response>>();

function getBrowserSupabase() {
  if (browserClient) return browserClient;

  // Keep direct environment accesses so Next.js can inline NEXT_PUBLIC values.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Configuração do Supabase indisponível. Verifique NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }

  browserClient = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return browserClient;
}

// The proxy preserves the existing import contract while avoiding client
// initialization during Next.js prerendering of pages such as /_not-found.
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, property) {
    const client = getBrowserSupabase();
    const value = Reflect.get(client, property);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

function requestMethod(input: RequestInfo | URL, init: RequestInit) {
  return String(init.method || (input instanceof Request ? input.method : "GET"))
    .trim()
    .toUpperCase();
}

function requestUrl(input: RequestInfo | URL) {
  if (input instanceof Request) return input.url;
  return String(input);
}

export async function apiFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
) {
  const { data } = await supabase.auth.getSession();
  const headers = new Headers(input instanceof Request ? input.headers : undefined);
  new Headers(init.headers).forEach((value, key) => headers.set(key, value));
  if (data.session?.access_token) {
    headers.set("authorization", `Bearer ${data.session.access_token}`);
  }

  const method = requestMethod(input, init);
  if (method !== "GET" || init.body) {
    return fetch(input, { ...init, headers });
  }

  // Coalesce only requests that are simultaneously in flight. Nothing is
  // persisted or reused after completion, so authenticated data never becomes
  // stale and cache semantics remain unchanged.
  const dedupeKey = `${requestUrl(input)}\n${headers.get("authorization") || ""}`;
  const existing = inFlightReads.get(dedupeKey);
  if (existing) return (await existing).clone();

  const request = fetch(input, { ...init, headers });
  inFlightReads.set(dedupeKey, request);
  try {
    return (await request).clone();
  } finally {
    inFlightReads.delete(dedupeKey);
  }
}
