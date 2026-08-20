import { getAccount, isAdminEmail } from "../../server-identity";

export const dynamic = "force-dynamic";

export async function GET() {
  const account = await getAccount();
  if (
    !account ||
    (account.accessRole !== "adm" &&
      account.accessRole !== "master" &&
      !isAdminEmail(account.email))
  ) {
    return Response.json(
      { error: "Acesso exclusivo dos usuários Master do sistema." },
      { status: 403 },
    );
  }

  try {
    const timestamp = new Date().toISOString();
    const dateStr = timestamp.slice(0, 10);
    const timeStr = timestamp.slice(11, 16).replace(":", "");

    // 1. Fetch all system tables safely
    const [
      contactsRes,
      usersRes,
      auditRes,
      exportsRes,
      backupsRes,
    ] = await Promise.all([
      account.supabase.from("vf_contacts").select("*").limit(20000),
      account.supabase.from("vf_users").select("id,email,name,role,status,parent_user_id,created_at"),
      account.supabase.from("vf_audit_logs").select("*").order("created_at", { ascending: false }).limit(500),
      account.supabase.from("vf_contact_exports").select("*").order("created_at", { ascending: false }).limit(200),
      account.supabase.from("vf_backup_snapshots").select("id,created_at,created_by,backup_version,checksum,item_count").limit(50),
    ]);

    // 2. System Architecture & Components Manifest
    const systemManifest = {
      platform: "VOTO FORTE PARANÁ",
      version: "2.5.0-PRO",
      generatedAt: timestamp,
      generatedBy: account.email,
      environment: "production",
      modules: [
        { name: "Dashboard Principal", route: "/sistema-completo" },
        { name: "Painel de Contatos", route: "/contatos" },
        { name: "Mapa Eleitoral", route: "/mapa" },
        { name: "Painel Eleitoral Oficial", route: "/painel-eleitoral" },
        { name: "Agenda Inteligente", route: "/comunicacao-institucional" },
        { name: "Central de Disparos", route: "/whaticket" },
        { name: "Histórico de Exportações", route: "/exportacoes" },
        { name: "VOTO FORTE Neural", route: "/inteligencia-sistema" },
        { name: "Administração de Usuários", route: "/administracao" },
      ],
      databaseSummary: {
        contactsCount: contactsRes.data?.length ?? 0,
        usersCount: usersRes.data?.length ?? 0,
        auditLogsCount: auditRes.data?.length ?? 0,
        exportsCount: exportsRes.data?.length ?? 0,
      },
    };

    const fullBackupPayload = {
      format: "voto-forte-master-full-backup",
      schemaVersion: "2.0",
      system: systemManifest,
      data: {
        users: usersRes.data ?? [],
        contacts: contactsRes.data ?? [],
        auditLogs: auditRes.data ?? [],
        contactExports: exportsRes.data ?? [],
        previousSnapshots: backupsRes.data ?? [],
      },
    };

    // Log the master backup execution in audit
    await account.supabase.from("vf_audit_logs").insert({
      actor_id: account.auth_user_id,
      actor_email: account.email,
      action: "Backup Geral Master Realizado",
      detail: `Exportação total de ${systemManifest.databaseSummary.contactsCount} contatos e configurações do sistema.`,
    });

    const filename = `VotoForte-BACKUP-MESTRE-COMPLETO-${dateStr}-${timeStr}.json`;

    return new Response(JSON.stringify(fullBackupPayload, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="${filename}"`,
        "x-backup-generator": "VOTO-FORTE-NEURAL-MASTER",
      },
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Falha ao gerar o backup geral do sistema.",
      },
      { status: 500 },
    );
  }
}
