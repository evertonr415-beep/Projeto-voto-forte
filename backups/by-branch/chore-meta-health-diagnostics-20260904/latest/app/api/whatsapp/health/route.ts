import { getWhatsappAdminClient, isWhatsappEventStorageConfigured } from "../admin";

export async function GET() {
  const storageConfigured = isWhatsappEventStorageConfigured();
  const metaAppSecretConfigured = Boolean(process.env.META_APP_SECRET?.trim());
  const verifyTokenConfigured = Boolean(process.env.META_WHATSAPP_VERIFY_TOKEN?.trim());

  if (!storageConfigured) {
    return Response.json(
      {
        success: false,
        storageConfigured: false,
        databaseReachable: false,
        metaAppSecretConfigured,
        verifyTokenConfigured,
      },
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

    const success = metaAppSecretConfigured && verifyTokenConfigured;
    return Response.json(
      {
        success,
        storageConfigured: true,
        databaseReachable: true,
        metaAppSecretConfigured,
        verifyTokenConfigured,
      },
      {
        status: success ? 200 : 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch {
    return Response.json(
      {
        success: false,
        storageConfigured: true,
        databaseReachable: false,
        metaAppSecretConfigured,
        verifyTokenConfigured,
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
