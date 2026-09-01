import { trpc } from "@/lib/trpc";
import { BookOpenCheck, Boxes, Plus, Wallet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const moneyRe = /^\d{1,10}(?:\.\d{1,2})?$/;
function Pill({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "success" | "warning" }) {
  const tones = { neutral: "bg-slate-100 text-slate-600", success: "bg-emerald-50 text-emerald-700", warning: "bg-amber-50 text-amber-700" };
  return <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${tones[tone]}`}>{label}</span>;
}

export function AccountingPanel({ organizationSlug }: { organizationSlug: string }) {
  const utils = trpc.useUtils();
  const [accountNumber, setAccountNumber] = useState(""); const [accountName, setAccountName] = useState(""); const [kind, setKind] = useState<"asset" | "liability" | "equity" | "revenue" | "expense">("asset"); const [nature, setNature] = useState<"debit" | "credit">("debit");
  const [cashBoxName, setCashBoxName] = useState(""); const [cashBoxAccountId, setCashBoxAccountId] = useState("");
  const [warehouseName, setWarehouseName] = useState("");
  const [voucherKind, setVoucherKind] = useState<"receipt" | "payment">("receipt"); const [voucherCashBoxId, setVoucherCashBoxId] = useState(""); const [voucherCounterAccountId, setVoucherCounterAccountId] = useState(""); const [voucherAmount, setVoucherAmount] = useState("0"); const [voucherDesc, setVoucherDesc] = useState("");

  const accountsQuery = trpc.accounting.chartAccounts.list.useQuery({ organizationSlug }, { enabled: Boolean(organizationSlug), retry: false });
  const cashBoxesQuery = trpc.accounting.cashBoxes.list.useQuery({ organizationSlug }, { enabled: Boolean(organizationSlug), retry: false });
  const warehousesQuery = trpc.accounting.warehouses.list.useQuery({ organizationSlug }, { enabled: Boolean(organizationSlug), retry: false });
  const vouchersQuery = trpc.accounting.cashVouchers.list.useQuery({ organizationSlug, limit: 25, offset: 0 }, { enabled: Boolean(organizationSlug), retry: false });

  const createAccount = trpc.accounting.chartAccounts.create.useMutation({ onSuccess: async () => { setAccountNumber(""); setAccountName(""); toast.success("تم إنشاء الحساب."); await utils.accounting.chartAccounts.list.invalidate(); }, onError: e => toast.error(e.message) });
  const createCashBox = trpc.accounting.cashBoxes.create.useMutation({ onSuccess: async () => { setCashBoxName(""); setCashBoxAccountId(""); toast.success("تم إنشاء الصندوق."); await Promise.all([utils.accounting.cashBoxes.list.invalidate(), utils.accounting.chartAccounts.list.invalidate()]); }, onError: e => toast.error(e.message) });
  const createWarehouse = trpc.accounting.warehouses.create.useMutation({ onSuccess: async () => { setWarehouseName(""); toast.success("تم إنشاء المخزن."); await utils.accounting.warehouses.list.invalidate(); }, onError: e => toast.error(e.message) });
  const createVoucher = trpc.accounting.cashVouchers.create.useMutation({ onSuccess: async () => { setVoucherAmount("0"); setVoucherDesc(""); toast.success("تم تسجيل السند وترصيده في القيود."); await Promise.all([utils.accounting.cashVouchers.list.invalidate(), utils.accounting.chartAccounts.list.invalidate(), utils.accounting.cashBoxes.list.invalidate()]); }, onError: e => toast.error(e.message) });

  if (!organizationSlug) return <section className="rounded-2xl border border-dashed border-violet-200 bg-violet-50/60 p-5 text-xs text-slate-600">اختر مؤسسة أولًا لإدارة المحاسبة الخاصة بها.</section>;

  return <div className="space-y-5">
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(23,35,61,.035)]">
      <div className="flex items-center justify-between"><h2 className="text-sm font-bold text-slate-900"><BookOpenCheck className="ml-2 inline h-4 w-4 text-violet-600" />دليل الحسابات الهرمي</h2><Pill label={`${accountsQuery.data?.length ?? 0} حساب`} /></div>
      <div className="mt-4 grid gap-2 md:grid-cols-5">
        <input value={accountNumber} onChange={e => setAccountNumber(e.target.value)} placeholder="رقم الحساب" dir="ltr" className="h-9 rounded-xl border border-slate-200 px-3 text-xs outline-none" />
        <input value={accountName} onChange={e => setAccountName(e.target.value)} placeholder="اسم الحساب" className="h-9 rounded-xl border border-slate-200 px-3 text-xs outline-none" />
        <select value={kind} onChange={e => setKind(e.target.value as typeof kind)} className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-xs outline-none"><option value="asset">أصول</option><option value="liability">خصوم</option><option value="equity">حقوق ملكية</option><option value="revenue">إيرادات</option><option value="expense">مصروفات</option></select>
        <select value={nature} onChange={e => setNature(e.target.value as typeof nature)} className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-xs outline-none"><option value="debit">مدين</option><option value="credit">دائن</option></select>
        <button disabled={createAccount.isPending} onClick={() => { if (!accountNumber.trim() || !accountName.trim()) { toast.error("أدخل رقم واسم الحساب."); return; } createAccount.mutate({ organizationSlug, accountNumber: accountNumber.trim(), name: accountName.trim(), kind, nature }); }} className="inline-flex h-9 items-center justify-center gap-1 rounded-xl bg-violet-600 text-xs font-bold text-white disabled:opacity-60"><Plus className="h-3.5 w-3.5" />إضافة</button>
      </div>
      <div className="mt-4 overflow-x-auto"><table className="min-w-[560px] w-full text-right text-xs"><thead className="bg-slate-50 text-[11px] text-slate-500"><tr><th className="px-3 py-2">الرقم</th><th>الاسم</th><th>النوع</th><th>الطبيعة</th><th className="px-3">الرصيد</th></tr></thead><tbody>{accountsQuery.data?.map(a => <tr key={a.id} className="border-t border-slate-100"><td dir="ltr" className="px-3 py-2 font-mono">{a.accountNumber}</td><td className="font-bold text-slate-800">{a.name}</td><td className="text-slate-500">{a.kind}</td><td className="text-slate-500">{a.nature}</td><td dir="ltr" className="px-3 text-left text-slate-700">{a.balance}</td></tr>) ?? <tr><td colSpan={5} className="py-8 text-center text-slate-400">لا توجد حسابات بعد.</td></tr>}</tbody></table></div>
    </section>

    <div className="grid gap-5 md:grid-cols-2">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(23,35,61,.035)]"><h3 className="text-sm font-bold text-slate-900"><Wallet className="ml-2 inline h-4 w-4 text-violet-600" />الصناديق النقدية</h3><div className="mt-3 flex gap-2"><input value={cashBoxName} onChange={e => setCashBoxName(e.target.value)} placeholder="اسم الصندوق" className="h-9 flex-1 rounded-xl border border-slate-200 px-3 text-xs outline-none" /><select value={cashBoxAccountId} onChange={e => setCashBoxAccountId(e.target.value)} className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-xs outline-none"><option value="">اختر حساب</option>{accountsQuery.data?.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select><button disabled={createCashBox.isPending} onClick={() => { if (!cashBoxName.trim() || !cashBoxAccountId) { toast.error("أدخل الاسم واختر حسابًا."); return; } createCashBox.mutate({ organizationSlug, name: cashBoxName.trim(), accountId: Number(cashBoxAccountId) }); }} className="rounded-xl bg-violet-600 px-3 text-xs font-bold text-white disabled:opacity-60"><Plus className="h-3.5 w-3.5" /></button></div><ul className="mt-3 space-y-1 text-xs">{cashBoxesQuery.data?.map(c => <li key={c.id} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2"><span className="font-bold text-slate-700">{c.name}</span><span dir="ltr" className="text-slate-500">{c.balance}</span></li>) ?? <li className="text-slate-400">لا توجد صناديق بعد.</li>}</ul></section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(23,35,61,.035)]"><h3 className="text-sm font-bold text-slate-900"><Boxes className="ml-2 inline h-4 w-4 text-violet-600" />المخازن</h3><div className="mt-3 flex gap-2"><input value={warehouseName} onChange={e => setWarehouseName(e.target.value)} placeholder="اسم المخزن" className="h-9 flex-1 rounded-xl border border-slate-200 px-3 text-xs outline-none" /><button disabled={createWarehouse.isPending} onClick={() => { if (!warehouseName.trim()) { toast.error("أدخل اسم المخزن."); return; } createWarehouse.mutate({ organizationSlug, name: warehouseName.trim() }); }} className="rounded-xl bg-violet-600 px-3 text-xs font-bold text-white disabled:opacity-60"><Plus className="h-3.5 w-3.5" /></button></div><ul className="mt-3 space-y-1 text-xs">{warehousesQuery.data?.map(w => <li key={w.id} className="rounded-lg bg-slate-50 px-3 py-2 font-bold text-slate-700">{w.name}</li>) ?? <li className="text-slate-400">لا توجد مخازن بعد.</li>}</ul></section>
    </div>

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(23,35,61,.035)]">
      <div className="border-b border-slate-100 px-5 py-4"><h2 className="text-sm font-bold text-slate-900">سندات القبض والصرف</h2><p className="mt-1 text-xs text-slate-500">كل سند ينشئ قيدًا متوازنًا مدين/دائن فورًا.</p></div>
      <div className="grid gap-2 p-5 md:grid-cols-6">
        <select value={voucherKind} onChange={e => setVoucherKind(e.target.value as typeof voucherKind)} className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-xs outline-none"><option value="receipt">سند قبض</option><option value="payment">سند صرف</option></select>
        <select value={voucherCashBoxId} onChange={e => setVoucherCashBoxId(e.target.value)} className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-xs outline-none"><option value="">الصندوق</option>{cashBoxesQuery.data?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <select value={voucherCounterAccountId} onChange={e => setVoucherCounterAccountId(e.target.value)} className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-xs outline-none"><option value="">الحساب الآخر</option>{accountsQuery.data?.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
        <input value={voucherAmount} onChange={e => setVoucherAmount(e.target.value)} dir="ltr" placeholder="المبلغ" className="h-9 rounded-xl border border-slate-200 px-3 text-left text-xs outline-none" />
        <input value={voucherDesc} onChange={e => setVoucherDesc(e.target.value)} placeholder="البيان" className="h-9 rounded-xl border border-slate-200 px-3 text-xs outline-none" />
        <button disabled={createVoucher.isPending} onClick={() => { if (!voucherCashBoxId || !voucherCounterAccountId || !moneyRe.test(voucherAmount)) { toast.error("تحقق من الصندوق والحساب والمبلغ."); return; } createVoucher.mutate({ organizationSlug, kind: voucherKind, cashBoxId: Number(voucherCashBoxId), counterAccountId: Number(voucherCounterAccountId), amount: voucherAmount, description: voucherDesc.trim() || undefined }); }} className="inline-flex h-9 items-center justify-center gap-1 rounded-xl bg-violet-600 text-xs font-bold text-white disabled:opacity-60"><Plus className="h-3.5 w-3.5" />تسجيل</button>
      </div>
      <div className="overflow-x-auto"><table className="min-w-[560px] w-full text-right text-xs"><thead className="bg-slate-50 text-[11px] text-slate-500"><tr><th className="px-3 py-2">المرجع</th><th>النوع</th><th>المبلغ</th><th className="px-3">الصندوق</th></tr></thead><tbody>{vouchersQuery.data?.map(v => <tr key={v.id} className="border-t border-slate-100"><td dir="ltr" className="px-3 py-2 font-mono text-[10px]">{v.reference}</td><td><Pill label={v.kind === "receipt" ? "قبض" : "صرف"} tone={v.kind === "receipt" ? "success" : "warning"} /></td><td dir="ltr" className="text-slate-700">{v.amount}</td><td className="px-3 text-slate-500">{v.cashBoxName}</td></tr>) ?? <tr><td colSpan={4} className="py-8 text-center text-slate-400">لا توجد سندات بعد.</td></tr>}</tbody></table></div>
    </section>
  </div>;
}
