import { getServerSupabase } from "./supabase-server";

export const OWNER_EMAIL = "evertonr415@gmail.com";
export type UserRole = "master" | "gestor" | "lider" | "liderado";

export async function getAccount() {
  const supabase = await getServerSupabase();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email?.trim().toLowerCase();
  if (!user || !email) return null;

  const name =
    String(user.user_metadata?.name ?? "").trim() ||
    (email === OWNER_EMAIL ? "Everton Moreira" : email);

  const { data: existing } = await supabase
    .from("vf_users")
    .select("*")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!existing) {
    const { data: owner } = await supabase
      .from("vf_users")
      .select("id")
      .eq("email", OWNER_EMAIL)
      .maybeSingle();

    await supabase.from("vf_users").insert({
      auth_user_id: user.id,
      email,
      name,
      role: email === OWNER_EMAIL ? "master" : "liderado",
      parent_user_id: email === OWNER_EMAIL ? null : owner?.id ?? null,
    });
  }

  const { data: account } = await supabase
    .from("vf_users")
    .select("*")
    .eq("auth_user_id", user.id)
    .single();

  if (!account || account.status === "blocked") return null;

  await supabase
    .from("vf_users")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("auth_user_id", user.id);

  return { ...account, role: account.role as UserRole, supabase };
}

export function isAdministrator(role: string) {
  return role === "master" || role === "gestor" || role === "lider";
}

export function canCreateRole(actorRole: UserRole, targetRole: UserRole) {
  if (actorRole === "master") return true;
  if (actorRole === "gestor")
    return targetRole === "lider" || targetRole === "liderado";
  if (actorRole === "lider") return targetRole === "liderado";
  return false;
}

export async function getVisibleUsers(account: Awaited<ReturnType<typeof getAccount>>) {
  if (!account) return [];

  const { data } = await account.supabase
    .from("vf_users")
    .select("*")
    .order("name");
  const users = data ?? [];

  if (account.role === "master") return users;

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
  if (account.role === "master") return Number(account.id) !== targetId;
  const visible = await getVisibleUsers(account);
  return visible.some(
    (user) => Number(user.id) === targetId && Number(user.id) !== Number(account.id),
  );
}
