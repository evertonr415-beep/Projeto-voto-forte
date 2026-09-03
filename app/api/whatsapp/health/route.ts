import { getWhatsappAdminClient, isWhatsappEventStorageConfigured } from "../admin";

export async function GET() {
  const configured = isWhatsappEventStorageConfigured();
  if (!configured) {
    return Response.json(
      { success: false, storageConfigured: false, databaseReachable: false },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const supabase = getWhatsappAdminClient();
    if (!supabase) throw new Error("Admin client unavailable");

    const { error } = await supabase
      .from("vf_whatsapp_events")
      .select("id")
      .limit(1);

    if (error) throw error;

    return Response.json(
      { success: true, storageConfigured: true, databaseReachable: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { success: false, storageConfigured: true, databaseReachable: false },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
