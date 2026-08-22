import { NextRequest, NextResponse } from "next/server";

const TSE_ELECTION_CODE = "546";
const TSE_MUNICIPALITY_CODE = "74276";
const TSE_UF = "pr";

const OFFICE_CODES = {
  governador: { code: "0003", label: "Governador" },
  senador: { code: "0005", label: "Senador" },
  deputado_federal: { code: "0006", label: "Deputado Federal" },
  deputado_estadual: { code: "0007", label: "Deputado Estadual" },
} as const;

type OfficeKey = keyof typeof OFFICE_CODES;

type TseCandidate = {
  n?: string | number;
  nm?: string;
  cc?: string;
  e?: string;
  st?: string;
  vap?: string | number;
  pvap?: string | number;
};

type TseResult = {
  tf?: string;
  e?: string | number;
  c?: string | number;
  a?: string | number;
  tv?: string | number;
  vvc?: string | number;
  vv?: string | number;
  vb?: string | number;
  tvn?: string | number;
  vn?: string | number;
  vnt?: string | number;
  cand?: TseCandidate[];
};

function numberFromTse(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value !== "string") return 0;

  const normalized = value.trim().replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isElected(candidate: TseCandidate) {
  if (String(candidate.e || "").toLocaleLowerCase("pt-BR") === "s") return true;

  const status = String(candidate.st || "")
    .trim()
    .toLocaleLowerCase("pt-BR");
  return status.startsWith("eleito") || status === "2º turno" || status === "2o turno";
}

function partyLabel(value: unknown) {
  const label = String(value || "").trim();
  if (!label) return "—";

  // No EA04, `cc` e a sigla do partido isolado ou a composicao da coligacao.
  // Mantemos o valor oficial sem tentar inferir outro partido.
  return label;
}

async function fetchTseMunicipalResult(officeCode: string) {
  const candidates = [
    `https://resultados.tse.jus.br/oficial/ele2022/${TSE_ELECTION_CODE}/dados/${TSE_UF}/${TSE_UF}${TSE_MUNICIPALITY_CODE}-c${officeCode}-e000${TSE_ELECTION_CODE}-v.json`,
    `https://resultados.tse.jus.br/oficial/ele2022/${TSE_ELECTION_CODE}/dados-simplificados/${TSE_UF}/${TSE_UF}${TSE_MUNICIPALITY_CODE}-c${officeCode}-e000${TSE_ELECTION_CODE}-r.json`,
  ];

  let lastStatus = 0;
  for (const url of candidates) {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 86400 },
    });
    lastStatus = response.status;
    if (!response.ok) continue;

    const payload = (await response.json()) as TseResult;
    if (Array.isArray(payload.cand)) {
      return { payload, sourceUrl: url };
    }
  }

  throw new Error(`TSE respondeu sem resultado municipal (status ${lastStatus || "indisponível"}).`);
}

export async function GET(request: NextRequest) {
  const office = request.nextUrl.searchParams.get("office") as OfficeKey | null;
  if (!office || !(office in OFFICE_CODES)) {
    return NextResponse.json(
      {
        error: "Cargo inválido.",
        allowed: Object.keys(OFFICE_CODES),
      },
      { status: 400 },
    );
  }

  const definition = OFFICE_CODES[office];

  try {
    const { payload, sourceUrl } = await fetchTseMunicipalResult(definition.code);
    const candidates = (payload.cand || [])
      .map((candidate) => ({
        name: String(candidate.nm || "Candidato não identificado").trim(),
        ballotNumber: String(candidate.n ?? "").trim(),
        party: partyLabel(candidate.cc),
        votes: numberFromTse(candidate.vap),
        percentage: numberFromTse(candidate.pvap),
        elected: isElected(candidate),
        situation: String(candidate.st || (isElected(candidate) ? "Eleito" : "Não eleito")).trim(),
      }))
      .sort((a, b) => b.votes - a.votes);

    const totalValidVotes = numberFromTse(payload.vv) || numberFromTse(payload.vvc);
    const blankVotes = numberFromTse(payload.vb);
    const nullVotes = numberFromTse(payload.tvn) || numberFromTse(payload.vn) + numberFromTse(payload.vnt);
    const totalElectorate = numberFromTse(payload.e);
    const abstentions = numberFromTse(payload.a);

    if (!candidates.length || !totalElectorate) {
      throw new Error("O TSE retornou um arquivo sem a totalização esperada para Arapongas.");
    }

    return NextResponse.json(
      {
        office: {
          office,
          officeLabel: definition.label,
          year: 2022,
          totalValidVotes,
          blankVotes,
          nullVotes,
          abstentions,
          totalElectorate,
          coverage: "complete",
          sourceLabel: "TSE — Resultados oficiais 2022 em Arapongas/PR, 100% das seções",
          candidates,
        },
        source: {
          authority: "Tribunal Superior Eleitoral (TSE)",
          url: sourceUrl,
          final: String(payload.tf || "").toLocaleLowerCase("pt-BR") === "s",
        },
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível consultar os resultados oficiais do TSE.",
      },
      { status: 502 },
    );
  }
}
