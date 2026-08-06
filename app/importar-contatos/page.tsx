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

type ParsedCsv = {
  contacts: Contact[];
  totalRows: number;
  invalid: number;
  duplicates: number;
};

const BATCH_SIZE = 500;
const MAX_CONTACTS = 150_000;

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function normalizePhone(value: string) {
  let normalized = value.replace(/\D/g, "");
  if ((normalized.length === 12 || normalized.length === 13) && normalized.startsWith("55"))
    normalized = normalized.slice(2);
  return normalized;
}

function isValidPhone(value: string) {
  return /^[1-9]\d{9,10}$/.test(value) && !/^(\d)\1+$/.test(value);
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
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

function parseCsv(text: string): ParsedCsv {
  const clean = text.replace(/^\uFEFF/, "").replace(/\r/g, "");
  const lines = clean.split("\n").filter((line) => line.trim());
  if (lines.length < 2)
    return { contacts: [], totalRows: 0, invalid: 0, duplicates: 0 };

  const dataLines = lines.slice(1);
  if (dataLines.length > MAX_CONTACTS)
    throw new Error(
      `O arquivo possui ${dataLines.length.toLocaleString("pt-BR")} linhas. O limite é ${MAX_CONTACTS.toLocaleString("pt-BR")} por importação.`,
    );

  const delimiter =
    (lines[0].match(/;/g)?.length ?? 0) >=
    (lines[0].match(/,/g)?.length ?? 0)
      ? ";"
      : ",";
  const headers = parseDelimitedLine(lines[0], delimiter).map(normalize);
  const indexOf = (...names: string[]) =>
    headers.findIndex((header) => names.includes(header));
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

  if (indexes.name < 0 || indexes.phone < 0)
    throw new Error(
      "O arquivo precisa ter as colunas Nome e Telefone/WhatsApp.",
    );

  const unique = new Map<string, Contact>();
  let invalid = 0;
  let duplicates = 0;

  for (const line of dataLines) {
    const cells = parseDelimitedLine(line, delimiter);
    const get = (index: number) =>
      index >= 0 ? String(cells[index] ?? "").trim() : "";
    const name = get(indexes.name);
    const phone = get(indexes.phone);
    const normalizedPhone = normalizePhone(phone);

    if (!name || !isValidPhone(normalizedPhone)) {
      invalid++;
      continue;
    }

    if (unique.has(normalizedPhone)) {
      duplicates++;
      continue;
    }

    unique.set(normalizedPhone, {
      name,
      phone,
      district: get(indexes.district),
      leader: get(indexes.leader),
      kind:
        normalize(get(indexes.kind)) === "lideranca"
          ? "Liderança"
          : "Eleitor",
      cep: get(indexes.cep),
      street: get(indexes.street),
      number: get(indexes.number),
      city: get(indexes.city),
      state: get(indexes.state),
    });
  }

  return {
    contacts: [...unique.values()],
    totalRows: dataLines.length,
    invalid,
    duplicates,
  };
}

async function sendBatch(
  contacts: Contact[],
  importSessionId: string,
  importBatchId: string,
  attempt = 1,
): Promise<Result> {
  try {
    const response = await apiFetch("/api/records/import-contacts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contacts, importSessionId, importBatchId }),
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.error || "Falha ao importar o lote");
    return data as Result;
  } catch (error) {
    if (attempt >= 3) throw error;
    await new Promise((resolve) =>
      window.setTimeout(resolve, attempt * 2000),
    );
    return sendBatch(
      contacts,
      importSessionId,
      importBatchId,
      attempt + 1,
    );
  }
}

export default function BulkContactImportPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [fileName, setFileName] = useState("");
  const [fileFingerprint, setFileFingerprint] = useState("");
  const [running, setRunning] = useState(false);
  const [processed, setProcessed] = useState(0);
  const [totalRows, setTotalRows] = useState(0);
  const [invalidInFile, setInvalidInFile] = useState(0);
  const [duplicatesInFile, setDuplicatesInFile] = useState(0);
  const [result, setResult] = useState<Result>({
    inserted: 0,
    duplicates: 0,
    invalid: 0,
    failed: 0,
  });
  const [message, setMessage] = useState("");
  const cancelled = useRef(false);

  const totalBatches = Math.ceil(contacts.length / BATCH_SIZE);
  const progress = totalRows
    ? Math.min(100, Math.round((processed / totalRows) * 100))
    : 0;
  const uniquePhones = useMemo(
    () =>
      new Set(
        contacts.map((contact) => normalizePhone(contact.phone)).filter(Boolean),
      ).size,
    [contacts],
  );

  async function chooseFile(file?: File) {
    if (!file) return;
    setMessage("Lendo e validando o arquivo...");
    setResult({ inserted: 0, duplicates: 0, invalid: 0, failed: 0 });
    setProcessed(0);

    try {
      const text = await file.text();
      const [parsed, fingerprint] = await Promise.all([
        Promise.resolve(parseCsv(text)),
        sha256(text),
      ]);
      setContacts(parsed.contacts);
      setTotalRows(parsed.totalRows);
      setInvalidInFile(parsed.invalid);
      setDuplicatesInFile(parsed.duplicates);
      setFileFingerprint(fingerprint);
      setFileName(file.name);
      setMessage(
        parsed.contacts.length
          ? `${parsed.totalRows.toLocaleString("pt-BR")} linhas analisadas e ${parsed.contacts.length.toLocaleString("pt-BR")} contatos únicos válidos encontrados.`
          : "Nenhum contato válido foi encontrado.",
      );
    } catch (error) {
      setContacts([]);
      setTotalRows(0);
      setFileFingerprint("");
      setFileName(file.name);
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível ler o arquivo.",
      );
    }
  }

  async function startImport() {
    if (!contacts.length || !fileFingerprint || running) return;
    cancelled.current = false;
    setRunning(true);
    setProcessed(invalidInFile + duplicatesInFile);
    let summary: Result = {
      inserted: 0,
      duplicates: duplicatesInFile,
      invalid: invalidInFile,
      failed: 0,
    };
    setResult(summary);
    setMessage(
      `Importando ${contacts.length.toLocaleString("pt-BR")} contatos em lotes de ${BATCH_SIZE}. Duplicados já existentes serão descartados automaticamente.`,
    );

    for (let start = 0; start < contacts.length; start += BATCH_SIZE) {
      if (cancelled.current) break;
      const batch = contacts.slice(start, start + BATCH_SIZE);
      const batchNumber = Math.floor(start / BATCH_SIZE);
      const importBatchId = `${fileFingerprint}:${batchNumber}`;

      try {
        const current = await sendBatch(
          batch,
          fileFingerprint,
          importBatchId,
        );
        summary = {
          inserted: summary.inserted + current.inserted,
          duplicates: summary.duplicates + current.duplicates,
          invalid: summary.invalid + current.invalid,
          failed: summary.failed + current.failed,
        };
      } catch (error) {
        summary.failed += batch.length;
        setMessage(
          `O lote ${batchNumber + 1} falhou após 3 tentativas. A importação foi interrompida com segurança: ${error instanceof Error ? error.message : "erro desconhecido"}.`,
        );
        setResult(summary);
        setProcessed(
          Math.min(invalidInFile + duplicatesInFile + start, totalRows),
        );
        setRunning(false);
        return;
      }

      setResult(summary);
      setProcessed(
        Math.min(invalidInFile + duplicatesInFile + start + batch.length, totalRows),
      );
    }

    setRunning(false);
    if (cancelled.current) {
      setMessage(
        "Importação pausada. Os lotes concluídos permanecem salvos. Selecione o mesmo arquivo novamente para continuar; os números já gravados serão reconhecidos automaticamente.",
      );
    } else {
      setProcessed(totalRows);
      setMessage("Importação concluída. Confira o relatório abaixo.");
    }
  }

  return (
    <main className="bulk-import-page">
      <section className="bulk-import-card">
        <a className="back-link" href="/">
          ← Voltar ao Voto Forte
        </a>
        <small>IMPORTAÇÃO SEGURA EM MASSA</small>
        <h1>Importar até 150.000 contatos</h1>
        <p>
          O arquivo é validado antes do envio e processado em lotes de{" "}
          {BATCH_SIZE}. Telefones repetidos no arquivo ou já existentes no
          sistema são ignorados automaticamente.
        </p>

        <label className="bulk-file-picker">
          Selecionar arquivo CSV
          <input
            type="file"
            accept=".csv,text/csv"
            disabled={running}
            onChange={(event) => void chooseFile(event.target.files?.[0])}
          />
        </label>

        {fileName && (
          <div className="file-summary">
            <b>{fileName}</b>
            <span>{totalRows.toLocaleString("pt-BR")} linhas no arquivo</span>
            <span>
              {uniquePhones.toLocaleString("pt-BR")} telefones únicos válidos
            </span>
            <span>
              {duplicatesInFile.toLocaleString("pt-BR")} duplicados no arquivo
            </span>
            <span>{invalidInFile.toLocaleString("pt-BR")} inválidos</span>
            <span>Até {totalBatches} lotes</span>
          </div>
        )}

        {contacts.length > 0 && (
          <>
            <div className="progress-block">
              <div>
                <span>Progresso</span>
                <b>{progress}%</b>
              </div>
              <progress max={totalRows || 1} value={processed} />
              <small>
                {processed.toLocaleString("pt-BR")} de{" "}
                {totalRows.toLocaleString("pt-BR")} processados
              </small>
            </div>

            <div className="import-report">
              <div>
                <b>{result.inserted.toLocaleString("pt-BR")}</b>
                <span>Inseridos</span>
              </div>
              <div>
                <b>{result.duplicates.toLocaleString("pt-BR")}</b>
                <span>Duplicados</span>
              </div>
              <div>
                <b>{result.invalid.toLocaleString("pt-BR")}</b>
                <span>Inválidos</span>
              </div>
              <div>
                <b>{result.failed.toLocaleString("pt-BR")}</b>
                <span>Falharam</span>
              </div>
            </div>

            <div className="bulk-actions">
              <button
                className="start-button"
                disabled={running}
                onClick={() => void startImport()}
              >
                {running
                  ? "Importando…"
                  : `Iniciar importação de ${contacts.length.toLocaleString("pt-BR")}`}
              </button>
              {running && (
                <button
                  className="pause-button"
                  onClick={() => {
                    cancelled.current = true;
                  }}
                >
                  Pausar após o lote atual
                </button>
              )}
            </div>
          </>
        )}

        {message && (
          <div className="bulk-message" role="status">
            {message}
          </div>
        )}
        <p className="bulk-note">
          Mantenha uma cópia do arquivo original e deixe esta página aberta. Em
          caso de interrupção, selecione o mesmo arquivo novamente: os telefones
          já salvos serão reconhecidos como duplicados e a carga continuará com
          os restantes.
        </p>
      </section>
    </main>
  );
}
