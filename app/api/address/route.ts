import { getAccount } from "../../server-identity";

type NominatimResult = {
  lat: string;
  lon: string;
  display_name?: string;
  type?: string;
  address?: Record<string, string>;
};

const headers = { "cache-control": "private, max-age=300" };
const clean = (value = "") => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

export async function GET(request: Request) {
  if (!(await getAccount())) return Response.json({ error: "Não autenticado" }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const cep = (params.get("cep") || "").replace(/\D/g, "");

  if (params.get("action") === "cep") {
    if (cep.length !== 8) return Response.json({ error: "CEP inválido" }, { status: 400 });
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return Response.json({ error: "Falha na consulta do CEP" }, { status: 502 });
    const data = await response.json() as Record<string, unknown>;
    if (data.erro) return Response.json({ error: "CEP não encontrado" }, { status: 404 });
    return Response.json(data, { headers });
  }

  const street = params.get("street")?.trim() || "";
  const number = params.get("number")?.trim() || "";
  const district = params.get("district")?.trim() || "";
  const city = params.get("city")?.trim() || "Arapongas";
  const state = params.get("state")?.trim() || "PR";
  if (!street || !number) return Response.json({ error: "Rua e número são obrigatórios" }, { status: 400 });

  const queries = [
    `${street}, ${number}, ${district}, ${city}, ${state}, ${cep}, Brasil`,
    `${number}, ${street}, ${city}, ${state}, ${cep}, Brasil`,
    `${street}, ${number}, ${city}, ${state}, Brasil`,
    `${street}, ${district}, ${city}, ${state}, ${cep}, Brasil`,
    `${street}, ${city}, ${state}, Brasil`,
  ];

  for (let index = 0; index < queries.length; index += 1) {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("limit", "5");
    url.searchParams.set("countrycodes", "br");
    url.searchParams.set("q", queries[index]);
    try {
      const response = await fetch(url, {
        headers: { "accept-language": "pt-BR", "user-agent": "VotoForteParana/1.1 (sistemavotoforte.com.br)" },
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) continue;
      const results = await response.json() as NominatimResult[];
      const result = results.find((item) => {
        const a = item.address || {};
        const resultCity = a.city || a.town || a.municipality || a.village || "";
        return clean(resultCity).includes(clean(city)) || clean(item.display_name).includes(clean(city));
      });
      if (!result) continue;
      const a = result.address || {};
      const returnedNumber = a.house_number || "";
      const returnedRoad = a.road || a.pedestrian || a.residential || "";
      const exactNumber = clean(returnedNumber) === clean(number);
      const exactStreet = clean(returnedRoad).includes(clean(street)) || clean(street).includes(clean(returnedRoad));
      const precision = exactNumber && exactStreet ? "exact" : "approximate";
      return Response.json({
        latitude: Number(result.lat), longitude: Number(result.lon),
        locationLabel: result.display_name || queries[index], precision,
        confirmedNumber: exactNumber, confirmedStreet: exactStreet,
      }, { headers });
    } catch { /* tenta a próxima forma do endereço */ }
  }
  return Response.json({ error: "Endereço não localizado" }, { status: 404 });
}
