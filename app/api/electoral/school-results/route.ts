import { inflateRawSync } from "node:zlib";
import { getAccount } from "../../../server-identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ARAPONGAS_CODE = "74276";
const ARAPONGAS_ZONE = 61;

const SOURCES: Record<number, string> = {
  2024: "https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_secao/votacao_secao_2024_PR.zip",
  2022: "https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_secao/votacao_secao_2022_PR.zip",
};

const ALLOWED_OFFICES: Record<number, string[]> = {
  2024: ["PREFEITO", "VEREADOR"],
  2022: ["PRESIDENTE", "GOVERNADOR", "SENADOR", "DEPUTADO FEDERAL", "DEPUTADO ESTADUAL"],
};

type CandidateAggregate = {
  number: string;
  name: string;
  party: string;
  votes: number;
};

type ZipEntry = {
  name: string;
  method: number;
  compressedSize: number;
  localOffset: number;
};

const memoryCache = new Map<string, { expiresAt: number; value: unknown }>();

function findEocd(buffer: Buffer) {
  const sig = 0x06054b50;
  const min = Math.max(0, buffer.length - 65557);
  for (let offset = buffer.length - 22; offset >= min; offset -= 1) {
    if (buffer.readUInt32LE(offset) === sig) return offset;
  }
  throw new Error("Arquivo ZIP do TSE sem diretório central reconhecível.");
}

function listZipEntries(buffer: Buffer): ZipEntry[] {
  const eocd = findEocd(buffer);
  const entries = buffer.readUInt16LE(eocd + 10);
  const centralOffset = buffer.readUInt32LE(eocd + 16);
  const result: ZipEntry[] = [];
  let offset = centralOffset;
  for (let i = 0; i < entries; i += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) break;
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");
    result.push({ name, method, compressedSize, localOffset });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return result;
}

function extractZipEntry(buffer: Buffer, entry: ZipEntry) {
  const offset = entry.localOffset;
  if (buffer.readUInt32LE(offset) !== 0x04034b50) {
    throw new Error("Entrada ZIP inválida na base do TSE.");
  }
  const nameLength = buffer.readUInt16LE(offset + 26);
  const extraLength = buffer.readUInt16LE(offset + 28);
  const dataStart = offset + 30 + nameLength + extraLength;
  const compressed = buffer.subarray(dataStart, dataStart + entry.compressedSize);
  if (entry.method === 0) return compressed;
  if (entry.method === 8) return inflateRawSync(compressed);
  throw new Error(`Método ZIP não suportado: ${entry.method}`);
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (char === ";" && !quoted) {
      values.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  values.push(current);
  return values;
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function candidateKey(number: string, name: string, party: string) {
  return `${number}|${name}|${party}`;
}

async function loadSchoolResults(year: number, office: string, sections: number[]) {
  const source = SOURCES[year];
  if (!source) throw new Error("Ano eleitoral não suportado.");
  const officeNormalized = normalize(office);
  if (!ALLOWED_OFFICES[year]?.includes(officeNormalized)) {
    throw new Error("Cargo não disponível para este ano eleitoral.");
  }

  const cacheKey = `${year}:${officeNormalized}:${[...sections].sort((a, b) => a - b).join(",")}`;
  const cached = memoryCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const response = await fetch(source, {
    cache: "force-cache",
    headers: { "user-agent": "VotoForte/1.0 school-results" },
  });
  if (!response.ok) throw new Error(`TSE respondeu ${response.status} ao carregar a votação por seção.`);

  const zip = Buffer.from(await response.arrayBuffer());
  const entry = listZipEntries(zip).find((item) => item.name.toLowerCase().endsWith(".csv"));
  if (!entry) throw new Error("CSV de votação por seção não encontrado no pacote do TSE.");
  const csvBuffer = extractZipEntry(zip, entry);
  const text = new TextDecoder("windows-1252").decode(csvBuffer);
  const lines = text.split(/\r?\n/);
  if (!lines.length) throw new Error("CSV do TSE vazio.");

  const header = parseCsvLine(lines[0]).map((value) => value.replace(/^\uFEFF/, "").trim());
  const index = Object.fromEntries(header.map((name, position) => [name, position]));
  const required = ["CD_MUNICIPIO", "NR_ZONA", "NR_SECAO", "DS_CARGO", "NR_VOTAVEL", "NM_VOTAVEL", "QT_VOTOS"];
  for (const field of required) {
    if (index[field] === undefined) throw new Error(`Campo ${field} ausente no arquivo oficial do TSE.`);
  }

  const sectionSet = new Set(sections.map(Number));
  const aggregate = new Map<string, CandidateAggregate>();
  let matchedRows = 0;

  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    if (!line || !line.includes(ARAPONGAS_CODE)) continue;
    const row = parseCsvLine(line);
    if (String(row[index.CD_MUNICIPIO] || "").trim() !== ARAPONGAS_CODE) continue;
    if (Number(row[index.NR_ZONA]) !== ARAPONGAS_ZONE) continue;
    if (!sectionSet.has(Number(row[index.NR_SECAO]))) continue;
    if (normalize(row[index.DS_CARGO] || "") !== officeNormalized) continue;

    const number = String(row[index.NR_VOTAVEL] || "").trim();
    const name = String(row[index.NM_VOTAVEL] || "").trim();
    const party = index.SG_PARTIDO === undefined ? "" : String(row[index.SG_PARTIDO] || "").trim();
    const votes = Number(String(row[index.QT_VOTOS] || "0").replace(",", ".")) || 0;
    if (!name || votes <= 0) continue;
    matchedRows += 1;
    const key = candidateKey(number, name, party);
    const current = aggregate.get(key) || { number, name, party, votes: 0 };
    current.votes += votes;
    aggregate.set(key, current);
  }

  const candidates = [...aggregate.values()].sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name, "pt-BR"));
  const totalNominalVotes = candidates.reduce((sum, candidate) => sum + candidate.votes, 0);
  const result = {
    year,
    office: officeNormalized,
    source,
    sections: [...sectionSet].sort((a, b) => a - b),
    candidates,
    totalNominalVotes,
    matchedRows,
    generatedAt: new Date().toISOString(),
  };
  memoryCache.set(cacheKey, { expiresAt: Date.now() + 6 * 60 * 60 * 1000, value: result });
  return result;
}

export async function GET(request: Request) {
  const account = await getAccount();
  if (!account) return Response.json({ error: "Não autenticado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const year = Number(searchParams.get("year"));
  const office = searchParams.get("office") || "";
  const sections = (searchParams.get("sections") || "")
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0);

  if (!year || !office || !sections.length) {
    return Response.json({ error: "Informe ano, cargo e seções." }, { status: 400 });
  }

  try {
    const result = await loadSchoolResults(year, office, sections);
    return Response.json(result, {
      headers: { "cache-control": "private, max-age=1800" },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Falha ao processar dados oficiais do TSE." },
      { status: 502 },
    );
  }
}
