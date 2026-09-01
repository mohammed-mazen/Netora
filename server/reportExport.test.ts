import { describe, expect, it } from "vitest";
import { renderReportCsv, renderReportExcel, renderReportPdf } from "./reportExport";

const columns = ["id", "name"];
const rows = [
  { id: 1, name: "عميل أ" },
  { id: 2, name: "Customer B" },
];

describe("report export formats", () => {
  it("renders CSV with quoted cells", () => {
    const csv = renderReportCsv(columns, rows);
    expect(csv).toContain("id,name");
    expect(csv).toContain("\"عميل أ\"");
  });

  it("renders SpreadsheetML that Excel can open without extra packages", () => {
    const xml = renderReportExcel("customers", columns, rows);
    expect(xml).toContain("<?xml");
    expect(xml).toContain("Workbook");
    expect(xml).toContain("عميل أ");
    expect(xml).toContain("Customer B");
    expect(xml).toContain("<Cell");
  });

  it("renders a text PDF with the report title and row values", () => {
    const pdf = renderReportPdf("customers", columns, rows);
    expect(pdf.slice(0, 5).toString("utf8")).toBe("%PDF-");
    const text = pdf.toString("latin1");
    expect(text).toContain("customers");
    expect(text).toContain("Customer B");
  });
});
