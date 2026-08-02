import { getServerSupabase } from "./supabase-server";

export const OWNER_EMAIL = "evertonr415@gmail.com";

export async function getAccount() {
  const supabase = await getServerSupabase();
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  const email = user?.email?.trim().toLowerCase();
  if (!user || !email) return null;
  const name = String(user.user_metadata?.name ?? "").trim() || (email === OWNER_EMAIL ? "Everton Moreira" : email);
  const role = email === OWNER_EMAIL ? "master" : "user";
  await supabase.from("vf_users").upsert({ auth_user_id: user.id, email, name, role }, { onConflict: "auth_user_id", ignoreDuplicates: true });
  const { data: account } = await supabase.from("vf_users").select("*").eq("auth_user_id", user.id).single();
  if (!account || account.status === "blocked") return null;
  await supabase.from("vf_users").update({ last_seen_at: new Date().toISOString() }).eq("auth_user_id", user.id);
  return { ...account, supabase };
}

export function isAdministrator(role: string) { return role === "master" || role === "admin"; }
