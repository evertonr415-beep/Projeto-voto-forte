import { getAccount } from "../../../server-identity";
import { getAutonomousSupabase } from "../../../supabase-server";
import {
  sendBackupToGoogleDrive,
  testGoogleDriveConnection,
} from "../google-drive-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const account = await getAccount();
  if (!account || (account.accessRole !== "adm" && account.accessRole !== "master")) {
    return Response.json({ error: "Acesso exclusivo de administradores" }, { status: 403 });
  }

  const isConfigured = Boolean(
    process.env.GOOGLE_DRIVE_WEBHOOK_URL ||
    process.env.GDRIVE_BACKUP_WEBHOOK_URL
  );

  return Response.json({
    status: isConfigured ? "configured" : "pending_configuration",
    isConfigured,
    provider: "Google Drive Automático",
    schedule: "Diariamente às 02:30 AM (Ininterrupto)",
    lastSync: new Date().toISOString(),
    instructions: {
      step1: "Crie um Google Apps Script na sua conta Google vinculada à pasta criada.",
      step2: "Cole o código receptor disponível em scripts/google-drive-webhook-receiver.js.",
      step3: "Implante como Aplicativo Web (Qualquer pessoa pode acessar).",
      step4: "Cole a URL gerada no painel ou defina GOOGLE_DRIVE_WEBHOOK_URL no .env.",
    },
  });
}

export async function POST(request: Request) {
  const account = await getAccount();
  if (!account || (account.accessRole !== "adm" && account.accessRole !== "master")) {
    return Response.json({ error: "Acesso exclusivo de administradores" }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { action, webhookUrl } = body;

    // 1. Testar Conexão
    if (action === "test_connection") {
      const testResult = await testGoogleDriveConnection(webhookUrl);
      return Response.json(testResult);
    }

    // 2. Sincronizar Agora com Google Drive
    if (action === "sync_now") {
      const supabase = account.supabase || getAutonomousSupabase();
      const timestamp = new Date().toISOString();
      const dateStr = timestamp.slice(0, 10);
      const timeStr = timestamp.slice(11, 16).replace(":", "h");

      // Buscar todos os contatos e tabelas do sistema
      const [contactsRes, usersRes, auditRes, exportsRes] = await Promise.all([
        supabase.from("vf_contacts").select("*").limit(30000),
        supabase.from("vf_users").select("id,email,name,role,status,parent_user_id,created_at"),
        supabase.from("vf_audit_logs").select("*").order("created_at", { ascending: false }).limit(500),
        supabase.from("vf_contact_exports").select("*").order("created_at", { ascending: false }).limit(200),
      ]);

      const totalContacts = contactsRes.data?.length || 0;
      const totalUsers = usersRes.data?.length || 0;

      const backupPackage = {
        format: "voto-forte-automated-google-drive-backup",
        version: "2.5",
        generator: "VOTO FORTE PARANÁ Neural Auto-Sync",
        createdAt: timestamp,
        targetDate: dateStr,
        triggeredBy: account.email,
        stats: {
          totalContacts,
          totalUsers,
          totalAuditLogs: auditRes.data?.length || 0,
          totalExports: exportsRes.data?.length || 0,
        },
        data: {
          contacts: contactsRes.data || [],
          users: usersRes.data || [],
          auditLogs: auditRes.data || [],
          contactExports: exportsRes.data || [],
        },
      };

      // Disparar envio para Google Drive
      const filename = `VotoForte-Backup-${dateStr}-${timeStr}.json`;
      const driveResult = await sendBackupToGoogleDrive(backupPackage, {
        filename,
        webhookUrl,
      });

      // Registrar auditoria
      await supabase.from("vf_audit_logs").insert({
        actor_id: account.auth_user_id,
        actor_email: account.email,
        action: "Sincronização Google Drive",
        detail: driveResult.success
          ? `Backup automático (${filename}) enviado com sucesso para a pasta do Google Drive.`
          : `Tentativa de envio para o Google Drive: ${driveResult.message}`,
      });

      return Response.json({
        success: driveResult.success,
        message: driveResult.message,
        filename,
        timestamp,
        stats: backupPackage.stats,
        details: driveResult,
      });
    }

    return Response.json({ error: "Ação não reconhecida" }, { status: 400 });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Erro ao processar sincronização com Google Drive",
      },
      { status: 500 }
    );
  }
}
