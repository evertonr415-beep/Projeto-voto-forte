import { ARAPONGAS_DISTRICTS } from "../../arapongas-boundaries-data";
import { getAccount, isAdministrator } from "../../server-identity";

export async function GET(request: Request) {
  const account = await getAccount();
  if (!account) return Response.json({ error: "Não autenticado" }, { status: 401 });

  const url = new URL(request.url);
  const requestedOwner = url.searchParams.get("owner")?.trim().toLowerCase();
  const isAdmOrGestor =
    account.accessRole === "adm" ||
    account.accessRole === "gestor" ||
    isAdministrator(account.role);

  const scope = requestedOwner === "all" || isAdmOrGestor ? "all" : account.email;

  try {
    // Carrega a contagem de contatos por bairro para enriquecer os polígonos
    const { data: summaryRows } = await account.supabase
      .from("vf_arapongas_district_summary")
      .select("district_name, total");

    const countsMap = new Map<string, number>();
    if (Array.isArray(summaryRows)) {
      for (const row of summaryRows) {
        const name = String(row.district_name || "")
          .trim()
          .toLowerCase();
        const count = Number(row.total || 0);
        if (name) {
          countsMap.set(name, (countsMap.get(name) || 0) + count);
        }
      }
    }

    const districts = ARAPONGAS_DISTRICTS.map((d) => {
      const lowerName = d.name.toLowerCase();
      const count =
        countsMap.get(lowerName) ||
        countsMap.get(d.shortName?.toLowerCase() || "") ||
        0;

      return {
        ...d,
        total: count,
      };
    });

    return Response.json(
      {
        scope,
        districts,
      },
      {
        headers: {
          "Cache-Control": "private, max-age=60, stale-while-revalidate=300",
        },
      },
    );
  } catch (error) {
    console.error("Failed to load arapongas boundaries", error);
    return Response.json(
      {
        scope,
        districts: ARAPONGAS_DISTRICTS.map((d) => ({ ...d, total: 0 })),
      },
      {
        headers: {
          "Cache-Control": "private, max-age=60, stale-while-revalidate=300",
        },
      },
    );
  }
}
