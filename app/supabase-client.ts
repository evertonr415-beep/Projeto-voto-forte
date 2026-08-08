import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

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

function optimizeLegacyDashboardRead(
  input: RequestInfo | URL,
  init: RequestInit,
): RequestInfo | URL {
  if (typeof window === "undefined") return input;

  const method = String(
    init.method ?? (input instanceof Request ? input.method : "GET"),
  ).toUpperCase();
  if (method !== "GET") return input;

  // A Request carrega headers, body, credentials e signal próprios. Não o
  // substituímos por URL; a otimização só vale para chamadas simples.
  let rawUrl = "";
  if (typeof input === "string") rawUrl = input;
  else if (input instanceof URL) rawUrl = input.toString();
  else return input;
  if (!rawUrl) return input;

  const currentPath = window.location.pathname;
  if (
    currentPath !== "/" &&
    !currentPath.startsWith("/sistema-completo")
  ) {
    return input;
  }

  const requestUrl = new URL(rawUrl, window.location.origin);
  if (
    requestUrl.origin !== window.location.origin ||
    requestUrl.pathname !== "/api/records" ||
    requestUrl.searchParams.has("kind") ||
    requestUrl.searchParams.has("mode")
  ) {
    return input;
  }

  requestUrl.searchParams.set("mode", "dashboard");
  return requestUrl;
}

export async function apiFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
) {
  const { data } = await supabase.auth.getSession();
  const headers = new Headers(init.headers);
  if (data.session?.access_token) {
    headers.set("authorization", `Bearer ${data.session.access_token}`);
  }
  return fetch(optimizeLegacyDashboardRead(input, init), { ...init, headers });
}
