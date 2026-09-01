export type ImportedVoucher = { code: string; serial?: string };

function readCsvLine(line: string) {
  const values: string[] = []; let value = ""; let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') { value += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) { values.push(value.trim()); value = ""; }
    else value += char;
  }
  if (quoted) throw new Error("يوجد اقتباس CSV غير مكتمل");
  values.push(value.trim());
  return values;
}

export function parseVoucherCsv(content: string) {
  const lines = content.replace(/^\uFEFF/, "").split(/\r?\n/).filter(line => line.trim());
  if (!lines.length) throw new Error("ملف CSV فارغ");
  const header = readCsvLine(lines[0]).map(value => value.toLowerCase());
  const codeIndex = header.indexOf("code");
  const serialIndex = header.indexOf("serial");
  if (codeIndex < 0) throw new Error("يجب أن يبدأ الملف برأس code");
  if (lines.length > 5001) throw new Error("الحد الأقصى للاستيراد هو 5000 صف");
  const accepted: ImportedVoucher[] = [];
  const seen = new Set<string>();
  let rejected = 0;
  let duplicates = 0;
  for (const line of lines.slice(1)) {
    const values = readCsvLine(line);
    const code = values[codeIndex]?.trim();
    const serial = serialIndex >= 0 ? values[serialIndex]?.trim() : undefined;
    if (!code || code.length < 4 || code.length > 80) { rejected += 1; continue; }
    const key = code.toLowerCase();
    if (seen.has(key)) { duplicates += 1; continue; }
    seen.add(key);
    accepted.push(serial ? { code, serial } : { code });
  }
  return { accepted, rejected, duplicates };
}

export function planVoucherInserts(input: {
  accepted: ImportedVoucher[];
  existingCodeKeys: Set<string>;
  existingSerials: Set<string>;
  importReference: string;
}) {
  const inserts: Array<{ code: string; serial: string }> = [];
  let skippedExisting = 0;
  let serialConflicts = 0;
  const width = Math.max(4, String(input.accepted.length).length);
  input.accepted.forEach((row, index) => {
    if (input.existingCodeKeys.has(row.code.toLowerCase())) {
      skippedExisting += 1;
      return;
    }
    const serial = row.serial?.trim() || `${input.importReference}-${String(index + 1).padStart(width, "0")}`;
    if (input.existingSerials.has(serial) || inserts.some(item => item.serial === serial)) {
      serialConflicts += 1;
      return;
    }
    inserts.push({ code: row.code, serial });
  });
  return { inserts, skippedExisting, serialConflicts };
}
