export type ProposedJournalLine = { accountCode: string; debit: string; credit: string };

function toMinorUnits(amount: string): number {
  if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(amount)) throw new Error("قيمة مالية غير صالحة");
  const [whole, decimal = ""] = amount.split(".");
  return Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
}

export function assertBalancedJournalLines(lines: ProposedJournalLine[]) {
  if (lines.length < 2) throw new Error("القيد يحتاج سطرين على الأقل");
  let debitTotal = 0;
  let creditTotal = 0;
  for (const line of lines) {
    if (!line.accountCode.trim()) throw new Error("رمز الحساب مطلوب");
    const debit = toMinorUnits(line.debit);
    const credit = toMinorUnits(line.credit);
    if ((debit === 0 && credit === 0) || (debit > 0 && credit > 0)) throw new Error("كل سطر يجب أن يكون مدينًا أو دائنًا فقط");
    debitTotal += debit;
    creditTotal += credit;
  }
  if (debitTotal === 0 || debitTotal !== creditTotal) throw new Error("القيد غير متوازن");
}

export function addMoney(left: string, right: string) {
  const total = toMinorUnits(left) + toMinorUnits(right);
  return `${Math.floor(total / 100)}.${String(total % 100).padStart(2, "0")}`;
}

export function compareMoney(left: string, right: string) {
  const a = toMinorUnits(left); const b = toMinorUnits(right);
  return a === b ? 0 : a > b ? 1 : -1;
}

export function invoicePointsToAward(input: {
  isEnabled: boolean | number;
  minimumAmount: string;
  invoiceTotal: string;
  customerId?: number | null;
}) {
  if (!input.isEnabled) return null;
  if (!input.customerId) return null;
  if (compareMoney(input.invoiceTotal, input.minimumAmount) < 0) return null;
  const points = Math.floor(toMinorUnits(input.invoiceTotal) / 100);
  if (points <= 0) return null;
  return { points, customerId: input.customerId, kind: "earn" as const };
}
