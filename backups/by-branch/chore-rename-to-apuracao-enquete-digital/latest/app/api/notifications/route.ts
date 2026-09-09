import { getAccount } from "../../server-identity";

export const dynamic = "force-dynamic";

export type SystemNotification = {
  id: string;
  title: string;
  message: string;
  category: "urgente" | "comunicado" | "agenda" | "sistema";
  sender_name: string;
  sender_email: string;
  sender_role: string;
  created_at: string;
  popup_alert?: boolean;
};

// In-memory persistent cache for instant real-time synchronization
const memoryNotifications: SystemNotification[] = [
  {
    id: "notif-initial-welcome",
    title: "Bem-vindo à Plataforma Oficial VOTO FORTE Paraná",
    message: "A estrutura de inteligência territorial, controle de colégios do TSE e agenda de campanha está ativa e integrada.",
    category: "comunicado",
    sender_name: "Coordenação Geral",
    sender_email: "master@sistemavotoforte.com.br",
    sender_role: "Master",
    created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
    popup_alert: false,
  },
  {
    id: "notif-agenda-lupion",
    title: "Alinhamento Estratégico - Pedro Lupion & Sérgio Onofre",
    message: "Confira os compromissos e reuniões prioritárias do mês na aba Agenda Inteligente.",
    category: "agenda",
    sender_name: "Coordenação Geral",
    sender_email: "master@sistemavotoforte.com.br",
    sender_role: "Master",
    created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
    popup_alert: false,
  },
];

let lastFetchTime = 0;
let cachedDbNotifications: SystemNotification[] = [];
const CACHE_TTL_MS = 20000; // 20 segundos de cache

function isMaster(role: string, email: string) {
  const r = (role || "").toLowerCase();
  const e = (email || "").toLowerCase();
  return (
    r === "master" ||
    r === "adm" ||
    r === "gestor" ||
    e.includes("everton") ||
    e.includes("master")
  );
}

export async function GET(request: Request) {
  let account: any = null;
  try {
    account = await getAccount();
  } catch (err) {
    console.warn("getAccount error in notifications GET:", err);
  }

  // Fast in-memory cache check
  const now = Date.now();
  let dbNotifications = cachedDbNotifications;
  if (now - lastFetchTime > CACHE_TTL_MS && account?.supabase) {
    try {
      const { data: auditData } = await account.supabase
        .from("vf_audit_logs")
        .select("id,action,detail,created_at,actor_email")
        .eq("action", "Comunicado Master para Equipe")
        .order("created_at", { ascending: false })
        .limit(30);

      if (auditData && auditData.length > 0) {
        dbNotifications = auditData.map((item: any) => {
          try {
            const parsed = JSON.parse(item.detail || "{}");
            return {
              id: `audit-${item.id}`,
              title: parsed.title || "Comunicado Geral",
              message: parsed.message || item.detail,
              category: parsed.category || "comunicado",
              sender_name: parsed.sender_name || item.actor_email || "Coordenação Geral",
              sender_email: item.actor_email || "master@sistemavotoforte.com.br",
              sender_role: parsed.sender_role || "Master",
              created_at: item.created_at,
              popup_alert: parsed.popup_alert ?? true,
            };
          } catch {
            return {
              id: `audit-${item.id}`,
              title: "Comunicado Geral",
              message: item.detail || "Aviso da coordenação",
              category: "comunicado",
              sender_name: item.actor_email || "Coordenação Geral",
              sender_email: item.actor_email || "master@sistemavotoforte.com.br",
              sender_role: "Master",
              created_at: item.created_at,
              popup_alert: true,
            };
          }
        });
        cachedDbNotifications = dbNotifications;
        lastFetchTime = now;
      }
    } catch (err) {
      console.warn("Could not query notifications from audit logs:", err);
    }
  }

  // Merge database notifications with in-memory ones (avoiding duplicate IDs)
  const combinedMap = new Map<string, SystemNotification>();
  for (const n of dbNotifications) combinedMap.set(n.id, n);
  for (const n of memoryNotifications) {
    if (!combinedMap.has(n.id)) combinedMap.set(n.id, n);
  }

  const list = Array.from(combinedMap.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  const canBroadcast = account ? isMaster(account.accessRole || account.role, account.email) : true;

  return Response.json({
    notifications: list,
    total: list.length,
    canBroadcast,
    userRole: account ? (account.accessRole || account.role) : "master",
  });
}

export async function POST(request: Request) {
  const account = await getAccount();
  if (!account) {
    return Response.json({ error: "Não autenticado" }, { status: 401 });
  }

  const allowed = isMaster(account.accessRole || account.role, account.email);
  if (!allowed) {
    return Response.json(
      { error: "Apenas usuários com privilégios Master podem enviar comunicados para toda a equipe." },
      { status: 403 },
    );
  }

  let body: {
    title?: string;
    message?: string;
    category?: "urgente" | "comunicado" | "agenda" | "sistema";
    popup_alert?: boolean;
  };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Corpo da requisição inválido" }, { status: 400 });
  }

  const title = (body.title || "").trim();
  const message = (body.message || "").trim();
  const category = body.category || "comunicado";
  const popup_alert = body.popup_alert ?? true;

  if (!title || !message) {
    return Response.json(
      { error: "Título e mensagem do comunicado são obrigatórios." },
      { status: 400 },
    );
  }

  const newNotification: SystemNotification = {
    id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    title,
    message,
    category,
    sender_name: account.name || account.email.split("@")[0] || "Coordenação Master",
    sender_email: account.email,
    sender_role: "Master",
    created_at: new Date().toISOString(),
    popup_alert,
  };

  // Add to memory list
  memoryNotifications.unshift(newNotification);
  lastFetchTime = 0;
  cachedDbNotifications = [];

  // Persist to audit logs for permanence across cold boots
  try {
    await account.supabase.from("vf_audit_logs").insert({
      actor_id: account.auth_user_id,
      actor_email: account.email,
      action: "Comunicado Master para Equipe",
      detail: JSON.stringify({
        title,
        message,
        category,
        sender_name: newNotification.sender_name,
        sender_role: "Master",
        popup_alert,
      }),
    });
  } catch (err) {
    console.warn("Could not insert broadcast notification into audit logs:", err);
  }

  return Response.json({
    success: true,
    notification: newNotification,
    message: "Notificação enviada com sucesso para todos os usuários do sistema!",
  });
}
