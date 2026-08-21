import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const YEARS = [2020, 2022, 2024];
const MUNICIPALITY_CODE = '74276';
const MUNICIPALITY_NAME = 'ARAPONGAS';
const OUTPUT = path.resolve('artifacts/electoral-panel-official-data.json');

function parseCsvLine(line) {
  const out = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') { current += '"'; i += 1; }
      else quoted = !quoted;
    } else if (char === ';' && !quoted) { out.push(current); current = ''; }
    else current += char;
  }
  out.push(current);
  return out;
}

function normalize(value) { return String(value ?? '').trim().toUpperCase(); }

function download(url, destination) {
  execFileSync('curl', [
    '--fail','--location','--silent','--show-error','--retry','3','--retry-all-errors',
    '--connect-timeout','20','--max-time','180',
    '--user-agent','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126 Safari/537.36',
    '--referer','https://dadosabertos.tse.jus.br/',
    '--header','Accept: application/zip,application/octet-stream,*/*',
    '--output',destination,url,
  ], { stdio: 'inherit' });
  const stat = fs.statSync(destination);
  if (!stat.size) throw new Error(`Download vazio: ${url}`);
}

function unzipFirstCsv(zipPath, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  execFileSync('unzip', ['-o', '-q', zipPath, '-d', outDir]);
  const files = fs.readdirSync(outDir).filter((name) => name.toLowerCase().endsWith('.csv'));
  if (!files.length) throw new Error(`Nenhum CSV encontrado em ${zipPath}`);
  return path.join(outDir, files[0]);
}

function readFilteredCsv(csvPath) {
  const raw = fs.readFileSync(csvPath).toString('latin1');
  const lines = raw.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return { headers: [], rows: [] };
  const headers = parseCsvLine(lines[0]).map((h) => h.replace(/^\uFEFF/, '').trim());
  const codeIndex = headers.indexOf('CD_MUNICIPIO');
  const nameIndex = headers.indexOf('NM_MUNICIPIO');
  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const values = parseCsvLine(lines[i]);
    const code = codeIndex >= 0 ? normalize(values[codeIndex]) : '';
    const name = nameIndex >= 0 ? normalize(values[nameIndex]) : '';
    if (code !== MUNICIPALITY_CODE && name !== MUNICIPALITY_NAME) continue;
    const row = {};
    headers.forEach((header, idx) => { row[header] = values[idx] ?? ''; });
    rows.push(row);
  }
  return { headers, rows };
}

function numeric(row, keys) {
  for (const key of keys) {
    if (!(key in row)) continue;
    const value = Number(String(row[key]).replace(',', '.'));
    if (Number.isFinite(value)) return value;
  }
  return 0;
}

function summarizeVotes(rows) {
  const cargos = new Map();
  for (const row of rows) {
    const key = String(row.DS_CARGO || row.CD_CARGO || 'SEM_CARGO').trim();
    const votes = numeric(row, ['QT_VOTOS', 'QT_VOTOS_NOMINAIS', 'QT_VOTOS_VALIDOS']);
    const current = cargos.get(key) || { rows: 0, votes: 0, sections: new Set(), candidates: new Set() };
    current.rows += 1; current.votes += votes;
    if (row.NR_SECAO) current.sections.add(String(row.NR_SECAO));
    if (row.NM_VOTAVEL) current.candidates.add(String(row.NM_VOTAVEL));
    cargos.set(key, current);
  }
  return Object.fromEntries([...cargos.entries()].map(([key, value]) => [key, {
    rows: value.rows, votes: value.votes, sections: value.sections.size, candidates: value.candidates.size,
  }]));
}

function summarizeLocations(rows) {
  const names = new Set(); const zones = new Set(); let electorate = 0;
  for (const row of rows) {
    const name = row.NM_LOCAL_VOTACAO || row.DS_LOCAL_VOTACAO || row.NM_LOCAL || '';
    if (name) names.add(String(name).trim());
    if (row.NR_ZONA) zones.add(String(row.NR_ZONA));
    electorate += numeric(row, ['QT_ELEITORES', 'QT_ELEITOR', 'QT_ELEITORES_PERFIL']);
  }
  return { rows: rows.length, locations: names.size, zones: [...zones].sort(), electorate };
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'votoforte-tse-'));
const result = { municipality: { tseCode: MUNICIPALITY_CODE, name: MUNICIPALITY_NAME, uf: 'PR' }, generatedAt: new Date().toISOString(), source: 'Tribunal Superior Eleitoral - Portal de Dados Abertos', years: {} };

for (const year of YEARS) {
  const voteUrl = `https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_secao/votacao_secao_${year}_PR.zip`;
  const locationUrl = `https://cdn.tse.jus.br/estatistica/sead/odsele/eleitorado_locais_votacao/eleitorado_local_votacao_${year}.zip`;
  const voteZip = path.join(tempRoot, `votes-${year}.zip`);
  const locationZip = path.join(tempRoot, `locations-${year}.zip`);
  console.log(`Baixando TSE ${year}...`);
  download(voteUrl, voteZip);
  download(locationUrl, locationZip);
  const voteCsv = unzipFirstCsv(voteZip, path.join(tempRoot, `votes-${year}`));
  const locationCsv = unzipFirstCsv(locationZip, path.join(tempRoot, `locations-${year}`));
  const votes = readFilteredCsv(voteCsv);
  const locations = readFilteredCsv(locationCsv);
  if (!votes.rows.length) throw new Error(`Nenhuma votação oficial encontrada para Arapongas em ${year}`);
  if (!locations.rows.length) throw new Error(`Nenhum local oficial encontrado para Arapongas em ${year}`);
  result.years[year] = { sources: { voteUrl, locationUrl }, voteColumns: votes.headers, locationColumns: locations.headers, voteSummary: summarizeVotes(votes.rows), locationSummary: summarizeLocations(locations.rows), votes: votes.rows, locations: locations.rows };
}

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, JSON.stringify(result, null, 2));
console.log(`Artefato oficial gerado: ${OUTPUT}`);
