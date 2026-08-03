"use client";

import { useMemo, useRef, useState } from "react";
import { apiFetch } from "../supabase-client";
import "./styles.css";

type Contact = {
  name: string;
  phone: string;
  district: string;
  leader: string;
  kind: "Eleitor" | "Liderança";
  cep: string;
  street: string;
  number: string;
  city: string;
  state: string;
};

type Result = {
  inserted: number;
  duplicates: number;
  invalid: number;
  failed: number;
};

const BATCH_SIZE = 500;

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function parseDelimitedLine(line: string, delimiter: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index++) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index++;
      } else quoted = !quoted;
    } else if (character === delimiter && !quoted) {
      cells.push(current.trim());
      current = "";
    } else current += character;
  }
  cells.push(current.trim());
  return cells;
}

function parseCsv(text: string): Contact[] {
  const clean = text.replace(/^\uFEFF/, "").replace(/\r/g, "");
  const lines = clean.split("\n").filter((line) => line.trim());
  if (lines.length < 2) return [];
  const delimiter = (lines[0].match(/;/g)?.length ?? 0) >= (lines[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const headers = parseDelimitedLine(lines[0], delimiter).map(normalize);
  const indexOf = (...names: string[]) => headers.findIndex((header) => names.includes(header));
  const indexes = {
    name: indexOf("nome", "name", "nome completo", "contato"),
    phone: indexOf("telefone", "whatsapp", "celular", "phone", "fone"),
    district: indexOf("bairro", "district"),
    leader: indexOf("lideranca", "lider", "leader", "responsavel"),
    kind: indexOf("perfil", "tipo", "kind"),
    cep: indexOf("cep"),
    street: indexOf("rua", "logradouro", "endereco", "street"),
    number: indexOf("numero", "number"),
    city: indexOf("cidade", "municipio", "city"),
    state: indexOf("uf", "estado", "state"),
  };

  return lines.slice(1).map((line) => {
    const cells = parseDelimitedLine(line, delimiter);
    const get = (index: number) => (index >= 0 ? String(cells[index] ?? "").trim() : "");
    const kind = normalize(get(indexes.kind)) === "lideranca" ? "Liderança" : "Eleitor";
    return {
      name: get(indexes.name),
      phone: get(indexes.phone),
      district: get(indexes.district),
      leader: get(indexes.leader),
      kind,
      cep: get(indexes.cep),
      street: get(indexes.street),
      number: get(indexes.number),
      city: get(indexes.city),
      state: get(indexes.state),
    } as Contact;
  }).filter((contact) => contact.name && contact.phone);
}

async function sendBatch(contacts: Contact[], attempt = 1): Promise<Result> {
  try {
    const response = await apiFetch("/api/records/import-contacts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contacts }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Falha ao importar o lote");
    return data as Result;
  } catch (error) {
    if (attempt >= 3) throw error;
    await new Promise((resolve) => window.setTimeout(resolve, attempt * 1500));
    return sendBatch(contacts, attempt + 1);
  }
}

export default function BulkContactImportPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [fileName, setFileName] = useState("");
  const [running, setRunning] = useState(false);
  const [processed, setProcessed] = useState(0);
  const [result, setResult] = useState<Result>({ inserted: 0, duplicates: 0, invalid: 0, failed: 0 });
  const [message, setMessage] = useState("");
  const cancelled = useRef(false);

  const totalBatches = Math.ceil(contacts.length / BATCH_SIZE);
  const progress = contacts.length ? Math.round((processed / contacts.length) * 100) : 0;
  const uniquePhones = useMemo(() => new Set(contacts.map((contact) => contact.phone.replace(/\D/g, "")).filter(Boolean)).size, [contacts]);

  async function chooseFile(file?: File) {
    if (!file) return;
    setMessage("");
    setResult({ inserted: 0, duplicates: 0, invalid: 0, failed: 0 });
    setProcessed(0);
    const parsed = parseCsv(await file.text());
    setContacts(parsed);
    setFileName(file.name);
    setMessage(parsed.length ? `${parsed.length.toLocaleString("pt-BR")} contatos válidos encontrados.` : "Nenhum contato válido foi encontrado. Confira os títulos Nome e Telefone/WhatsApp.");
  }

  async function startImport() {
    if (!contacts.length || running) return;
    cancelled.current = false;
    setRunning(true);
    setProcessed(0);
    setResult({ inserted: 0, duplicates: 0, invalid: 0, failed: 0 });
    setMessage("Importação iniciada. Não feche esta página.");

    let summary: Result = { inserted: 0, duplicates: 0, invalid: 0, failed: 0 };
    for (let start = 0; start < contacts.length; start += BATCH_SIZE) {
      if (cancelled.current) break;
      const batch = contacts.slice(start, start + BATCH_SIZE);
      try {
        const current = await sendBatch(batch);
        summary = {
          inserted: summary.inserted + current.inserted,
          duplicates: summary.duplicates + current.duplicates,
          invalid: summary.invalid + current.invalid,
          failed: summary.failed + current.failed,
        };
      } catch (error) {
        summary.failed += batch.length;
        setMessage(`O lote ${Math.floor(start / BATCH_SIZE) + 1} falhou após 3 tentativas. A importação foi interrompida com segurança: ${error instanceof Error ? error.message : "erro desconhecido"}.`);
        setResult(summary);
        setProcessed(start);
        setRunning(false);
        return;
      }
      setResult(summary);
      setProcessed(Math.min(start + batch.length, contacts.length));
    }

    setRunning(false);
    setMessage(cancelled.current ? "Importação pausada. Os lotes já concluídos permanecem salvos; reiniciar o mesmo arquivo ignorará duplicados." : "Importação concluída. Confira o relatório abaixo.");
  }

  return (
    <main className="bulk-import-page">
      <section className="bulk-import-card">
        <a className="back-link" href="/">← Voltar ao Voto Forte</a>
        <small>IMPORTAÇÃO SEGURA EM MASSA</small>
        <h1>Importar até 13.000 contatos</h1>
        <p>O arquivo é enviado em lotes de {BATCH_SIZE}. Cada lote tenta novamente até três vezes e telefones repetidos são ignorados.</p>

        <label className="bulk-file-picker">
          Selecionar arquivo CSV
          <input type="file" accept=".csv,text/csv" disabled={running} onChange={(event) => void chooseFile(event.target.files?.[0])} />
        </label>

        {fileName && (
          <div className="file-summary">
            <b>{fileName}</b>
            <span>{contacts.length.toLocaleString("pt-BR")} linhas válidas</span>
            <span>{uniquePhones.toLocaleString("pt-BR")} telefones únicos no arquivo</span>
            <span>{totalBatches} lotes</span>
          </div>
        )}

        {contacts.length > 0 && (
          <>
            <div className="progress-block">
              <div><span>Progresso</span><b>{progress}%</b></div>
              <progress max={contacts.length} value={processed} />
              <small>{processed.toLocaleString("pt-BR")} de {contacts.length.toLocaleString("pt-BR")} processados</small>
            </div>

            <div className="import-report">
              <div><b>{result.inserted.toLocaleString("pt-BR")}</b><span>Inseridos</span></div>
              <div><b>{result.duplicates.toLocaleString("pt-BR")}</b><span>Duplicados</span></div>
              <div><b>{result.invalid.toLocaleString("pt-BR")}</b><span>Inválidos</span></div>
              <div><b>{result.failed.toLocaleString("pt-BR")}</b><span>Falharam</span></div>
            </div>

            <div className="bulk-actions">
              <button className="start-button" disabled={running} onClick={() => void startImport()}>{running ? "Importando…" : `Iniciar importação de ${contacts.length.toLocaleString("pt-BR")}`}</button>
              {running && <button className="pause-button" onClick={() => { cancelled.current = true; }}>Pausar após o lote atual</button>}
            </div>
          </>
        )}

        {message && <div className="bulk-message" role="status">{message}</div>}
        <p className="bulk-note">Para maior segurança, mantenha uma cópia do arquivo original. Se a página for interrompida, selecione o mesmo arquivo novamente: os números já gravados serão reconhecidos como duplicados.</p>
      </section>
    </main>
  );
}
