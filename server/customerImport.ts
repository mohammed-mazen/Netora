export type ImportedCustomer = { fullName: string; username: string };

function readCsvLine(line: string) {
  const values: string[] = []; let value = ""; let quoted = false;
  for (let index = 0; index < line.length; index += 1) { const char = line[index]; if (char === '"') { if (quoted && line[index + 1] === '"') { value += '"'; index += 1; } else quoted = !quoted; } else if (char === "," && !quoted) { values.push(value.trim()); value = ""; } else value += char; }
  if (quoted) throw new Error("يوجد اقتباس CSV غير مكتمل"); values.push(value.trim()); return values;
}

export function parseCustomerCsv(content: string) {
  const lines = content.replace(/^\uFEFF/, "").split(/\r?\n/).filter(line => line.trim());
  if (!lines.length) throw new Error("ملف CSV فارغ");
  const header = readCsvLine(lines[0]).map(value => value.toLowerCase()); const nameIndex = header.indexOf("full_name"); const usernameIndex = header.indexOf("username");
  if (nameIndex < 0 || usernameIndex < 0) throw new Error("يجب أن يبدأ الملف برأسي full_name,username");
  if (lines.length > 251) throw new Error("الحد الأقصى للاستيراد هو 250 صفًا");
  const accepted: ImportedCustomer[] = []; let rejected = 0;
  for (const line of lines.slice(1)) { const values = readCsvLine(line); const fullName = values[nameIndex]?.trim(); const username = values[usernameIndex]?.trim(); if (!fullName || fullName.length < 2 || fullName.length > 160 || !username || !/^[a-zA-Z0-9._-]{3,120}$/.test(username)) { rejected += 1; continue; } accepted.push({ fullName, username }); }
  return { accepted, rejected };
}
