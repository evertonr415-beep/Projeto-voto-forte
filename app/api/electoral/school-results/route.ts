import { createInflateRaw } from "node:zlib";
import { PassThrough } from "node:stream";
import { getAccount } from "../../../server-identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

type ParsedResult = {
  candidates: CandidateAggregate[];
  totalNominalVotes: number;
  matchedRows: number;
};

const memoryCache = new Map<string, { expiresAt: number; value: unknown }>();

class WebStreamReader {
  private reader: ReadableStreamDefaultReader<Uint8Array>;
  private pending = Buffer.alloc(0);

  constructor(stream: ReadableStream<Uint8Array>) {
    this.reader = stream.getReader();
  }

  async readExactly(size: number): Promise<Buffer> {
    while (this.pending.length < size) {
      const { done, value } = await this.reader.read();
      if (done || !value) throw new Error("ZIP do TSE terminou antes do esperado.");
      this.pending = Buffer.concat([this.pending, Buffer.from(value)]);
    }
    const result = this.pending.subarray(0, size);
    this.pending = this.pending.subarray(size);
    return result;
  }

  async discard(size: number) {
    let remaining = size;
    while (remaining > 0) {
      const take = Math.min(remaining, 64 * 1024);
      await this.readExactly(take);
      remaining -= take;
    }
  }

  async pipeBytes(size: number, target: PassThrough) {
    let remaining = size;
    while (remaining > 0) {
      const take = Math.min(remaining, 64 * 1024);
      const chunk = await this.readExactly(take);
      if (!target.write(chunk)) {
        await new Promise<void>((resolve) => target.once("drain", resolve));
      }
      remaining -= take;
    }
    target.end();
  }

  async cancel() {
    try {
      await this.reader.cancel();
    } catch {
      // request already consumed/closed
    }
  }
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

async function parseCsvStream(
  input: NodeJS.ReadableStream,
  officeNormalized: string,
  sections: number[],
): Promise<ParsedResult> {
  const decoder = new TextDecoder("windows-1252");
  const sectionSet = new Set(sections.map(Number));
  const aggregate = new Map<string, CandidateAggregate>();
  let carry = "";
  let index: Record<string, number> | null = null;
  let matchedRows = 0;

  const processLine = (rawLine: string) => {
    const line = rawLine.replace(/\r$/, "");
    if (!index) {
      const header = parseCsvLine(line).map((value) => value.replace(/^\uFEFF/, "").trim());
      index = Object.fromEntries(header.map((name, position) => [name, position]));
      const required = ["CD_MUNICIPIO", "NR_ZONA", "NR_SECAO", "DS_CARGO", "NR_VOTAVEL", "NM_VOTAVEL", "QT_VOTOS"];
      for (const field of required) {
        if (index[field] === undefined) throw new Error(`Campo ${field} ausente no arquivo oficial do TSE.`);
      }
      return;
    }

    if (!line || !line.includes(ARAPONGAS_CODE)) return;
    const row = parseCsvLine(line);
    if (String(row[index.CD_MUNICIPIO] || "").trim() !== ARAPONGAS_CODE) return;
    if (Number(row[index.NR_ZONA]) !== ARAPONGAS_ZONE) return;
    if (!sectionSet.has(Number(row[index.NR_SECAO]))) return;
    if (normalize(row[index.DS_CARGO] || "") !== officeNormalized) return;

    const number = String(row[index.NR_VOTAVEL] || "").trim();
    const name = String(row[index.NM_VOTAVEL] || "").trim();
    const party = index.SG_PARTIDO === undefined ? "" : String(row[index.SG_PARTIDO] || "").trim();
    const votes = Number(String(row[index.QT_VOTOS] || "0").replace(",", ".")) || 0;
    if (!name || votes <= 0) return;

    matchedRows += 1;
    const key = candidateKey(number, name, party);
    const current = aggregate.get(key) || { number, name, party, votes: 0 };
    current.votes += votes;
    aggregate.set(key, current);
  };

  for await (const rawChunk of input as AsyncIterable<Uint8Array>) {
    carry += decoder.decode(rawChunk, { stream: true });
    let newline = carry.indexOf("\n");
    while (newline >= 0) {
      processLine(carry.slice(0, newline));
      carry = carry.slice(newline + 1);
      newline = carry.indexOf("\n");
    }
  }
  carry += decoder.decode();
  if (carry.trim()) processLine(carry);

  const candidates = [...aggregate.values()].sort(
    (a, b) => b.votes - a.votes || a.name.localeCompare(b.name, "pt-BR"),
  );
  return {
    candidates,
    totalNominalVotes: candidates.reduce((sum, candidate) => sum + candidate.votes, 0),
    matchedRows,
  };
}

async function readCsvFromZip(
  response: Response,
  officeNormalized: string,
  sections: number[],
): Promise<ParsedResult> {
  if (!response.body) throw new Error("TSE retornou resposta sem conteúdo.");
  const streamReader = new WebStreamReader(response.body);

  try {
    for (let entryIndex = 0; entryIndex < 12; entryIndex += 1) {
      const signatureBuffer = await streamReader.readExactly(4);
      const signature = signatureBuffer.readUInt32LE(0);
      if (signature !== 0x04034b50) {
        throw new Error("Formato ZIP do TSE não reconhecido para leitura em streaming.");
      }

      const fixed = await streamReader.readExactly(26);
      const flags = fixed.readUInt16LE(2);
      const method = fixed.readUInt16LE(4);
      const compressedSize = fixed.readUInt32LE(14);
      const nameLength = fixed.readUInt16LE(22);
      const extraLength = fixed.readUInt16LE(24);
      const name = (await streamReader.readExactly(nameLength)).toString("utf8");
      if (extraLength) await streamReader.discard(extraLength);

      if (flags & 0x0008) {
        throw new Error("ZIP do TSE usa descritor de dados incompatível com o streaming atual.");
      }

      const isCsv = name.toLowerCase().endsWith(".csv");
      if (!isCsv) {
        await streamReader.discard(compressedSize);
        continue;
      }

      const compressedStream = new PassThrough();
      let csvStream: NodeJS.ReadableStream;
      if (method === 0) {
        csvStream = compressedStream;
      } else if (method === 8) {
        csvStream = compressedStream.pipe(createInflateRaw());
      } else {
        throw new Error(`Método ZIP não suportado pelo TSE: ${method}.`);
      }

      const parsing = parseCsvStream(csvStream, officeNormalized, sections);
      await streamReader.pipeBytes(compressedSize, compressedStream);
      return await parsing;
    }
    throw new Error("CSV de votação por seção não encontrado no pacote do TSE.");
  } finally {
    await streamReader.cancel();
  }
}

async function loadSchoolResults(year: number, office: string, sections: number[]) {
  const source = SOURCES[year];
  if (!source) throw new Error("Ano eleitoral não suportado.");
  const officeNormalized = normalize(office);
  if (!ALLOWED_OFFICES[year]?.includes(officeNormalized)) {
    throw new Error("Cargo não disponível para este ano eleitoral.");
  }

  const sortedSections = [...new Set(sections)].sort((a, b) => a - b);
  const cacheKey = `${year}:${officeNormalized}:${sortedSections.join(",")}`;
  const cached = memoryCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const response = await fetch(source, {
    cache: "force-cache",
    redirect: "follow",
    headers: {
      "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
      accept: "application/zip,application/octet-stream;q=0.9,*/*;q=0.8",
      "accept-language": "pt-BR,pt;q=0.9,en;q=0.8",
      referer: "https://dadosabertos.tse.jus.br/",
      "sec-fetch-dest": "document",
      "sec-fetch-mode": "navigate",
      "sec-fetch-site": "same-site",
    },
  });
  if (!response.ok) throw new Error(`TSE respondeu ${response.status} ao carregar a votação por seção.`);

  const parsed = await readCsvFromZip(response, officeNormalized, sortedSections);
  const result = {
    year,
    office: officeNormalized,
    source,
    sections: sortedSections,
    candidates: parsed.candidates,
    totalNominalVotes: parsed.totalNominalVotes,
    matchedRows: parsed.matchedRows,
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
    const message = error instanceof Error ? error.message : "Falha ao processar dados oficiais do TSE.";
    console.error("[school-results]", { year, office, sections, message });
    return Response.json({ error: message }, { status: 502 });
  }
}
