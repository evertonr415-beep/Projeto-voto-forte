import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;
let browserAuthProxy: SupabaseClient["auth"] | null = null;
let sessionReadInFlight: ReturnType<SupabaseClient["auth"]["getSession"]> | null = null;
const inFlightReads = new Map<string, Promise<Response>>();

function getBrowserSupabase() {
  if (browserClient) return browserClient;

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

function getBrowserAuth() {
  const client = getBrowserSupabase();
  if (browserAuthProxy) return browserAuthProxy;

  const auth = client.auth;
  browserAuthProxy = new Proxy(auth, {
    get(target, property) {
      if (property === "onAuthStateChange") {
        return (callback: Parameters<typeof auth.onAuthStateChange>[0]) =>
          auth.onAuthStateChange((event, session) => {
            if (event === "TOKEN_REFRESHED") return;
            callback(event, session);
          });
      }

      const value = Reflect.get(target, property);
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as SupabaseClient["auth"];

  return browserAuthProxy;
}

async function getCoalescedSession() {
  if (sessionReadInFlight) return sessionReadInFlight;

  const auth = getBrowserSupabase().auth;
  const read = auth.getSession();
  sessionReadInFlight = read;
  try {
    return await read;
  } finally {
    if (sessionReadInFlight === read) sessionReadInFlight = null;
  }
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, property) {
    const client = getBrowserSupabase();
    if (property === "auth") return getBrowserAuth();
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
  const { data } = await getCoalescedSession();
  const headers = new Headers(input instanceof Request ? input.headers : undefined);
  new Headers(init.headers).forEach((value, key) => headers.set(key, value));
  if (data.session?.access_token) {
    headers.set("authorization", `Bearer ${data.session.access_token}`);
  }

  const method = requestMethod(input, init);
  if (method !== "GET" || init.body) {
    return fetch(input, { ...init, headers });
  }

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
