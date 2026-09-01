import { trpc } from "@/lib/trpc";
import { Palette, Plus, Printer } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function CardDesignPanel({ organizationSlug }: { organizationSlug: string }) {
  const utils = trpc.useUtils();
  const [name, setName] = useState(""); const [borderColor, setBorderColor] = useState("#6d28d9");
  const [batchId, setBatchId] = useState(""); const [designId, setDesignId] = useState("");

  const designsQuery = trpc.cards.designs.list.useQuery({ organizationSlug }, { enabled: Boolean(organizationSlug), retry: false });
  const printJobsQuery = trpc.cards.printJobs.list.useQuery({ organizationSlug, limit: 25, offset: 0 }, { enabled: Boolean(organizationSlug), retry: false });
  const saveDesign = trpc.cards.designs.save.useMutation({ onSuccess: async () => { setName(""); toast.success("تم حفظ تصميم البطاقة."); await utils.cards.designs.list.invalidate(); }, onError: e => toast.error(e.message) });
  const queuePrint = trpc.cards.printJobs.queue.useMutation({ onSuccess: async () => { setBatchId(""); toast.success("تمت إضافة مهمة الطباعة إلى الطابور."); await utils.cards.printJobs.list.invalidate(); }, onError: e => toast.error(e.message) });

  if (!organizationSlug) return <section className="rounded-2xl border border-dashed border-violet-200 bg-violet-50/60 p-5 text-xs text-slate-600">اختر مؤسسة أولًا لتصميم بطاقاتها.</section>;

  return <div className="space-y-5">
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(23,35,61,.035)]">
      <h2 className="text-sm font-bold text-slate-900"><Palette className="ml-2 inline h-4 w-4 text-violet-600" />استوديو تصميم البطاقات</h2>
      <p className="mt-2 text-xs leading-6 text-slate-500">يحدد التصميم مقاس البطاقة وألوانها والعلامة المائية؛ التوليد الفعلي للـPDF يتم عبر مهمة خلفية.</p>
      <div className="mt-4 grid gap-2 md:grid-cols-4">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="اسم التصميم" className="h-9 rounded-xl border border-slate-200 px-3 text-xs outline-none" />
        <input value={borderColor} onChange={e => setBorderColor(e.target.value)} type="color" className="h-9 w-full rounded-xl border border-slate-200 px-1" />
        <button disabled={saveDesign.isPending} onClick={() => { if (!name.trim()) { toast.error("أدخل اسم التصميم."); return; } saveDesign.mutate({ organizationSlug, name: name.trim(), cardBorderColor: borderColor, fields: {} }); }} className="inline-flex h-9 items-center justify-center gap-1 rounded-xl bg-violet-600 text-xs font-bold text-white disabled:opacity-60 md:col-span-2"><Plus className="h-3.5 w-3.5" />حفظ التصميم</button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">{designsQuery.data?.map(d => <span key={d.id} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: d.cardBorderColor }} />{d.name}{d.isDefault ? <span className="rounded-full bg-violet-50 px-1.5 py-0.5 text-[10px] text-violet-600">افتراضي</span> : null}</span>) ?? <span className="text-xs text-slate-400">لا توجد تصاميم بعد.</span>}</div>
    </section>

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(23,35,61,.035)]">
      <div className="border-b border-slate-100 px-5 py-4"><h2 className="text-sm font-bold text-slate-900"><Printer className="ml-2 inline h-4 w-4 text-violet-600" />قائمة الطباعة</h2></div>
      <div className="grid gap-2 p-5 md:grid-cols-3">
        <input value={batchId} onChange={e => setBatchId(e.target.value.replace(/\D/g, ""))} placeholder="رقم دفعة البطاقات" dir="ltr" className="h-9 rounded-xl border border-slate-200 px-3 text-left text-xs outline-none" />
        <select value={designId} onChange={e => setDesignId(e.target.value)} className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-xs outline-none"><option value="">اختر تصميمًا</option>{designsQuery.data?.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
        <button disabled={queuePrint.isPending} onClick={() => { if (!batchId || !designId) { toast.error("اختر الدفعة والتصميم."); return; } queuePrint.mutate({ organizationSlug, batchId: Number(batchId), designId: Number(designId) }); }} className="inline-flex h-9 items-center justify-center gap-1 rounded-xl bg-violet-600 text-xs font-bold text-white disabled:opacity-60"><Plus className="h-3.5 w-3.5" />إضافة للطابور</button>
      </div>
      <div className="overflow-x-auto"><table className="min-w-[500px] w-full text-right text-xs"><thead className="bg-slate-50 text-[11px] text-slate-500"><tr><th className="px-5 py-2">الدفعة</th><th>التصميم</th><th className="px-5">الحالة</th></tr></thead><tbody>{printJobsQuery.data?.map(j => <tr key={j.id} className="border-t border-slate-100"><td dir="ltr" className="px-5 py-2 font-mono text-[10px]">{j.batchReference}</td><td className="font-bold text-slate-800">{j.designName}</td><td className="px-5 text-slate-500">{j.status}</td></tr>) ?? <tr><td colSpan={3} className="py-8 text-center text-slate-400">لا توجد مهام طباعة بعد.</td></tr>}</tbody></table></div>
    </section>
  </div>;
}
