import { getAccount, getVisibleUsers } from "../../server-identity";

type MunicipalityItem = {
  id?: number | string;
  name?: string;
  state?: string;
};

type MunicipalityContext = {
  currentMunicipalityId?: number | string;
  municipalities?: MunicipalityItem[];
};

type DistrictAliasRow = {
  canonical_name?: string | null;
};

type DistrictSummaryRow = {
  district?: string | null;
};

function cleanDistricts(values: unknown[]) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  ).sort((left, right) => left.localeCompare(right, "pt-BR"));
}

export async function GET() {
  const account = await getAccount();
  if (!account) {
    return Response.json({ error: "Não autenticado" }, { status: 401 });
  }

  const contextResult = await account.supabase.rpc("vf_municipality_context");
  if (contextResult.error) {
    console.error("Failed to load municipality context for district catalog", contextResult.error);
    return Response.json(
      { error: "Não foi possível identificar o município atual." },
      { status: 500 },
    );
  }

  const context = (contextResult.data || {}) as MunicipalityContext;
  const currentMunicipality = (context.municipalities || []).find(
    (item) => Number(item.id) === Number(context.currentMunicipalityId),
  );

  if (!currentMunicipality) {
    return Response.json(
      { error: "Município atual não encontrado." },
      { status: 400 },
    );
  }

  const municipalityName = String(currentMunicipality.name || "").trim();
  const isArapongas = municipalityName.toLocaleLowerCase("pt-BR") === "arapongas";

  if (isArapongas) {
    const aliasesResult = await account.supabase
      .from("vf_arapongas_district_aliases")
      .select("canonical_name")
      .eq("active", true)
      .order("canonical_name");

    if (aliasesResult.error) {
      console.error("Failed to load Arapongas district catalog", aliasesResult.error);
      return Response.json(
        { error: "Não foi possível carregar o catálogo de bairros agora." },
        { status: 500 },
      );
    }

    const rows = Array.isArray(aliasesResult.data)
      ? (aliasesResult.data as DistrictAliasRow[])
      : [];
    const districts = cleanDistricts(rows.map((row) => row.canonical_name));

    return Response.json(
      {
        municipality: {
          id: Number(currentMunicipality.id),
          name: municipalityName,
          state: String(currentMunicipality.state || ""),
        },
        districts,
        total: districts.length,
      },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  }

  const users = await getVisibleUsers(account);
  const ownerEmails = Array.from(
    new Set(
      [account.email, ...users.filter((user) => user.status === "active").map((user) => user.email)]
        .map((email) => String(email || "").trim().toLowerCase())
        .filter(Boolean),
    ),
  );

  const summaryResult = await account.supabase.rpc(
    "vf_current_municipality_map_district_summary",
    { p_owner_emails: ownerEmails },
  );

  if (summaryResult.error) {
    console.error("Failed to load district catalog fallback", summaryResult.error);
    return Response.json(
      { error: "Não foi possível carregar os bairros agora." },
      { status: 500 },
    );
  }

  const rows = Array.isArray(summaryResult.data)
    ? (summaryResult.data as DistrictSummaryRow[])
    : [];
  const districts = cleanDistricts(rows.map((row) => row.district));

  return Response.json(
    {
      municipality: {
        id: Number(currentMunicipality.id),
        name: municipalityName,
        state: String(currentMunicipality.state || ""),
      },
      districts,
      total: districts.length,
    },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}
