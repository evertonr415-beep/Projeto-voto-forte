import type { User } from "@supabase/supabase-js";
import { getServerSupabase } from "./supabase-server";

export const OWNER_EMAIL = "evertonr415@gmail.com";
export const ADMIN_EMAILS = ["evertonr415@gmail.com"];
export const GESTOR_EMAILS = [
  "campanhaeleicaoxv@gmail.com",
  "threexdroid@gmail.com",
  "williammarquesmachado@gmail.com",
];

export function isAdminEmail(email: string): boolean {
  const clean = String(email || "").trim().toLowerCase();
  return ADMIN_EMAILS.some((e) => e.toLowerCase() === clean);
}

export function isGestorEmail(email: string): boolean {
  const clean = String(email || "").trim().toLowerCase();
  return GESTOR_EMAILS.some((e) => e.toLowerCase() === clean);
}

export type UserRole = "master" | "gestor" | "lider" | "liderado";
export type AccessRole =
  | "adm"
  | "gestor"
  | "master"
  | "lideranca"
  | "liderado"
  | "eleitor";

type ServerSupabase = NonNullable<Awaited<ReturnType<typeof getServerSupabase>>>;

export type HierarchyUser = {
  id: number;
  auth_user_id: string;
  email: string;
  name: string;
  role: UserRole;
  access_role?: AccessRole;
  status: "active" | "blocked";
  parent_user_id: number | null;
  last_seen_at?: string | null;
  created_at?: string;
};

function legacyAccessRole(role: unknown, email: string): AccessRole {
  const cleanEmail = email.trim().toLowerCase();
  if (isAdminEmail(cleanEmail)) return "adm";
  if (isGestorEmail(cleanEmail)) return "gestor";
  if (role === "master") return "master";
  if (role === "gestor") return "gestor";
  if (role === "lider") return "lideranca";
  return "liderado";
}

function normalizeAccessRole(
  value: unknown,
  role: unknown,
  email: string,
): AccessRole {
  const cleanEmail = email.trim().toLowerCase();
  if (isAdminEmail(cleanEmail)) return "adm";
  if (isGestorEmail(cleanEmail)) return "gestor";
  if (
    ["adm", "gestor", "master", "lideranca", "liderado", "eleitor"].includes(
      String(value),
    )
  ) {
    return value as AccessRole;
  }
  return legacyAccessRole(role, email);
}

export async function getAccountForAuthenticatedUser(
  supabase: ServerSupabase,
  user: Pick<User, "id" | "email">,
) {
  const email = user.email?.trim().toLowerCase();
  if (!email) return null;

  let { data: account } = await supabase
    .from("vf_users")
    .select("*")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!account) {
    const { data: byEmail } = await supabase
      .from("vf_users")
      .select("*")
      .ilike("email", email)
      .maybeSingle();

    if (byEmail) {
      account = byEmail;
      // Auto-vincula o auth_user_id caso ainda não estivesse vinculado
      void supabase
        .from("vf_users")
        .update({ auth_user_id: user.id })
        .eq("id", byEmail.id);
    }
  }

  // Fallback garantido para o ADM Principal (OWNER_EMAIL)
  if (!account && isAdminEmail(email)) {
    account = {
      id: 1,
      auth_user_id: user.id,
      email: OWNER_EMAIL,
      name: "Everton Moreira",
      role: "master",
      access_role: "adm",
      status: "active",
      parent_user_id: null,
      created_at: new Date().toISOString(),
    };
  }

  // Fallback garantido para os Gestores (Pedro Lupion, threexdroid, williammarquesmachado)
  if (!account && isGestorEmail(email)) {
    const isWilliam = email === "williammarquesmachado@gmail.com";
    const isThreex = email === "threexdroid@gmail.com";
    account = {
      id: isWilliam ? 3 : isThreex ? 2 : 15,
      auth_user_id: user.id,
      email: user.email,
      name: isWilliam ? "William Marques Machado" : isThreex ? "Gestor" : "Deputado Pedro Lupion",
      role: "gestor",
      access_role: "gestor",
      status: "active",
      parent_user_id: 1,
      created_at: new Date().toISOString(),
    };
  }

  if (!account || account.status === "blocked") return null;

  const isGestor = isGestorEmail(email);
  if (account && isGestor) {
    account.role = "gestor";
    account.access_role = "gestor";
    void (async () => {
      await supabase
        .from("vf_users")
        .update({ role: "gestor", access_role: "gestor" })
        .eq("id", account.id);

      const { data: municipalities } = await supabase
        .from("vf_municipalities")
        .select("id")
        .eq("status", "active");

      if (Array.isArray(municipalities) && municipalities.length > 0) {
        const rows = municipalities.map((m, index) => ({
          user_id: account.id,
          municipality_id: Number(m.id),
          access_role: "gestor",
          status: "active",
          is_default: index === 0,
        }));
        await supabase
          .from("vf_user_municipalities")
          .upsert(rows, { onConflict: "user_id,municipality_id" });
      }
    })();
  }

  const finalRole: UserRole = isGestor ? "gestor" : (account.role as UserRole);
  const finalAccessRole: AccessRole = isGestor ? "gestor" : normalizeAccessRole(account.access_role, account.role, email);
  const finalName: string = email === "campanhaeleicaoxv@gmail.com" ? "Deputado Pedro Lupion" : String(account.name || "");

  return {
    ...account,
    name: finalName,
    role: finalRole,
    accessRole: finalAccessRole,
    supabase,
  };
}

export async function getAccount() {
  const supabase = await getServerSupabase();
  if (!supabase) return null;

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;

  return getAccountForAuthenticatedUser(supabase, user);
}

export function isAdministrator(role: string) {
  return role === "master" || role === "gestor" || role === "lider";
}

export function canCreateRole(actorRole: UserRole, targetRole: UserRole) {
  if (actorRole === "master") return true;
  if (actorRole === "gestor")
    return (
      targetRole === "master" ||
      targetRole === "lider" ||
      targetRole === "liderado"
    );
  if (actorRole === "lider") return targetRole === "liderado";
  return false;
}

export async function getVisibleUsers(
  account: Awaited<ReturnType<typeof getAccount>>,
): Promise<HierarchyUser[]> {
  if (!account) return [];

  const { data } = await account.supabase
    .from("vf_users")
    .select("*")
    .order("name");
  const users = (data ?? []) as HierarchyUser[];

  if (account.accessRole === "adm") return users;

  if (account.accessRole === "gestor") {
    const visiblePeople = users.filter(
      (user) =>
        normalizeAccessRole(user.access_role, user.role, user.email) !== "adm",
    );

    // Os registros historicos podem estar vinculados a um ADM como owner_email.
    // O RPC devolve somente esses identificadores operacionais; a linha da conta
    // ADM continua fora do RLS de vf_users e nunca entra na lista administrativa.
    const { data: operationalOwners } = await account.supabase.rpc(
      "vf_gestor_operational_owner_emails",
    );
    const knownEmails = new Set(
      visiblePeople.map((user) => String(user.email).trim().toLowerCase()),
    );
    const syntheticOwners = (Array.isArray(operationalOwners)
      ? operationalOwners
      : []
    )
      .map((value) => String(value || "").trim().toLowerCase())
      .filter((email) => email && !knownEmails.has(email))
      .map<HierarchyUser>((email, index) => ({
        id: -(index + 1),
        auth_user_id: "",
        email,
        name: "Operação municipal",
        role: "liderado",
        access_role: "master",
        status: "active",
        parent_user_id: null,
      }));

    return [...visiblePeople, ...syntheticOwners];
  }

  const visibleIds = new Set<number>([Number(account.id)]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const user of users) {
      if (
        user.parent_user_id &&
        visibleIds.has(Number(user.parent_user_id)) &&
        !visibleIds.has(Number(user.id))
      ) {
        visibleIds.add(Number(user.id));
        changed = true;
      }
    }
  }

  return users.filter((user) => visibleIds.has(Number(user.id)));
}

export async function canManageUser(
  account: Awaited<ReturnType<typeof getAccount>>,
  targetId: number,
) {
  if (!account) return false;
  if (account.accessRole === "adm") return Number(account.id) !== targetId;

  const visible = await getVisibleUsers(account);
  const target = visible.find((user) => Number(user.id) === targetId);
  if (!target || Number(target.id) === Number(account.id) || Number(target.id) <= 0)
    return false;

  const targetAccessRole = normalizeAccessRole(
    target.access_role,
    target.role,
    target.email,
  );
  if (account.accessRole === "gestor")
    return !["adm", "gestor"].includes(targetAccessRole);

  return true;
}
