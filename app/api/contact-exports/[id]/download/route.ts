import { getAccount } from "../../../../server-identity";

const HEADERS = [
  "Nome",
  "WhatsApp",
  "Perfil",
  "Bairro",
  "CEP",
  "Rua",
  "Número",
  "Liderança",
  "Responsável",
];

type ExportRow = {
  id: string;
  format: "csv" | "xlsx" | "vcf";
  created_at: string;
};

type ExportItemRow = {
  owner_email: string;
  snapshot: Record<string, unknown>;
};

function cell(value: unknown) {
  return String(value ?? "");
}

function rowsFromItems(items: ExportItemRow[]) {
  return items.map((item) => {
    const snapshot = item.snapshot ?? {};
    return [
      cell(snapshot.name),
      cell(snapshot.phone),
      cell(snapshot.kind),
      cell(snapshot.district),
      cell(snapshot.cep),
      cell(snapshot.street),
      cell(snapshot.number),
      cell(snapshot.leader),
      item.owner_email,
    ];
  });
}

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const account = await getAccount();
  if (!account)
    return Response.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await context.params;
  const { data: exportData, error: exportError } = await account.supabase
    .from("vf_contact_exports")
    .select("id,format,created_at")
    .eq("id", id)
    .maybeSingle();

  if (exportError)
    return Response.json({ error: exportError.message }, { status: 400 });
  if (!exportData)
    return Response.json({ error: "Exportação não encontrada" }, { status: 404 });

  const items: ExportItemRow[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await account.supabase
      .from("vf_contact_export_items")
      .select("owner_email,snapshot")
      .eq("export_id", id)
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error)
      return Response.json({ error: error.message }, { status: 400 });

    const page = (data ?? []) as ExportItemRow[];
    items.push(...page);
    if (page.length < pageSize) break;
  }

  const exportRow = exportData as ExportRow;
  const format = exportRow.format;
  const date = new Date(exportRow.created_at).toISOString().slice(0, 10);
  const rows = rowsFromItems(items);
  const commonHeaders = {
    "Cache-Control": "private, no-store, max-age=0",
  };

  if (format === "vcf") {
    const content = items
      .map((item) => {
        const snapshot = item.snapshot ?? {};
        return [
          "BEGIN:VCARD",
          "VERSION:3.0",
          `FN:${cell(snapshot.name).replace(/[\r\n]/g, " ")}`,
          `TEL;TYPE=CELL:${cell(snapshot.phone).replace(/[\r\n]/g, " ")}`,
          `NOTE:${cell(snapshot.kind).replace(/[\r\n]/g, " ")} - Voto Forte Paraná`,
          "END:VCARD",
        ].join("\r\n");
      })
      .join("\r\n");
    return new Response(content, {
      headers: {
        ...commonHeaders,
        "Content-Type": "text/vcard; charset=utf-8",
        "Content-Disposition": `attachment; filename="contatos-voto-forte-${date}.vcf"`,
      },
    });
  }

  if (format === "xlsx") {
    const XLSX = await import("xlsx");
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([HEADERS, ...rows]),
      "Contatos",
    );
    const arrayBuffer = XLSX.write(workbook, {
      type: "array",
      bookType: "xlsx",
    }) as ArrayBuffer;
    return new Response(arrayBuffer, {
      headers: {
        ...commonHeaders,
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="contatos-voto-forte-${date}.xlsx"`,
      },
    });
  }

  const csv =
    "\ufeff" +
    [HEADERS, ...rows]
      .map((row) => row.map((value) => csvCell(String(value))).join(";"))
      .join("\r\n");
  return new Response(csv, {
    headers: {
      ...commonHeaders,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="contatos-voto-forte-${date}.csv"`,
    },
  });
}
