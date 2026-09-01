import { trpc } from "@/lib/trpc";
import { Clock3, DatabaseBackup, Plus, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export function BackupSchedulingPanel({ organizationSlug }: { organizationSlug: string }) {
  const utils = trpc.useUtils();
  const [frequency, setFrequency] = useState<"every_6h" | "every_12h" | "daily" | "weekly">("daily");
  const [retentionDays, setRetentionDays] = useState("30");
  const [isEnabled, setIsEnabled] = useState(true);

  const scheduleQuery = trpc.backup.schedule.get.useQuery({ organizationSlug }, { enabled: Boolean(organizationSlug), retry: false });
  const jobsQuery = trpc.backup.list.useQuery({ organizationSlug, limit: 12, offset: 0 }, { enabled: Boolean(organizationSlug), retry: false });
  const saveMutation = trpc.backup.schedule.save.useMutation({ onSuccess: async () => { toast.success("تم حفظ الجدولة."); await Promise.all([utils.backup.schedule.get.invalidate(), utils.backup.list.invalidate()]); }, onError: error => toast.error(error.message) });
  const createMutation = trpc.backup.create.useMutation({ onSuccess: async () => { toast.success("تم إنشاء نسخة يدوية."); await utils.backup.list.invalidate(); }, onError: error => toast.error(error.message) });

  useEffect(() => {
    if (!scheduleQuery.data) return;
    setFrequency(scheduleQuery.data.frequency);
    setRetentionDays(String(scheduleQuery.data.retentionDays));
    setIsEnabled(Boolean(scheduleQuery.data.isEnabled));
  }, [scheduleQuery.data]);

  if (!organizationSlug) return <section className="rounded-2xl border border-dashed border-violet-200 bg-violet-50/60 p-5 text-xs text-slate-600">اختر مؤسسة أولًا لإدارة جدولة النسخ الاحتياطية.</section>;

  return <div className="grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(23,35,61,.035)]">
      <h2 className="text-sm font-bold text-slate-900"><DatabaseBackup className="ml-2 inline h-4 w-4 text-violet-600" />جدولة النسخ الاحتياطية</h2>
      <p className="mt-2 text-xs leading-6 text-slate-500">حدّد تكرار النسخ والاحتفاظ الزمني وتشغيل المهمة التلقائية لكل مؤسسة.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2"><select value={frequency} onChange={event => setFrequency(event.target.value as typeof frequency)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none"><option value="every_6h">كل 6 ساعات</option><option value="every_12h">كل 12 ساعة</option><option value="daily">يومي</option><option value="weekly">أسبوعي</option></select><input value={retentionDays} onChange={event => setRetentionDays(event.target.value)} inputMode="numeric" placeholder="أيام الاحتفاظ" className="h-10 rounded-xl border border-slate-200 px-3 text-xs outline-none" /><div className="flex items-center gap-3 rounded-xl border border-slate-200 px-3"><input id="backup-enabled" type="checkbox" checked={isEnabled} onChange={event => setIsEnabled(event.target.checked)} className="h-4 w-4" /><label htmlFor="backup-enabled" className="text-xs font-medium text-slate-700">تشغيل الجدولة</label></div><button disabled={saveMutation.isPending} onClick={() => saveMutation.mutate({ organizationSlug, frequency, retentionDays: Number(retentionDays || 0), isEnabled })} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 text-xs font-bold text-white disabled:opacity-60"><Save className="h-3.5 w-3.5" />حفظ الجدولة</button></div>
      <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600"><p>آخر تشغيل: {scheduleQuery.data?.lastRunAt ? new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short" }).format(scheduleQuery.data.lastRunAt) : "—"}</p><p className="mt-2">التشغيل القادم: {scheduleQuery.data?.nextRunAt ? new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short" }).format(scheduleQuery.data.nextRunAt) : "—"}</p><button disabled={createMutation.isPending} onClick={() => createMutation.mutate({ organizationSlug })} className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700"><Plus className="h-3.5 w-3.5" />إنشاء نسخة يدوية</button></div>
    </section>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(23,35,61,.035)]"><div className="border-b border-slate-100 px-5 py-4"><h3 className="text-sm font-bold text-slate-900"><Clock3 className="ml-2 inline h-4 w-4 text-violet-600" />سجل النسخ</h3></div><div className="overflow-x-auto"><table className="min-w-[520px] w-full text-right text-xs"><thead className="bg-slate-50 text-[11px] text-slate-500"><tr><th className="px-5 py-3">الحالة</th><th>الحجم</th><th className="px-5">التاريخ</th></tr></thead><tbody>{(jobsQuery.data ?? []).map(job => <tr key={job.id} className="border-t border-slate-100"><td className="px-5 py-3 font-bold text-slate-800">{job.status}</td><td className="text-slate-500">{job.sizeBytes ? `${(job.sizeBytes / 1024).toFixed(1)} KB` : "—"}</td><td className="px-5 text-slate-500">{new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short" }).format(job.createdAt)}</td></tr>)}{!jobsQuery.data?.length && <tr><td colSpan={3} className="px-5 py-10 text-center text-slate-400">لا توجد نسخ احتياطية بعد.</td></tr>}</tbody></table></div></section>
  </div>;
}
