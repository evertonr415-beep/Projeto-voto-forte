export type LocalContactRecord = {
  id: number;
  name: string;
  phone: string;
  kind: "Eleitor" | "Liderança" | string;
  district?: string;
  cep?: string;
  street?: string;
  number?: string;
  leader?: string;
  ownerEmail?: string;
  zone?: string;
  section?: string;
  notes?: string;
  importedAt?: string;
  customData?: Record<string, string>;
};

export type LocalDatabaseMeta = {
  id: string;
  name: string;
  description?: string;
  recordCount: number;
  createdAt: string;
  updatedAt: string;
  fileName?: string;
};

const DB_NAME = "voto_forte_local_db_v1";
const DB_VERSION = 1;
const STORE_META = "databases_meta";
const STORE_RECORDS = "databases_records";
const ACTIVE_DB_KEY = "voto_forte_active_local_db_id";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB não disponível no navegador"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_RECORDS)) {
        const recordStore = db.createObjectStore(STORE_RECORDS, {
          keyPath: "uid",
        });
        recordStore.createIndex("dbId", "dbId", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Erro ao abrir banco de dados local"));
  });
}

export function getActiveLocalDatabaseId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_DB_KEY);
}

export function setActiveLocalDatabaseId(id: string | null): void {
  if (typeof window === "undefined") return;
  if (id) {
    localStorage.setItem(ACTIVE_DB_KEY, id);
  } else {
    localStorage.removeItem(ACTIVE_DB_KEY);
  }
  window.dispatchEvent(new CustomEvent("voto-forte:local-db-changed", { detail: { id } }));
}

export async function listLocalDatabases(): Promise<LocalDatabaseMeta[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_META, "readonly");
      const store = tx.objectStore(STORE_META);
      const req = store.getAll();
      req.onsuccess = () => {
        const list = (req.result || []) as LocalDatabaseMeta[];
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (error) {
    console.error("Erro ao listar bancos locais:", error);
    return [];
  }
}

export async function getLocalDatabaseMeta(dbId: string): Promise<LocalDatabaseMeta | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_META, "readonly");
      const store = tx.objectStore(STORE_META);
      const req = store.get(dbId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function createLocalDatabase(
  name: string,
  records: Omit<LocalContactRecord, "id">[],
  options?: { description?: string; fileName?: string }
): Promise<LocalDatabaseMeta> {
  const db = await openDB();
  const dbId = "db_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
  const now = new Date().toISOString();

  const meta: LocalDatabaseMeta = {
    id: dbId,
    name: name.trim() || `Base ${new Date().toLocaleDateString("pt-BR")}`,
    description: options?.description || "",
    recordCount: records.length,
    createdAt: now,
    updatedAt: now,
    fileName: options?.fileName || "",
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_META, STORE_RECORDS], "readwrite");
    const metaStore = tx.objectStore(STORE_META);
    const recordStore = tx.objectStore(STORE_RECORDS);

    metaStore.put(meta);

    records.forEach((rec, index) => {
      const item = {
        ...rec,
        id: index + 1,
        uid: `${dbId}_${index + 1}`,
        dbId,
        ownerEmail: rec.ownerEmail || "banco-local",
      };
      recordStore.put(item);
    });

    tx.oncomplete = () => {
      window.dispatchEvent(new CustomEvent("voto-forte:local-db-updated"));
      resolve(meta);
    };

    tx.onerror = () => reject(tx.error || new Error("Erro ao salvar registros na base local"));
  });
}

export async function getLocalDatabaseRecords(dbId: string): Promise<LocalContactRecord[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_RECORDS, "readonly");
    const store = tx.objectStore(STORE_RECORDS);
    const index = store.index("dbId");
    const req = index.getAll(IDBKeyRange.only(dbId));

    req.onsuccess = () => {
      const results = (req.result || []) as (LocalContactRecord & { uid: string; dbId: string })[];
      resolve(results.map((r, i) => ({ ...r, id: r.id || i + 1 })));
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteLocalDatabase(dbId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_META, STORE_RECORDS], "readwrite");
    const metaStore = tx.objectStore(STORE_META);
    const recordStore = tx.objectStore(STORE_RECORDS);

    metaStore.delete(dbId);

    const index = recordStore.index("dbId");
    const req = index.openCursor(IDBKeyRange.only(dbId));

    req.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    tx.oncomplete = () => {
      if (getActiveLocalDatabaseId() === dbId) {
        setActiveLocalDatabaseId(null);
      }
      window.dispatchEvent(new CustomEvent("voto-forte:local-db-updated"));
      resolve();
    };

    tx.onerror = () => reject(tx.error);
  });
}

// Utilitário de parsing inteligente para CSV e Excel
export async function parseLocalDatabaseFile(file: File): Promise<Omit<LocalContactRecord, "id">[]> {
  const ext = file.name.toLowerCase();

  if (ext.endsWith(".xlsx") || ext.endsWith(".xls")) {
    const X = await import("xlsx");
    const buffer = await file.arrayBuffer();
    const workbook = X.read(buffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const jsonRows = X.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    return mapRowsToContacts(jsonRows);
  }

  if (ext.endsWith(".vcf")) {
    const text = await file.text();
    return parseVcfContent(text);
  }

  // Padrão: CSV ou TXT
  const text = await file.text();
  return parseCsvContent(text);
}

function normalizeKey(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function mapRowsToContacts(rows: Record<string, unknown>[]): Omit<LocalContactRecord, "id">[] {
  const contacts: Omit<LocalContactRecord, "id">[] = [];
  const seenPhones = new Set<string>();

  for (const row of rows) {
    const rowNormalized: Record<string, string> = {};
    for (const [key, val] of Object.entries(row)) {
      rowNormalized[normalizeKey(key)] = String(val ?? "").trim();
    }

    // Busca inteligente de campos
    const name =
      rowNormalized["nome"] ||
      rowNormalized["nomecompleto"] ||
      rowNormalized["eleitor"] ||
      rowNormalized["contato"] ||
      rowNormalized["name"] ||
      "";

    const rawPhone =
      rowNormalized["whatsapp"] ||
      rowNormalized["telefone"] ||
      rowNormalized["celular"] ||
      rowNormalized["fone"] ||
      rowNormalized["tel"] ||
      rowNormalized["phone"] ||
      "";

    const district =
      rowNormalized["bairro"] ||
      rowNormalized["distrito"] ||
      rowNormalized["regiao"] ||
      rowNormalized["neighborhood"] ||
      rowNormalized["district"] ||
      "";

    const kindRaw =
      rowNormalized["perfil"] ||
      rowNormalized["tipo"] ||
      rowNormalized["cargo"] ||
      rowNormalized["kind"] ||
      "Eleitor";

    const kind =
      kindRaw.toLowerCase().includes("lider")
        ? "Liderança"
        : "Eleitor";

    const cep = rowNormalized["cep"] || "";
    const street = rowNormalized["rua"] || rowNormalized["logradouro"] || rowNormalized["endereco"] || "";
    const number = rowNormalized["numero"] || rowNormalized["num"] || "";
    const leader = rowNormalized["lideranca"] || rowNormalized["lider"] || rowNormalized["indicadopor"] || "";
    const zone = rowNormalized["zona"] || rowNormalized["zonaeleitoral"] || "";
    const section = rowNormalized["secao"] || rowNormalized["secaoeleitoral"] || "";
    const notes = rowNormalized["observacao"] || rowNormalized["obs"] || rowNormalized["notas"] || "";

    if (!name && !rawPhone) continue;

    // Formatar telefone se tiver números
    const cleanDigits = rawPhone.replace(/\D/g, "");
    let phone = rawPhone;
    if (cleanDigits.length >= 10 && cleanDigits.length <= 13) {
      phone = cleanDigits.length === 11
        ? `(${cleanDigits.slice(0, 2)}) ${cleanDigits.slice(2, 7)}-${cleanDigits.slice(7)}`
        : cleanDigits.length === 10
        ? `(${cleanDigits.slice(0, 2)}) ${cleanDigits.slice(2, 6)}-${cleanDigits.slice(6)}`
        : cleanDigits;
    }

    contacts.push({
      name: name || `Eleitor ${cleanDigits.slice(-4) || contacts.length + 1}`,
      phone: phone || "—",
      kind,
      district,
      cep,
      street,
      number,
      leader,
      zone,
      section,
      notes,
      importedAt: new Date().toISOString(),
    });
  }

  return contacts;
}

function parseCsvContent(text: string): Omit<LocalContactRecord, "id">[] {
  const clean = text.replace(/^\ufeff/, "").trim();
  if (!clean) return [];

  const lines = clean.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  // Detectar delimitador (;, ,, tab)
  const firstLine = lines[0];
  let delimiter = ",";
  const semicolons = (firstLine.match(/;/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  const tabs = (firstLine.match(/\t/g) || []).length;

  if (semicolons >= commas && semicolons >= tabs) delimiter = ";";
  else if (tabs >= commas && tabs >= semicolons) delimiter = "\t";

  function parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === delimiter && !inQuotes) {
        result.push(cur.trim());
        cur = "";
      } else {
        cur += c;
      }
    }
    result.push(cur.trim());
    return result;
  }

  const headers = parseCsvLine(lines[0]);
  const rows: Record<string, unknown>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const rowObj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      rowObj[h] = values[idx] ?? "";
    });
    rows.push(rowObj);
  }

  return mapRowsToContacts(rows);
}

function parseVcfContent(text: string): Omit<LocalContactRecord, "id">[] {
  const contacts: Omit<LocalContactRecord, "id">[] = [];
  const cards = text.split(/BEGIN:VCARD/i).slice(1);

  for (const card of cards) {
    const lines = card.split(/\r?\n/);
    let name = "";
    let phone = "";
    let district = "";
    let notes = "";

    for (const line of lines) {
      if (/^FN:/i.test(line)) {
        name = line.replace(/^FN:/i, "").trim();
      } else if (/^TEL/i.test(line)) {
        const val = line.split(":").slice(1).join(":").trim();
        if (!phone) phone = val;
      } else if (/^NOTE:/i.test(line)) {
        notes = line.replace(/^NOTE:/i, "").trim();
      } else if (/^ADR/i.test(line)) {
        const parts = line.split(":")[1]?.split(";") || [];
        district = parts[parts.length - 2]?.trim() || "";
      }
    }

    if (name || phone) {
      contacts.push({
        name: name || "Contato sem nome",
        phone: phone || "—",
        kind: "Eleitor",
        district,
        notes,
        importedAt: new Date().toISOString(),
      });
    }
  }

  return contacts;
}
