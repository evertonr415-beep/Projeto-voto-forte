import { getAccount } from "../../server-identity";
import { analyzeSystemSignals, type SystemSignals } from "./analysis";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

type UserSignalRow = {
  id: number;
  role: string;
  status: string;
  last_seen_at: string | null;
};

type BackupCatalogRow = {
  id: number;
  created_at: string;
  created_by: string | null;
  item_count: number | null;
  checksum: string | null;
  backup_version: number | null;
  format: string | null;
};

type ContactMetricRow = {
  owner_email: string;
  total_contacts: number | string | null;
  contacts_last_7_days: number | string | null;
  contacts_last_30_days: number | string | null;
};

type UserMetricRow = {
  owner_email: string;
  system_pending_contacts: number | string | null;
};

type NavigationMetric = {
  label?: string | null;
  count?: number | string | null;
};

type AuditMetricRow = {
  audit_events?: number | string | null;
  navigation_events?: number | string | null;
  operational_events?: number | string | null;
  import_runs?: number | string | null;
  imported?: number | string | null;
  duplicates?: number | string | null;
  invalid?: number | string | null;
  navigation?: NavigationMetric[] | null;
};

function backupAgeHours(createdAt: string | null) {
  if (!createdAt) return null;
  return Math.max(0, (Date.now() - new Date(createdAt).getTime()) / 3_600_000);
}

function isRecoverableSnapshotFormat(format: string | null) {
  return format === "voto-forte-backup" || format === "voto-forte-master-full-backup";
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

  try {
    const [
      contactMetricsResult,
      userMetricsResult,
      usersResult,
      backupCatalogResult,
      auditMetricsResult,
    ] = await Promise.all([
      account.supabase.rpc("vf_intelligence_contact_metrics"),
      account.supabase.rpc("vf_intelligence_user_metrics"),
      account.supabase
        .from("vf_users")
        .select("id,role,status,last_seen_at"),
      account.supabase
        .from("vf_backup_snapshots")
        .select("id,created_at,created_by,item_count,checksum,backup_version,format:data->>format")
        .order("created_at", { ascending: false })
        .limit(100),
      account.supabase.rpc("vf_system_audit_metrics", {
        p_since: thirtyDaysAgo,
      }),
    ]);

    for (const result of [
      contactMetricsResult,
      userMetricsResult,
      usersResult,
      backupCatalogResult,
      auditMetricsResult,
    ]) {
      if (result.error) throw new Error(result.error.message);
    }

    const contactMetrics = (contactMetricsResult.data ?? []) as ContactMetricRow[];
    const totalContacts = contactMetrics.reduce(
      (sum, row) => sum + Number(row.total_contacts ?? 0),
      0,
    );
    const newContacts7Days = contactMetrics.reduce(
      (sum, row) => sum + Number(row.contacts_last_7_days ?? 0),
      0,
    );
    const newContacts30Days = contactMetrics.reduce(
      (sum, row) => sum + Number(row.contacts_last_30_days ?? 0),
      0,
    );
    const pendingContacts = ((userMetricsResult.data ?? []) as UserMetricRow[]).reduce(
      (sum, row) => sum + Number(row.system_pending_contacts ?? 0),
      0,
    );

    const users = (usersResult.data ?? []) as UserSignalRow[];
    const activeUsers = users.filter((user) => user.status === "active");
    const blockedUsers = users.filter((user) => user.status === "blocked");
    const inactiveUsers30Days = activeUsers.filter((user) => {
      if (!user.last_seen_at) return true;
      return new Date(user.last_seen_at).getTime() < Date.now() - THIRTY_DAYS_MS;
    }).length;
    const leaders = activeUsers.filter((user) => user.role === "lider").length;

    const auditMetric = (Array.isArray(auditMetricsResult.data)
      ? auditMetricsResult.data[0]
      : null) as AuditMetricRow | null;
    const auditEvents30Days = Number(auditMetric?.audit_events ?? 0);
    const navigationEvents30Days = Number(auditMetric?.navigation_events ?? 0);
    const operationalEvents30Days = Number(auditMetric?.operational_events ?? 0);
    const navigation = (Array.isArray(auditMetric?.navigation)
      ? auditMetric.navigation
      : [])
      .map((item) => {
        const count = Math.max(0, Number(item.count ?? 0));
        return {
          label: String(item.label || "Sem identificação"),
          count,
          share: navigationEvents30Days ? count / navigationEvents30Days : 0,
        };
      })
      .filter((item) => item.count > 0);

    const backupSnapshots = ((backupCatalogResult.data ?? []) as BackupCatalogRow[]).map((row) => {
      const format = row.format ?? null;
      const recoverable = isRecoverableSnapshotFormat(format);
      return {
        id: Number(row.id),
        createdAt: row.created_at,
        createdBy: row.created_by,
        itemCount: Number(row.item_count ?? 0),
        checksum: row.checksum,
        backupVersion: row.backup_version,
        format,
        recoverable,
        status: recoverable ? "recoverable" : "metadata_only",
      };
    });

    const latestRecoverableBackup = backupSnapshots.find((snapshot) => snapshot.recoverable) ?? null;

    const signals: SystemSignals = {
      generatedAt: new Date().toISOString(),
      totalContacts,
      pendingContacts,
      newContacts7Days,
      newContacts30Days,
      activeUsers: activeUsers.length,
      blockedUsers: blockedUsers.length,
      inactiveUsers30Days,
      leaders,
      auditEvents30Days,
      navigationEvents30Days,
      operationalEvents30Days,
      auditWindowTruncated: false,
      imports30Days: {
        runs: Number(auditMetric?.import_runs ?? 0),
        inserted: Number(auditMetric?.imported ?? 0),
        duplicates: Number(auditMetric?.duplicates ?? 0),
        invalid: Number(auditMetric?.invalid ?? 0),
      },
      backup: {
        exists: Boolean(latestRecoverableBackup),
        createdAt: latestRecoverableBackup?.createdAt ?? null,
        createdBy: latestRecoverableBackup?.createdBy ?? null,
        itemCount: Number(latestRecoverableBackup?.itemCount ?? 0),
        ageHours: latestRecoverableBackup?.createdAt
          ? backupAgeHours(latestRecoverableBackup.createdAt)
          : null,
      },
      navigation,
    };

    return Response.json(
      {
        generatedAt: signals.generatedAt,
        signals,
        backupSnapshots,
        backupPolicy: {
          snapshotHealthSource: "latest_recoverable_snapshot",
          acceptedRecoverableFormats: [
            "voto-forte-backup",
            "voto-forte-master-full-backup",
          ],
          databaseBackupSchedule: {
            configuredCronUtc: "30 6 * * *",
            configuredLocalTime: "03:30",
            timeZone: "America/Sao_Paulo",
            mechanism: "GitHub Actions + pg_dump PostgreSQL 17",
            executionStatusSource: "GitHub Actions workflow result",
          },
        },
        ...analyzeSystemSignals(signals),
      },
      {
        headers: {
          "Cache-Control": "private, max-age=60",
          Vary: "Authorization",
        },
      },
    );
  } catch (error) {
    console.error("Failed to analyze system intelligence", error);
    return Response.json(
      { error: "Não foi possível analisar o sistema agora." },
      { status: 400 },
    );
  }
}
