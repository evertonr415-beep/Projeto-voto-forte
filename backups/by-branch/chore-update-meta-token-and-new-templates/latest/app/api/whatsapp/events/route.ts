import { getAccount } from "../../../server-identity";
import { getWhatsappAdminClient, isWhatsappEventStorageConfigured } from "../admin";

export async function GET(request: Request) {
  const account = await getAccount();
  if (!account) return Response.json({ error: "Não autenticado" }, { status: 401 });
  if (!["adm", "gestor"].includes(account.accessRole)) {
    return Response.json({ error: "Acesso não autorizado." }, { status: 403 });
  }

  if (!isWhatsappEventStorageConfigured()) {
    return Response.json(
      { success: false, configured: false, events: [], error: "Armazenamento de eventos ainda não configurado no servidor." },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const messageId = url.searchParams.get("messageId")?.trim() || "";
  const phone = url.searchParams.get("phone")?.replace(/\D/g, "") || "";
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") || 50)));

  const supabase = getWhatsappAdminClient();
  if (!supabase) {
    return Response.json({ success: false, configured: false, events: [] }, { status: 503 });
  }

  let query = supabase
    .from("vf_whatsapp_events")
    .select("id,message_id,direction,event_type,status,phone,contact_name,message_type,message_text,error_code,error_message,occurred_at,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (messageId) query = query.eq("message_id", messageId);
  if (phone) query = query.eq("phone", phone);

  const { data, error } = await query;
  if (error) {
    return Response.json({ success: false, configured: true, error: error.message }, { status: 500 });
  }

  return Response.json({ success: true, configured: true, events: data || [] });
}
