import { trpc } from "@/lib/trpc";
import { FileBarChart2, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const DATASETS = ["customers", "invoices", "payments", "vouchers", "sessions", "journal_entries", "support_tickets"] as const;

export function ReportBuilderPanel({ organizationSlug }: { organizationSlug: string }) {
  const utils = trpc.useUtils();
  const [name, setName] = useState(""); const [dataset, setDataset] = useState<typeof DATASETS[number]>("customers"); const [columns, setColumns] = useState("id,name");
  const [scheduleDefId, setScheduleDefId] = useState(""); const [frequency, setFrequency] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [exportFormat, setExportFormat] = useState<"csv" | "excel" | "pdf">("csv");

  const definitionsQuery = trpc.reportBuilder.definitions.list.useQuery({ organizationSlug }, { enabled: Boolean(organizationSlug), retry: false });
  const schedulesQuery = trpc.reportBuilder.schedules.list.useQuery({ organizationSlug }, { enabled: Boolean(organizationSlug), retry: false });
  const exportsQuery = trpc.reportBuilder.exports.list.useQuery({ organizationSlug, limit: 25, offset: 0 }, { enabled: Boolean(organizationSlug), retry: false });
  const createDefinition = trpc.reportBuilder.definitions.create.useMutation({ onSuccess: async () => { setName(""); toast.success("تم إنشاء تعريف التقرير."); await utils.reportBuilder.definitions.list.invalidate(); }, onError: e => toast.error(e.message) });
  const createSchedule = trpc.reportBuilder.schedules.create.useMutation({ onSuccess: async () => { toast.success("تم إنشاء الجدولة."); await utils.reportBuilder.schedules.list.invalidate(); }, onError: e => toast.error(e.message) });
  const generateExport = trpc.reportBuilder.exports.generate.useMutation({ onSuccess: async () => { toast.success("تم توليد التصدير."); await utils.reportBuilder.exports.list.invalidate(); }, onError: e => toast.error(e.message) });

  if (!organizationSlug) return <section className="rounded-2xl border border-dashed border-violet-200 bg-violet-50/60 p-5 text-xs text-slate-600">اختر مؤسسة أولًا لبناء تقاريرها المخصصة.</section>;

  return <div className="space-y-5">
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(23,35,61,.035)]">
      <h2 className="text-sm font-bold text-slate-900"><FileBarChart2 className="ml-2 inline h-4 w-4 text-violet-600" />منشئ التقارير</h2>
      <div className="mt-4 grid gap-2 md:grid-cols-4">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="اسم التقرير" className="h-9 rounded-xl border border-slate-200 px-3 text-xs outline-none" />
        <select value={dataset} onChange={e => setDataset(e.target.value as typeof dataset)} className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-xs outline-none">{DATASETS.map(d => <option key={d} value={d}>{d}</option>)}</select>
        <input value={columns} onChange={e => setColumns(e.target.value)} dir="ltr" placeholder="أعمدة مفصولة بفواصل" className="h-9 rounded-xl border border-slate-200 px-3 text-left text-xs outline-none" />
        <button disabled={createDefinition.isPending} onClick={() => { const cols = columns.split(",").map(c => c.trim()).filter(Boolean); if (!name.trim() || !cols.length) { toast.error("أدخل اسمًا وعمودًا واحدًا على الأقل."); return; } createDefinition.mutate({ organizationSlug, name: name.trim(), dataset, columns: cols }); }} className="inline-flex h-9 items-center justify-center gap-1 rounded-xl bg-violet-600 text-xs font-bold text-white disabled:opacity-60"><Plus className="h-3.5 w-3.5" />إنشاء</button>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs">
        <span className="text-slate-500">صيغة التصدير</span>
        <select value={exportFormat} onChange={e => setExportFormat(e.target.value as typeof exportFormat)} className="h-8 rounded-xl border border-slate-200 bg-white px-2 text-xs outline-none">
          <option value="csv">CSV</option>
          <option value="excel">Excel</option>
          <option value="pdf">PDF</option>
        </select>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">{definitionsQuery.data?.map(d => <span key={d.id} className="rounded-xl border border-slate-200 px-3 py-2 text-xs"><span className="font-bold text-slate-800">{d.name}</span><span className="mx-2 text-[10px] text-slate-400">{d.dataset}</span><button onClick={() => generateExport.mutate({ organizationSlug, reportDefinitionId: d.id, format: exportFormat })} className="text-[11px] font-bold text-violet-600">تصدير الآن</button></span>) ?? <span className="text-xs text-slate-400">لا توجد تعريفات تقارير بعد.</span>}</div>
    </section>

    <div className="grid gap-5 md:grid-cols-2">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(23,35,61,.035)]"><h3 className="text-sm font-bold text-slate-900">الجدولات الدورية</h3><div className="mt-3 flex gap-2"><select value={scheduleDefId} onChange={e => setScheduleDefId(e.target.value)} className="h-9 flex-1 rounded-xl border border-slate-200 bg-white px-2 text-xs outline-none"><option value="">اختر تعريفًا</option>{definitionsQuery.data?.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select><select value={frequency} onChange={e => setFrequency(e.target.value as typeof frequency)} className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-xs outline-none"><option value="daily">يومي</option><option value="weekly">أسبوعي</option><option value="monthly">شهري</option></select><button disabled={createSchedule.isPending} onClick={() => { if (!scheduleDefId) { toast.error("اختر تعريف تقرير."); return; } createSchedule.mutate({ organizationSlug, reportDefinitionId: Number(scheduleDefId), frequency }); }} className="rounded-xl bg-violet-600 px-3 text-xs font-bold text-white disabled:opacity-60"><Plus className="h-3.5 w-3.5" /></button></div><ul className="mt-3 space-y-1 text-xs">{schedulesQuery.data?.map(s => <li key={s.id} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2"><span className="font-bold text-slate-700">{s.reportName}</span><span className="text-slate-500">{s.frequency}</span></li>) ?? <li className="text-slate-400">لا توجد جدولات بعد.</li>}</ul></section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(23,35,61,.035)]"><h3 className="text-sm font-bold text-slate-900">التصديرات</h3><ul className="mt-3 space-y-1 text-xs">{exportsQuery.data?.map(x => <li key={x.id} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2"><span className="font-bold text-slate-700">{x.reportName}</span><span className="text-slate-500">{x.status} · {x.rowCount} صف</span></li>) ?? <li className="text-slate-400">لا توجد تصديرات بعد.</li>}</ul></section>
    </div>
  </div>;
}
