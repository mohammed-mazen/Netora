import { trpc } from "@/lib/trpc";
import { Gift, Plus, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const moneyRe = /^\d{1,10}(?:\.\d{1,2})?$/;

export function PointsPanel({ organizationSlug }: { organizationSlug: string }) {
  const utils = trpc.useUtils();
  const [minimumAmount, setMinimumAmount] = useState("0"); const [isEnabled, setIsEnabled] = useState(false);
  const [tierName, setTierName] = useState(""); const [tierPoints, setTierPoints] = useState("100");
  const [customerId, setCustomerId] = useState(""); const [ledgerKind, setLedgerKind] = useState<"earn" | "redeem" | "adjust">("earn"); const [points, setPoints] = useState("10"); const [reason, setReason] = useState("");

  const settingsQuery = trpc.points.settings.get.useQuery({ organizationSlug }, { enabled: Boolean(organizationSlug), retry: false });
  const tiersQuery = trpc.points.tiers.list.useQuery({ organizationSlug }, { enabled: Boolean(organizationSlug), retry: false });
  const ledgerQuery = trpc.points.ledger.list.useQuery({ organizationSlug, limit: 25, offset: 0 }, { enabled: Boolean(organizationSlug), retry: false });
  useEffect(() => { if (settingsQuery.data) { setMinimumAmount(settingsQuery.data.minimumAmount); setIsEnabled(Boolean(settingsQuery.data.isEnabled)); } }, [settingsQuery.data]);
  const saveSettings = trpc.points.settings.save.useMutation({ onSuccess: async () => { toast.success("تم حفظ إعدادات النقاط."); await utils.points.settings.get.invalidate(); }, onError: e => toast.error(e.message) });
  const createTier = trpc.points.tiers.create.useMutation({ onSuccess: async () => { setTierName(""); toast.success("تم إنشاء مستوى المزايا."); await utils.points.tiers.list.invalidate(); }, onError: e => toast.error(e.message) });
  const postLedger = trpc.points.ledger.post.useMutation({ onSuccess: async () => { setReason(""); toast.success("تم تسجيل حركة النقاط."); await utils.points.ledger.list.invalidate(); }, onError: e => toast.error(e.message) });

  if (!organizationSlug) return <section className="rounded-2xl border border-dashed border-violet-200 bg-violet-50/60 p-5 text-xs text-slate-600">اختر مؤسسة أولًا لإدارة برنامج النقاط والولاء.</section>;

  return <div className="space-y-5">
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(23,35,61,.035)]">
      <h2 className="text-sm font-bold text-slate-900"><Star className="ml-2 inline h-4 w-4 text-violet-600" />إعدادات النقاط</h2>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={isEnabled} onChange={e => setIsEnabled(e.target.checked)} />تفعيل برنامج النقاط</label>
        <input value={minimumAmount} onChange={e => setMinimumAmount(e.target.value)} dir="ltr" placeholder="الحد الأدنى للشراء" className="h-9 rounded-xl border border-slate-200 px-3 text-left text-xs outline-none" />
        <button disabled={saveSettings.isPending} onClick={() => { if (!moneyRe.test(minimumAmount)) { toast.error("الحد الأدنى غير صالح."); return; } saveSettings.mutate({ organizationSlug, minimumAmount, isEnabled }); }} className="rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-60">حفظ</button>
      </div>
    </section>

    <div className="grid gap-5 md:grid-cols-2">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(23,35,61,.035)]"><h3 className="text-sm font-bold text-slate-900"><Gift className="ml-2 inline h-4 w-4 text-violet-600" />مستويات المزايا</h3><div className="mt-3 flex gap-2"><input value={tierName} onChange={e => setTierName(e.target.value)} placeholder="اسم المستوى" className="h-9 flex-1 rounded-xl border border-slate-200 px-3 text-xs outline-none" /><input value={tierPoints} onChange={e => setTierPoints(e.target.value.replace(/\D/g, ""))} placeholder="نقاط مطلوبة" dir="ltr" className="h-9 w-28 rounded-xl border border-slate-200 px-3 text-left text-xs outline-none" /><button disabled={createTier.isPending} onClick={() => { if (!tierName.trim()) { toast.error("أدخل اسم المستوى."); return; } createTier.mutate({ organizationSlug, name: tierName.trim(), requiredPoints: Number(tierPoints) || 0 }); }} className="rounded-xl bg-violet-600 px-3 text-xs font-bold text-white disabled:opacity-60"><Plus className="h-3.5 w-3.5" /></button></div><ul className="mt-3 space-y-1 text-xs">{tiersQuery.data?.map(t => <li key={t.id} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2"><span className="font-bold text-slate-700">{t.name}</span><span className="text-slate-500">{t.requiredPoints} نقطة</span></li>) ?? <li className="text-slate-400">لا توجد مستويات بعد.</li>}</ul></section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(23,35,61,.035)]"><h3 className="text-sm font-bold text-slate-900">تسجيل حركة نقاط</h3><div className="mt-3 grid gap-2"><input value={customerId} onChange={e => setCustomerId(e.target.value.replace(/\D/g, ""))} placeholder="رقم العميل" dir="ltr" className="h-9 rounded-xl border border-slate-200 px-3 text-left text-xs outline-none" /><div className="flex gap-2"><select value={ledgerKind} onChange={e => setLedgerKind(e.target.value as typeof ledgerKind)} className="h-9 flex-1 rounded-xl border border-slate-200 bg-white px-2 text-xs outline-none"><option value="earn">كسب</option><option value="redeem">استبدال</option><option value="adjust">تعديل</option></select><input value={points} onChange={e => setPoints(e.target.value)} dir="ltr" placeholder="النقاط" className="h-9 w-24 rounded-xl border border-slate-200 px-3 text-left text-xs outline-none" /></div><input value={reason} onChange={e => setReason(e.target.value)} placeholder="السبب (اختياري)" className="h-9 rounded-xl border border-slate-200 px-3 text-xs outline-none" /><button disabled={postLedger.isPending} onClick={() => { if (!customerId || !Number(points)) { toast.error("أدخل رقم عميل ونقاطًا صحيحة."); return; } postLedger.mutate({ organizationSlug, customerId: Number(customerId), kind: ledgerKind, points: Number(points), reason: reason.trim() || undefined }); }} className="inline-flex h-9 items-center justify-center gap-1 rounded-xl bg-violet-600 text-xs font-bold text-white disabled:opacity-60"><Plus className="h-3.5 w-3.5" />تسجيل</button></div></section>
    </div>

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(23,35,61,.035)]"><div className="border-b border-slate-100 px-5 py-4"><h2 className="text-sm font-bold text-slate-900">سجل حركة النقاط</h2></div><div className="overflow-x-auto"><table className="min-w-[520px] w-full text-right text-xs"><thead className="bg-slate-50 text-[11px] text-slate-500"><tr><th className="px-5 py-2">العميل</th><th>النوع</th><th>النقاط</th><th className="px-5">السبب</th></tr></thead><tbody>{ledgerQuery.data?.map(entry => <tr key={entry.id} className="border-t border-slate-100"><td className="px-5 py-2 text-slate-700">#{entry.customerId}</td><td className="text-slate-500">{entry.kind}</td><td dir="ltr" className="text-slate-700">{entry.points}</td><td className="px-5 text-slate-500">{entry.reason ?? "—"}</td></tr>) ?? <tr><td colSpan={4} className="py-8 text-center text-slate-400">لا توجد حركات بعد.</td></tr>}</tbody></table></div></section>
  </div>;
}
