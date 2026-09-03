import { createClient } from "@supabase/supabase-js";

export type WhatsappEventInsert = {
  message_id?: string | null;
  direction: "outbound" | "inbound" | "status" | "system";
  event_type: string;
  status?: string | null;
  phone?: string | null;
  contact_name?: string | null;
  message_type?: string | null;
  message_text?: string | null;
  error_code?: string | null;
  error_message?: string | null;
  occurred_at?: string | null;
  payload?: Record<string, unknown>;
};

function getAdminConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
  const key =
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    "";
  return { url, key };
}

export function isWhatsappEventStorageConfigured() {
  const { url, key } = getAdminConfig();
  return Boolean(url && key);
}

export function getWhatsappAdminClient() {
  const { url, key } = getAdminConfig();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function recordWhatsappEvents(events: WhatsappEventInsert[]) {
  if (!events.length) return { stored: 0, configured: isWhatsappEventStorageConfigured() };
  const supabase = getWhatsappAdminClient();
  if (!supabase) return { stored: 0, configured: false };

  const { error } = await supabase.from("vf_whatsapp_events").insert(events);
  if (error) throw error;
  return { stored: events.length, configured: true };
}

export async function recordWhatsappEvent(event: WhatsappEventInsert) {
  return recordWhatsappEvents([event]);
}
