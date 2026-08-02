import { createClient } from "@supabase/supabase-js";
import { headers } from "next/headers";

export async function getServerSupabase() {
  const authorization = (await headers()).get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://dtcvudwmosxhbgpwphsx.supabase.co";
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_tXsklaQ9alfe6IfcYd-RhA_NBxIWA15";
  if (!token || !url || !key) return null;
  return createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
