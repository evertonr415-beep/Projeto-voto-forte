import type { User } from "@supabase/supabase-js";
import { getServerSupabase } from "./supabase-server";

export const OWNER_EMAIL = "evertonr415@gmail.com";
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
  if (cleanEmail === OWNER_EMAIL.toLowerCase()) return "adm";
  if (cleanEmail === "campanhaeleicaoxv@gmail.com") return "gestor";
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
  if (cleanEmail === OWNER_EMAIL.toLowerCase()) return "adm";
  if (cleanEmail === "campanhaeleicaoxv@gmail.com") return "gestor";
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

  const { data: account } = await supabase
    .from("vf_users")
    .select("*")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!account || account.status === "blocked") return null;

  const isPedroLupion = email === "campanhaeleicaoxv@gmail.com";
  const finalRole: UserRole = isPedroLupion ? "gestor" : (account.role as UserRole);
  const finalAccessRole: AccessRole = isPedroLupion ? "gestor" : normalizeAccessRole(account.access_role, account.role, email);
  const finalName: string = isPedroLupion ? "Deputado Pedro Lupion" : String(account.name || "");

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
