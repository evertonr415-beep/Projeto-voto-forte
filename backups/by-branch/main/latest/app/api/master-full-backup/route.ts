import { serializeCanonicalJson, sha256Checksum } from "../../backup-integrity";
import { getAccount } from "../../server-identity";

export const dynamic = "force-dynamic";

const CONTACT_PAGE_SIZE = 1000;
const APP_TIME_ZONE = "America/Sao_Paulo";

function saoPauloFileStamp(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "00";
  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    time: `${part("hour")}h${part("minute")}`,
  };
}

export async function GET(request: Request) {
  const account = await getAccount();
  if (!account || account.role !== "master") {
    return Response.json(
      { error: "Acesso exclusivo dos usuários Master do sistema." },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  if (searchParams.has("date") || searchParams.has("scheduled")) {
    return Response.json(
      {
        error:
          "Este endpoint gera somente um backup atual sob demanda. Para um snapshot histórico, use o download pelo ID do snapshot persistido.",
      },
      { status: 400 },
    );
  }

  try {
    const now = new Date();
    const timestamp = now.toISOString();
    const { date: dateStr, time: timeStr } = saoPauloFileStamp(now);

    const countResult = await account.supabase
      .from("vf_owned_records")
      .select("id", { count: "exact", head: true })
      .eq("kind", "contact");

    if (countResult.error) {
      throw new Error(`Falha ao contar os contatos: ${countResult.error.message}`);
    }
    if (countResult.count == null) {
      throw new Error("A contagem exata de contatos não foi retornada pelo banco.");
    }

    const expectedContactsCount = countResult.count;
    const contacts: Array<Record<string, unknown>> = [];

    for (let from = 0; from < expectedContactsCount; from += CONTACT_PAGE_SIZE) {
      const to = Math.min(from + CONTACT_PAGE_SIZE - 1, expectedContactsCount - 1);
      const pageResult = await account.supabase
        .from("vf_owned_records")
        .select("*")
        .eq("kind", "contact")
        .order("id", { ascending: true })
        .range(from, to);

      if (pageResult.error) {
        throw new Error(
          `Falha ao exportar contatos ${from + 1}-${to + 1}: ${pageResult.error.message}`,
        );
      }

      contacts.push(...((pageResult.data ?? []) as Array<Record<string, unknown>>));
    }

    if (contacts.length !== expectedContactsCount) {
      throw new Error(
        `Backup interrompido: o banco informou ${expectedContactsCount} contatos, mas somente ${contacts.length} foram exportados.`,
      );
    }

    const [usersRes, auditRes, exportsRes, backupsRes] = await Promise.all([
      account.supabase.from("vf_users").select("id,email,name,role,status,parent_user_id,created_at"),
      account.supabase.from("vf_audit_logs").select("*").order("created_at", { ascending: false }).limit(500),
      account.supabase.from("vf_contact_exports").select("*").order("created_at", { ascending: false }).limit(200),
      account.supabase.from("vf_backup_snapshots").select("id,created_at,created_by,backup_version,checksum,item_count").limit(50),
    ]);

    for (const [label, result] of [
      ["usuários", usersRes],
      ["auditoria", auditRes],
      ["exportações", exportsRes],
      ["snapshots anteriores", backupsRes],
    ] as const) {
      if (result.error) {
        throw new Error(`Falha ao exportar ${label}: ${result.error.message}`);
      }
    }

    const systemManifest = {
      platform: "VOTO FORTE PARANÁ",
      version: "2.5.0-PRO",
      generatedAt: timestamp,
      backupTargetDate: dateStr,
      backupMode: "manual_on_demand",
      backupSchedule: "Sob demanda (Master)",
      timeZone: APP_TIME_ZONE,
      databaseBackupSchedule: {
        mechanism: "GitHub Actions + pg_dump PostgreSQL 17",
        configuredCronUtc: "30 6 * * *",
        configuredLocalTime: "03:30",
        timeZone: APP_TIME_ZONE,
        note: "A execução agendada do banco é independente deste endpoint JSON e só é confirmada quando o workflow conclui com sucesso.",
      },
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
        contactsCount: contacts.length,
        expectedContactsCount,
        contactsComplete: contacts.length === expectedContactsCount,
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
        contacts,
        auditLogs: auditRes.data ?? [],
        contactExports: exportsRes.data ?? [],
        previousSnapshots: backupsRes.data ?? [],
      },
    };

    const serializedPayload = serializeCanonicalJson(fullBackupPayload);
    const checksum = sha256Checksum(serializedPayload);

    const auditInsert = await account.supabase.from("vf_audit_logs").insert({
      actor_id: account.auth_user_id,
      actor_email: account.email,
      action: "Backup Geral Master Realizado",
      detail: `Exportação manual atual (${dateStr} às ${timeStr}, ${APP_TIME_ZONE}) com ${systemManifest.databaseSummary.contactsCount} contatos.`,
    });
    if (auditInsert.error) {
      throw new Error(`Falha ao registrar auditoria do backup: ${auditInsert.error.message}`);
    }

    const snapshotInsert = await account.supabase.from("vf_backup_snapshots").insert({
      created_at: timestamp,
      created_by: account.email,
      backup_version: 2,
      checksum,
      item_count: systemManifest.databaseSummary.contactsCount,
      data: fullBackupPayload,
    });
    if (snapshotInsert.error) {
      throw new Error(`Falha ao persistir snapshot do backup: ${snapshotInsert.error.message}`);
    }

    const filename = `VotoForte-BACKUP-MESTRE-COMPLETO-${dateStr}-${timeStr}.json`;

    return new Response(serializedPayload, {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "private, no-store, max-age=0",
        "x-backup-generator": "VOTO-FORTE-NEURAL-MASTER",
        "x-backup-mode": "manual-on-demand",
        "x-backup-time-zone": APP_TIME_ZONE,
        "x-backup-sha256": checksum,
        "x-backup-checksum-scope": "exact-response-body",
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
