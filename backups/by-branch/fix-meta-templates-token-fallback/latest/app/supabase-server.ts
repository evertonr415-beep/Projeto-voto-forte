import { createClient } from "@supabase/supabase-js";
import { headers } from "next/headers";

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Variável de ambiente ausente: ${name}`);
  return value;
}

export async function getServerSupabase() {
  const authorization = (await headers()).get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const url = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = requiredEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  if (!token) return null;
  return createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function getAutonomousSupabase() {
  const url = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = requiredEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  const key = serviceKey || anonKey;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

