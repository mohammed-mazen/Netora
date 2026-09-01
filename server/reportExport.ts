export type ReportExportFormat = "csv" | "excel" | "pdf";

function cellText(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function escapeCsvCell(value: unknown): string {
  return JSON.stringify(cellText(value));
}

export function renderReportCsv(columns: string[], rows: Record<string, unknown>[]): string {
  return [columns.join(","), ...rows.map((row) => columns.map((column) => escapeCsvCell(row[column])).join(","))].join("\n");
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function renderReportExcel(title: string, columns: string[], rows: Record<string, unknown>[]): string {
  const header = columns
    .map((column) => `<Cell><Data ss:Type="String">${escapeXml(column)}</Data></Cell>`)
    .join("");
  const body = rows
    .map((row) => {
      const cells = columns
        .map((column) => `<Cell><Data ss:Type="String">${escapeXml(cellText(row[column]))}</Data></Cell>`)
        .join("");
      return `<Row>${cells}</Row>`;
    })
    .join("");
  const sheetName = escapeXml(title.slice(0, 31) || "Sheet1");
  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Worksheet ss:Name="${sheetName}">
    <Table>
      <Row>${header}</Row>
      ${body}
    </Table>
  </Worksheet>
</Workbook>
`;
}

function escapePdfText(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

function pdfSafeLine(value: string): string {
  return escapePdfText(value.normalize("NFKD").replace(/[^\x20-\x7E]/g, "?"));
}

export function renderReportPdf(title: string, columns: string[], rows: Record<string, unknown>[]): Buffer {
  const lines = [
    pdfSafeLine(title),
    pdfSafeLine(columns.join(" | ")),
    ...rows.slice(0, 40).map((row) => pdfSafeLine(columns.map((column) => cellText(row[column])).join(" | "))),
  ];
  const contentLines = ["BT", "/F1 10 Tf", "50 780 Td"];
  lines.forEach((line, index) => {
    if (index === 0) contentLines.push(`(${line}) Tj`);
    else contentLines.push("0 -14 Td", `(${line}) Tj`);
  });
  contentLines.push("ET");
  const stream = contentLines.join("\n");
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n",
    `4 0 obj\n<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream\nendobj\n`,
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj\n",
  ];
  let offset = "%PDF-1.4\n".length;
  const xref = ["xref", "0 6", "0000000000 65535 f "];
  const body = objects.map((object) => {
    xref.push(`${String(offset).padStart(10, "0")} 00000 n `);
    offset += Buffer.byteLength(object, "utf8");
    return object;
  }).join("");
  const startxref = offset;
  return Buffer.from(`%PDF-1.4\n${body}${xref.join("\n")}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF\n`, "utf8");
}

export function reportExportPayload(format: ReportExportFormat, title: string, columns: string[], rows: Record<string, unknown>[]) {
  if (format === "excel") {
    const body = renderReportExcel(title, columns, rows);
    return { body: Buffer.from(body, "utf8"), mimeType: "application/vnd.ms-excel", extension: "xls", originalName: `${title}.xls` };
  }
  if (format === "pdf") {
    const body = renderReportPdf(title, columns, rows);
    return { body, mimeType: "application/pdf", extension: "pdf", originalName: `${title}.pdf` };
  }
  const body = renderReportCsv(columns, rows);
  return { body: Buffer.from(body, "utf8"), mimeType: "text/csv", extension: "csv", originalName: `${title}.csv` };
}
