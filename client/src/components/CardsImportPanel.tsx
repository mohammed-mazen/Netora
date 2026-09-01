import { trpc } from "@/lib/trpc";
import { FileArchive, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function CardsImportPanel({ organizationSlug }: { organizationSlug: string }) {
  const utils = trpc.useUtils();
  const [source, setSource] = useState<"csv" | "mikrotik_sqlite" | "mikrotik_wizard">("csv");
  const [content, setContent] = useState("voucher-1001\nvoucher-1002\nvoucher-1002\nabc");
  const [planId, setPlanId] = useState("");

  const jobsQuery = trpc.cards.imports.list.useQuery({ organizationSlug, limit: 25, offset: 0 }, { enabled: Boolean(organizationSlug), retry: false });
  const plansQuery = trpc.workspace.servicePlans.list.useQuery({ organizationSlug, limit: 100, offset: 0, status: "active" }, { enabled: Boolean(organizationSlug), retry: false });
  const createMutation = trpc.cards.imports.create.useMutation({
    onSuccess: async result => {
      toast.success(`تم إنشاء مهمة الاستيراد #${result.id}.`);
      await utils.cards.imports.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  if (!organizationSlug) return <section className="rounded-2xl border border-dashed border-violet-200 bg-violet-50/60 p-5 text-xs text-slate-600">اختر مؤسسة أولًا لاستيراد الكروت.</section>;

  return <div className="space-y-5">
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(23,35,61,.035)]">
      <h2 className="text-sm font-bold text-slate-900"><FileArchive className="ml-2 inline h-4 w-4 text-violet-600" />استيراد الكروت</h2>
      <p className="mt-2 text-xs leading-6 text-slate-500">أنشئ مهمة استيراد من CSV أو SQLite أو معالج MikroTik مع كشف التكرارات والأخطاء وحدود السعة.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-[200px_220px_1fr]">
        <select value={source} onChange={event => setSource(event.target.value as typeof source)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none"><option value="csv">CSV</option><option value="mikrotik_sqlite">MikroTik SQLite</option><option value="mikrotik_wizard">MikroTik Wizard</option></select>
        <select value={planId} onChange={event => setPlanId(event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none"><option value="">اختر باقة مفعّلة</option>{(plansQuery.data ?? []).map(plan => <option key={plan.id} value={String(plan.id)}>{plan.name}</option>)}</select>
        <button disabled={createMutation.isPending} onClick={() => { if (!planId) { toast.error("اختر باقة مفعّلة أولاً."); return; } createMutation.mutate({ organizationSlug, source, content, servicePlanId: Number(planId) }); }} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 text-xs font-bold text-white disabled:opacity-60"><Upload className="h-3.5 w-3.5" />إطلاق مهمة الاستيراد</button>
        <textarea value={content} onChange={event => setContent(event.target.value)} rows={8} className="rounded-2xl border border-slate-200 px-3 py-3 text-xs outline-none md:col-span-3" dir="ltr" placeholder="الصق محتوى الملف أو الأكواد هنا..." />
      </div>
    </section>

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(23,35,61,.035)]">
      <div className="border-b border-slate-100 px-5 py-4"><h3 className="text-sm font-bold text-slate-900">مهام الاستيراد</h3></div>
      <div className="overflow-x-auto"><table className="min-w-[820px] w-full text-right text-xs"><thead className="bg-slate-50 text-[11px] text-slate-500"><tr><th className="px-5 py-3">المصدر</th><th>الحالة</th><th>الإجمالي</th><th>المستورد</th><th>المكرر</th><th>غير الصالح</th><th>تجاوز السعة</th><th className="px-5">ملاحظات</th></tr></thead><tbody>{(jobsQuery.data ?? []).map(job => <tr key={job.id} className="border-t border-slate-100"><td className="px-5 py-3 font-bold text-slate-800">{job.source}</td><td className="text-slate-500">{job.status}</td><td>{job.totalRows}</td><td>{job.importedRows}</td><td>{job.duplicateRows}</td><td>{job.invalidRows}</td><td>{job.quotaExceeded ? "نعم" : "لا"}</td><td className="px-5 text-slate-500">{job.errorLog || "—"}</td></tr>)}{!jobsQuery.data?.length && <tr><td colSpan={8} className="px-5 py-10 text-center text-slate-400">لا توجد مهام استيراد بعد.</td></tr>}</tbody></table></div>
    </section>
  </div>;
}
