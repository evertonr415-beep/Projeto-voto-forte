import { readFile } from "node:fs/promises";
import path from "node:path";
import { getAccount } from "../../server-identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OfficialCandidate = {
  name: string;
  number?: string;
  party?: string;
  votes: number;
  percentage?: number;
};

type OfficialOffice = {
  key: string;
  label: string;
  totalVotes?: number;
  nominalVotes?: number;
  candidates?: OfficialCandidate[];
};

type OfficialElection = {
  year: number;
  label: string;
  offices?: Record<string, OfficialOffice>;
};

type OfficialPollingPlace = {
  id: string;
  code?: string;
  name: string;
  address?: string;
  district?: string;
  cep?: string;
  zone?: number;
  sections?: number[];
  totalVoters?: number;
  elections?: Record<string, OfficialElection>;
};

type OfficialDataset = {
  schemaVersion?: number;
  generatedAt?: string;
  provider?: string;
  methodology?: string;
  sourceUrls?: string[];
  pollingPlaces?: OfficialPollingPlace[];
};

function normalize(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toUpperCase();
}

function districtMatches(left: unknown, right: unknown) {
  const a = normalize(left);
  const b = normalize(right);
  if (!a || !b) return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;
  const removeGeneric = (value: string) =>
    value
      .replace(/\b(JARDIM|JD|CONJUNTO|CJ|VILA|PARQUE|PQ|RESIDENCIAL|RES)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const aa = removeGeneric(a);
  const bb = removeGeneric(b);
  return Boolean(aa && bb && (aa === bb || aa.includes(bb) || bb.includes(aa)));
}

async function readDataset(): Promise<OfficialDataset | null> {
  try {
    const file = path.join(
      process.cwd(),
      "app",
      "data",
      "arapongas-tse-official.json",
    );
    const raw = await readFile(file, "utf8");
    return JSON.parse(raw) as OfficialDataset;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const account = await getAccount();
  if (!account)
    return Response.json({ error: "Não autenticado" }, { status: 401 });

  const url = new URL(request.url);
  const district = (url.searchParams.get("district") || "").trim();
  const pollingPlaceId = (url.searchParams.get("pollingPlaceId") || "").trim();
  const dataset = await readDataset();

  if (!dataset?.pollingPlaces?.length) {
    return Response.json(
      {
        ready: false,
        provider: "Tribunal Superior Eleitoral (TSE)",
        district,
        pollingPlaces: [],
        message:
          "A sincronização dos resultados oficiais por seção/local de votação ainda não foi concluída.",
      },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  }

  const districtPlaces = district
    ? dataset.pollingPlaces.filter((place) => districtMatches(place.district, district))
    : dataset.pollingPlaces;
  const selected = pollingPlaceId
    ? dataset.pollingPlaces.find((place) => place.id === pollingPlaceId) || null
    : null;

  return Response.json(
    {
      ready: true,
      district,
      provider: dataset.provider || "Tribunal Superior Eleitoral (TSE)",
      methodology:
        dataset.methodology ||
        "Votos oficiais por seção eleitoral agregados por local de votação.",
      generatedAt: dataset.generatedAt || null,
      sourceUrls: dataset.sourceUrls || [],
      pollingPlaces: districtPlaces,
      selectedPollingPlace: selected,
    },
    {
      headers: {
        "Cache-Control": "private, max-age=300, stale-while-revalidate=3600",
      },
    },
  );
}
