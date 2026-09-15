import { getAccount, getVisibleUsers, isAdministrator } from "../../../server-identity";

export const dynamic = "force-dynamic";

type BulkActionBody = {
  action: "update_district" | "update_leader" | "update_kind" | "delete";
  ids: number[];
  district?: string;
  leader?: string;
  kind?: "Eleitor" | "Liderança";
};

export async function POST(request: Request) {
  const account = await getAccount();
  if (!account) {
    return Response.json({ error: "Não autenticado" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as BulkActionBody;
    const { action, ids, district, leader, kind } = body;

    if (!Array.isArray(ids) || !ids.length) {
      return Response.json(
        { error: "Nenhum contato selecionado para a ação em lote." },
        { status: 400 },
      );
    }

    if (ids.length > 200) {
      return Response.json(
        { error: "Limite máximo de 200 contatos por operação em lote." },
        { status: 400 },
      );
    }

    // Resolve allowed emails scope
    const users = await getVisibleUsers(account);
    const emails = users
      .filter((user) => user.status === "active")
      .map((user) => String(user.email).trim().toLowerCase());
    if (!emails.includes(account.email)) emails.push(account.email);

    const isAdmOrGestor =
      account.accessRole === "adm" ||
      account.accessRole === "gestor" ||
      isAdministrator(account.role);

    // Fetch existing records to update payloads
    let fetchQuery = account.supabase
      .from("vf_owned_records")
      .select("id,owner_email,payload")
      .in("id", ids)
      .eq("kind", "contact");

    if (!isAdmOrGestor) {
      fetchQuery = fetchQuery.in("owner_email", emails);
    }

    const { data: records, error: fetchErr } = await fetchQuery;
    if (fetchErr) throw new Error(fetchErr.message);

    const validRecords = records ?? [];
    if (!validRecords.length) {
      return Response.json(
        { error: "Nenhum contato válido encontrado no seu escopo de permissão." },
        { status: 404 },
      );
    }

    const now = new Date().toISOString();

    if (action === "delete") {
      const validIds = validRecords.map((r) => r.id);
      const { error: delErr } = await account.supabase
        .from("vf_owned_records")
        .delete()
        .in("id", validIds);

      if (delErr) throw new Error(delErr.message);

      await account.supabase.from("vf_audit_logs").insert({
        actor_id: account.auth_user_id,
        actor_email: account.email,
        action: "Exclusão em lote de contatos",
        detail: `Excluídos ${validIds.length} contatos com sucesso.`,
      });

      return Response.json({
        success: true,
        action,
        count: validIds.length,
        message: `${validIds.length} contato(s) excluído(s) com sucesso.`,
      });
    }

    // Process Updates
    let updatedCount = 0;
    for (const record of validRecords) {
      const oldPayload = (record.payload ?? {}) as Record<string, unknown>;
      const newPayload = { ...oldPayload };

      if (action === "update_district" && district !== undefined) {
        newPayload.district = district.trim();
      } else if (action === "update_leader" && leader !== undefined) {
        newPayload.leader = leader.trim();
      } else if (action === "update_kind" && (kind === "Eleitor" || kind === "Liderança")) {
        newPayload.kind = kind;
      }

      const { error: updateErr } = await account.supabase
        .from("vf_owned_records")
        .update({
          payload: newPayload,
          updated_at: now,
        })
        .eq("id", record.id);

      if (!updateErr) updatedCount++;
    }

    let detailMsg = "";
    if (action === "update_district") detailMsg = `Bairro alterado para "${district}" em ${updatedCount} contatos.`;
    else if (action === "update_leader") detailMsg = `Líder alterado para "${leader || "Nenhum"}" em ${updatedCount} contatos.`;
    else if (action === "update_kind") detailMsg = `Perfil alterado para "${kind}" em ${updatedCount} contatos.`;

    await account.supabase.from("vf_audit_logs").insert({
      actor_id: account.auth_user_id,
      actor_email: account.email,
      action: "Alteração em lote de contatos",
      detail: detailMsg,
    });

    return Response.json({
      success: true,
      action,
      count: updatedCount,
      message: `${updatedCount} contato(s) atualizado(s) com sucesso!`,
    });
  } catch (err) {
    return Response.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Falha ao processar ações em lote nos contatos.",
      },
      { status: 400 },
    );
  }
}
