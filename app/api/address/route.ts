import { getAccount } from "../../server-identity";

type NominatimResult = {
  lat: string;
  lon: string;
  display_name?: string;
  type?: string;
  importance?: number;
  address?: Record<string, string>;
};

type ViaCepResult = {
  erro?: boolean;
  cep?: string;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
};

const headers = { "cache-control": "private, max-age=300" };
const clean = (value = "") =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

async function lookupCep(cep: string): Promise<ViaCepResult | null> {
  if (cep.length !== 8) return null;
  try {
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as ViaCepResult;
    return data.erro ? null : data;
  } catch {
    return null;
  }
}

function municipalityOf(address: Record<string, string>) {
  return (
    address.city ||
    address.town ||
    address.municipality ||
    address.village ||
    address.city_district ||
    ""
  );
}

function stateIsParana(address: Record<string, string>, displayName = "") {
  const state = address.state || "";
  const code = address["ISO3166-2-lvl4"] || address.state_code || "";
  return (
    clean(state) === "parana" ||
    clean(code) === "brpr" ||
    clean(displayName).includes("parana")
  );
}

export async function GET(request: Request) {
  if (!(await getAccount()))
    return Response.json({ error: "Não autenticado" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const cep = (params.get("cep") || "").replace(/\D/g, "");

  if (params.get("action") === "cep") {
    if (cep.length !== 8)
      return Response.json({ error: "CEP inválido" }, { status: 400 });

    const data = await lookupCep(cep);
    if (!data)
      return Response.json({ error: "CEP não encontrado" }, { status: 404 });
    if (data.uf !== "PR")
      return Response.json(
        { error: "O CEP informado não pertence ao Paraná" },
        { status: 400 },
      );

    return Response.json(data, { headers });
  }

  const cepData = await lookupCep(cep);
  if (cepData?.uf && cepData.uf !== "PR")
    return Response.json(
      { error: "O endereço informado não pertence ao Paraná" },
      { status: 400 },
    );

  const street =
    params.get("street")?.trim() || cepData?.logradouro?.trim() || "";
  const number = params.get("number")?.trim() || "";
  const district =
    params.get("district")?.trim() || cepData?.bairro?.trim() || "";
  const city =
    cepData?.localidade?.trim() || params.get("city")?.trim() || "";
  const state = "PR";

  if (!street || !number)
    return Response.json(
      { error: "Rua e número são obrigatórios" },
      { status: 400 },
    );
  if (!city)
    return Response.json(
      { error: "Não foi possível identificar o município pelo CEP" },
      { status: 400 },
    );

  const queries = [
    `${street}, ${number}, ${district}, ${city}, Paraná, ${cep}, Brasil`,
    `${number}, ${street}, ${city}, Paraná, ${cep}, Brasil`,
    `${street}, ${number}, ${city}, Paraná, Brasil`,
    `${street}, ${district}, ${city}, Paraná, ${cep}, Brasil`,
    `${street}, ${city}, Paraná, Brasil`,
  ];

  let bestApproximate: NominatimResult | null = null;

  for (let index = 0; index < queries.length; index += 1) {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("limit", "10");
    url.searchParams.set("countrycodes", "br");
    url.searchParams.set("dedupe", "1");
    url.searchParams.set("q", queries[index]);

    try {
      const response = await fetch(url, {
        headers: {
          "accept-language": "pt-BR",
          "user-agent":
            "VotoForteParana/1.2 (sistemavotoforte.com.br; geocodificacao eleitoral)",
        },
        signal: AbortSignal.timeout(9000),
      });
      if (!response.ok) continue;

      const results = (await response.json()) as NominatimResult[];
      const validResults = results.filter((item) => {
        const address = item.address || {};
        const resultCity = municipalityOf(address);
        const cityMatches =
          clean(resultCity) === clean(city) ||
          clean(item.display_name).includes(clean(city));
        return cityMatches && stateIsParana(address, item.display_name);
      });

      const ranked = validResults
        .map((item) => {
          const address = item.address || {};
          const returnedNumber = address.house_number || "";
          const returnedRoad =
            address.road || address.pedestrian || address.residential || "";
          const returnedPostcode = (address.postcode || "").replace(/\D/g, "");
          const exactNumber = clean(returnedNumber) === clean(number);
          const exactStreet =
            !!returnedRoad &&
            (clean(returnedRoad).includes(clean(street)) ||
              clean(street).includes(clean(returnedRoad)));
          const exactCep = !cep || returnedPostcode === cep;
          const score =
            (exactNumber ? 50 : 0) +
            (exactStreet ? 35 : 0) +
            (exactCep ? 10 : 0) +
            Math.round((item.importance || 0) * 5);
          return { item, exactNumber, exactStreet, exactCep, score };
        })
        .sort((a, b) => b.score - a.score);

      const best = ranked[0];
      if (!best) continue;

      if (best.exactNumber && best.exactStreet) {
        return Response.json(
          {
            latitude: Number(best.item.lat),
            longitude: Number(best.item.lon),
            locationLabel: best.item.display_name || queries[index],
            precision: "exact",
            confirmedNumber: true,
            confirmedStreet: true,
            confirmedCep: best.exactCep,
            city,
            state,
          },
          { headers },
        );
      }

      if (!bestApproximate) bestApproximate = best.item;
    } catch {
      // Tenta a próxima forma do endereço.
    }
  }

  if (bestApproximate) {
    const address = bestApproximate.address || {};
    const returnedRoad =
      address.road || address.pedestrian || address.residential || "";
    return Response.json(
      {
        latitude: Number(bestApproximate.lat),
        longitude: Number(bestApproximate.lon),
        locationLabel: bestApproximate.display_name || `${street}, ${city}, PR`,
        precision: "approximate",
        confirmedNumber: false,
        confirmedStreet:
          !!returnedRoad &&
          (clean(returnedRoad).includes(clean(street)) ||
            clean(street).includes(clean(returnedRoad))),
        city,
        state,
      },
      { headers },
    );
  }

  return Response.json(
    {
      error:
        "Endereço não localizado no município informado. Confira CEP, rua e número.",
    },
    { status: 404 },
  );
}
