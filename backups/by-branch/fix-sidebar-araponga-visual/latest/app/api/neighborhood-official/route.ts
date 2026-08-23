import { readFile } from "node:fs/promises";
import path from "node:path";
import { getAccount } from "../../server-identity";
import { ARAPONGAS_POLLING_PLACES } from "../../electoral-tse-data";

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

function normalizeZone(value: unknown) {
  const match = String(value ?? "").match(/\d+/);
  return match ? Number(match[0]) : undefined;
}

function fallbackPollingPlaces(district: string): OfficialPollingPlace[] {
  return ARAPONGAS_POLLING_PLACES
    .filter((place) => !district || districtMatches(place.district, district))
    .map((place) => ({
      id: place.id,
      name: place.name,
      address: place.address,
      district: place.district,
      zone: normalizeZone(place.zone),
      sections: place.sections,
      totalVoters: place.totalVoters,
    }));
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

function hasElectionResults(place: OfficialPollingPlace) {
  return Boolean(
    place.elections &&
      Object.values(place.elections).some((election) =>
        Object.values(election.offices || {}).some(
          (office) => Array.isArray(office.candidates) && office.candidates.length > 0,
        ),
      ),
  );
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
    const pollingPlaces = fallbackPollingPlaces(district);
    return Response.json(
      {
        ready: false,
        pollingPlacesReady: pollingPlaces.length > 0,
        resultsReady: false,
        provider: "Tribunal Superior Eleitoral (TSE)",
        district,
        pollingPlaces,
        selectedPollingPlace: pollingPlaceId
          ? pollingPlaces.find((place) => place.id === pollingPlaceId) || null
          : null,
        message:
          pollingPlaces.length > 0
            ? "Locais e seções eleitorais disponíveis. A sincronização dos votos oficiais por seção/local ainda não foi concluída."
            : "A sincronização dos resultados oficiais por seção/local de votação ainda não foi concluída.",
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
  const resultsReady = districtPlaces.some(hasElectionResults);

  return Response.json(
    {
      ready: resultsReady,
      pollingPlacesReady: districtPlaces.length > 0,
      resultsReady,
      district,
      provider: dataset.provider || "Tribunal Superior Eleitoral (TSE)",
      methodology:
        dataset.methodology ||
        "Votos oficiais por seção eleitoral agregados por local de votação.",
      generatedAt: dataset.generatedAt || null,
      sourceUrls: dataset.sourceUrls || [],
      pollingPlaces: districtPlaces,
      selectedPollingPlace: selected,
      message: resultsReady
        ? undefined
        : "Locais de votação disponíveis; os votos oficiais por seção/local ainda estão em sincronização.",
    },
    {
      headers: {
        "Cache-Control": "private, max-age=300, stale-while-revalidate=3600",
      },
    },
  );
}
