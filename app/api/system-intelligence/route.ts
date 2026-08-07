import { getAccount } from "../../server-identity";
import { analyzeSystemSignals, type SystemSignals } from "./analysis";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const AUDIT_LIMIT = 10_000;

type UserSignalRow = {
  id: number;
  role: string;
  status: string;
  last_seen_at: string | null;
};

type AuditSignalRow = {
  action: string | null;
  detail: string | null;
  created_at: string;
};

type BackupSignalRow = {
  created_at: string;
  created_by: string | null;
  item_count: number | null;
};

function parseImportDetail(detail: unknown) {
  const text = String(detail ?? "");
  const read = (label: string) => {
    const match = text.match(new RegExp(`([\\d.]+)\\s+${label}`, "i"));
    return match ? Number(match[1].replace(/\D/g, "")) || 0 : 0;
  };
  return {
    inserted: read("inseridos"),
    duplicates: read("duplicados"),
    invalid: read("inválidos"),
  };
}

function backupAgeHours(createdAt: string | null) {
  if (!createdAt) return null;
  return Math.max(0, (Date.now() - new Date(createdAt).getTime()) / 3_600_000);
}

export async function GET() {
  const account = await getAccount();
  if (!account) return Response.json({ error: "Não autenticado" }, { status: 401 });
  if (account.role !== "master") {
    return Response.json(
      { error: "A Inteligência do Sistema é exclusiva do Administrador Master." },
      { status: 403 },
    );
  }

  const thirtyDaysAgo = new Date(Date.now() - THIRTY_DAYS_MS).toISOString();
  const sevenDaysAgo = new Date(Date.now() - SEVEN_DAYS_MS).toISOString();

  try {
    const [
      totalContacts,
      pendingContacts,
      newContacts7Days,
      newContacts30Days,
      usersResult,
      backupResult,
      auditResult,
    ] = await Promise.all([
      account.supabase
        .from("vf_owned_records")
        .select("id", { count: "exact", head: true })
        .eq("kind", "contact"),
      account.supabase
        .from("vf_contact_quality")
        .select("record_id", { count: "exact", head: true })
        .overlaps("issue_codes", [
          "invalid_phone",
          "missing_name",
          "incomplete_name",
          "missing_district",
          "missing_street",
          "location_divergence",
          "rural_location",
        ]),
      account.supabase
        .from("vf_owned_records")
        .select("id", { count: "exact", head: true })
        .eq("kind", "contact")
        .gte("created_at", sevenDaysAgo),
      account.supabase
        .from("vf_owned_records")
        .select("id", { count: "exact", head: true })
        .eq("kind", "contact")
        .gte("created_at", thirtyDaysAgo),
      account.supabase
        .from("vf_users")
        .select("id,role,status,last_seen_at"),
      account.supabase
        .from("vf_backup_snapshots")
        .select("created_at,created_by,item_count")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      account.supabase
        .from("vf_audit_logs")
        .select("action,detail,created_at")
        .gte("created_at", thirtyDaysAgo)
        .order("created_at", { ascending: false })
        .limit(AUDIT_LIMIT),
    ]);

    for (const result of [
      totalContacts,
      pendingContacts,
      newContacts7Days,
      newContacts30Days,
      usersResult,
      backupResult,
      auditResult,
    ]) {
      if (result.error) throw new Error(result.error.message);
    }

    const users = (usersResult.data ?? []) as UserSignalRow[];
    const activeUsers = users.filter((user) => user.status === "active");
    const blockedUsers = users.filter((user) => user.status === "blocked");
    const inactiveUsers30Days = activeUsers.filter((user) => {
      if (!user.last_seen_at) return true;
      return new Date(user.last_seen_at).getTime() < Date.now() - THIRTY_DAYS_MS;
    }).length;
    const leaders = activeUsers.filter((user) => user.role === "lider").length;

    const audit = (auditResult.data ?? []) as AuditSignalRow[];
    const navigationCounts = new Map<string, number>();
    let navigationEvents30Days = 0;
    let operationalEvents30Days = 0;
    let importRuns = 0;
    let imported = 0;
    let duplicates = 0;
    let invalid = 0;

    for (const event of audit) {
      const action = String(event.action ?? "");
      const detail = String(event.detail ?? "");
      if (action === "Navegação") {
        navigationEvents30Days += 1;
        const label = detail.trim() || "Sem identificação";
        navigationCounts.set(label, (navigationCounts.get(label) ?? 0) + 1);
      }
      if (!["Acesso ao sistema", "Navegação"].includes(action)) {
        operationalEvents30Days += 1;
      }
      if (
        action === "Importação inteligente de contatos" ||
        action === "Importação de contatos em lote"
      ) {
        importRuns += 1;
        const parsed = parseImportDetail(detail);
        imported += parsed.inserted;
        duplicates += parsed.duplicates;
        invalid += parsed.invalid;
      }
    }

    const navigation = [...navigationCounts.entries()]
      .map(([label, count]) => ({
        label,
        count,
        share: navigationEvents30Days ? count / navigationEvents30Days : 0,
      }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt-BR"));

    const backup = (backupResult.data ?? null) as BackupSignalRow | null;
    const signals: SystemSignals = {
      generatedAt: new Date().toISOString(),
      totalContacts: totalContacts.count ?? 0,
      pendingContacts: pendingContacts.count ?? 0,
      newContacts7Days: newContacts7Days.count ?? 0,
      newContacts30Days: newContacts30Days.count ?? 0,
      activeUsers: activeUsers.length,
      blockedUsers: blockedUsers.length,
      inactiveUsers30Days,
      leaders,
      auditEvents30Days: audit.length,
      navigationEvents30Days,
      operationalEvents30Days,
      auditWindowTruncated: audit.length >= AUDIT_LIMIT,
      imports30Days: {
        runs: importRuns,
        inserted: imported,
        duplicates,
        invalid,
      },
      backup: {
        exists: Boolean(backup),
        createdAt: backup?.created_at ?? null,
        createdBy: backup?.created_by ?? null,
        itemCount: Number(backup?.item_count ?? 0),
        ageHours: backupAgeHours(backup?.created_at ?? null),
      },
      navigation,
    };

    return Response.json(
      {
        generatedAt: signals.generatedAt,
        signals,
        ...analyzeSystemSignals(signals),
      },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("Failed to analyze system intelligence", error);
    return Response.json(
      { error: "Não foi possível analisar o sistema agora." },
      { status: 400 },
    );
  }
}
