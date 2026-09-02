import { getAccount } from "../../server-identity";

type MunicipalityItem = {
  id?: number | string;
  name?: string;
  state?: string;
};

type MunicipalityContext = {
  currentMunicipalityId?: number | string;
  municipalities?: MunicipalityItem[];
};

type OverpassElement = {
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: { name?: string };
};

function escapeOverpass(value: unknown) {
  return String(value ?? "").replace(/["\\]/g, " ").trim();
}

function isArapongas(value: unknown) {
  return String(value ?? "").trim().toLocaleLowerCase("pt-BR") === "arapongas";
}

export async function GET() {
  const account = await getAccount();
  if (!account)
    return Response.json({ error: "Não autenticado" }, { status: 401 });

  const contextResult = await account.supabase.rpc("vf_municipality_context");
  if (contextResult.error) {
    console.error("Failed to load municipality context for district centers", contextResult.error);
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
    return Response.json({ error: "Município atual não encontrado." }, { status: 400 });
  }

  if (isArapongas(currentMunicipality.name)) {
    return Response.json(
      {
        municipality: currentMunicipality,
        centers: [],
        source: "arapongas_catalog",
      },
      { headers: { "Cache-Control": "private, max-age=300" } },
    );
  }

  const { data: municipalityRow, error: municipalityError } = await account.supabase
    .from("vf_municipalities")
    .select("id,name,state,ibge_code")
    .eq("id", Number(currentMunicipality.id))
    .maybeSingle();

  if (municipalityError) {
    console.error("Failed to load municipality IBGE code", municipalityError);
  }

  const ibgeCode = escapeOverpass(municipalityRow?.ibge_code);
  const municipalityName = escapeOverpass(currentMunicipality.name);
  const areaSelector = ibgeCode
    ? `relation["ref:IBGE"="${ibgeCode}"]["boundary"="administrative"]["admin_level"="8"]->.municipality;\n.municipality map_to_area -> .a;`
    : `area["name"="${municipalityName}"]["boundary"="administrative"]["admin_level"="8"]->.a;`;
  const query = `[out:json][timeout:20];\n${areaSelector}\n(\n  relation["boundary"="administrative"]["admin_level"~"10|11"](area.a);\n  way["boundary"="administrative"]["admin_level"~"10|11"](area.a);\n  node["place"~"neighbourhood|suburb|quarter"]["name"](area.a);\n);\nout tags center;`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8500);

  try {
    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
        "user-agent": "VotoForteParana/1.0 (sistemavotoforte.com.br)",
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      console.error("Overpass district centers failed", response.status);
      return Response.json(
        {
          municipality: currentMunicipality,
          centers: [],
          source: "overpass_unavailable",
        },
        { headers: { "Cache-Control": "private, no-store, max-age=0" } },
      );
    }

    const payload = (await response.json()) as { elements?: OverpassElement[] };
    const centers = new Map<
      string,
      { district: string; latitude: number; longitude: number }
    >();

    for (const element of payload.elements || []) {
      const district = String(element.tags?.name || "").trim();
      const latitude = Number(element.center?.lat ?? element.lat);
      const longitude = Number(element.center?.lon ?? element.lon);
      if (!district || !Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
      const key = district
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]+/g, " ")
        .trim()
        .toUpperCase();
      if (!key || centers.has(key)) continue;
      centers.set(key, { district, latitude, longitude });
    }

    return Response.json(
      {
        municipality: {
          id: Number(currentMunicipality.id),
          name: String(currentMunicipality.name || ""),
          state: String(currentMunicipality.state || ""),
          ibgeCode: ibgeCode || null,
        },
        centers: Array.from(centers.values()),
        source: "openstreetmap_overpass",
      },
      { headers: { "Cache-Control": "private, max-age=21600" } },
    );
  } catch (error) {
    if (!(error instanceof DOMException && error.name === "AbortError")) {
      console.error("Failed to resolve municipality district centers", error);
    }
    return Response.json(
      {
        municipality: currentMunicipality,
        centers: [],
        source: "overpass_unavailable",
      },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  } finally {
    clearTimeout(timeout);
  }
}
