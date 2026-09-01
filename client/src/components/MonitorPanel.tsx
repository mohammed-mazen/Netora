import { trpc } from "@/lib/trpc";
import { Gauge, Power, RotateCcw, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export function MonitorPanel({ organizationSlug }: { organizationSlug: string }) {
  const utils = trpc.useUtils();
  const settingsQuery = trpc.monitor.settings.get.useQuery({ organizationSlug }, { enabled: Boolean(organizationSlug), retry: false });
  const samplesQuery = trpc.monitor.samples.list.useQuery({ organizationSlug, limit: 30 }, { enabled: Boolean(organizationSlug), retry: false });
  const routersQuery = trpc.workspace.network.listRouters.useQuery({ organizationSlug, limit: 100, offset: 0 }, { enabled: Boolean(organizationSlug), retry: false });
  const actionsQuery = trpc.monitor.actions.list.useQuery({ organizationSlug, limit: 12, offset: 0 }, { enabled: Boolean(organizationSlug), retry: false });
  const [rebootable, setRebootable] = useState(true); const [shutdownable, setShutdownable] = useState(true); const [batteryNotification, setBatteryNotification] = useState(false); const [criticalPercentage, setCriticalPercentage] = useState(10); const [telegramChatId, setTelegramChatId] = useState("");
  const [actionRouterId, setActionRouterId] = useState("");
  useEffect(() => { if (settingsQuery.data) { setRebootable(Boolean(settingsQuery.data.rebootable)); setShutdownable(Boolean(settingsQuery.data.shutdownable)); setBatteryNotification(Boolean(settingsQuery.data.batteryNotification)); setCriticalPercentage(settingsQuery.data.batteryCriticalPercentage); setTelegramChatId(settingsQuery.data.telegramChatId ?? ""); } }, [settingsQuery.data]);
  const saveSettings = trpc.monitor.settings.save.useMutation({ onSuccess: async () => { toast.success("تم حفظ إعدادات المراقبة."); await utils.monitor.settings.get.invalidate(); }, onError: e => toast.error(e.message) });
  const runAction = trpc.monitor.action.useMutation({ onSuccess: async () => { toast.success("تم جدولة الإجراء على الراوتر."); await utils.monitor.actions.list.invalidate(); }, onError: e => toast.error(e.message) });

  if (!organizationSlug) return <section className="rounded-2xl border border-dashed border-violet-200 bg-violet-50/60 p-5 text-xs text-slate-600">اختر مؤسسة أولًا لمراقبة خادمها.</section>;

  const routers = routersQuery.data ?? [];
  const actions = actionsQuery.data ?? [];
  const confirmAction = (action: "reboot" | "shutdown") => {
    if (!actionRouterId) { toast.error("اختر الراوتر المستهدف أولاً."); return; }
    const label = action === "reboot" ? "إعادة تشغيل" : "إيقاف تشغيل";
    if (!window.confirm(`هل أنت متأكد من ${label} الراوتر المحدد عن بُعد؟ قد ينقطع الاتصال بالإنترنت مؤقتًا.`)) return;
    runAction.mutate({ organizationSlug, routerId: Number(actionRouterId), action });
  };

  return <div className="space-y-5">
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(23,35,61,.035)]">
      <h2 className="text-sm font-bold text-slate-900"><Gauge className="ml-2 inline h-4 w-4 text-violet-600" />إعدادات مراقبة الخادم</h2>
      <p className="mt-2 text-xs leading-6 text-slate-500">القراءات الفعلية تُنفَّذ عبر سكربت مراقبة خارجي؛ إعادة التشغيل والإيقاف تُرسل إلى الراوتر عبر REST API.</p>
      <div className="mt-4 flex flex-wrap gap-4 text-xs">
        <label className="flex items-center gap-2"><input type="checkbox" checked={rebootable} onChange={e => setRebootable(e.target.checked)} />السماح بإعادة التشغيل عن بُعد</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={shutdownable} onChange={e => setShutdownable(e.target.checked)} />السماح بالإيقاف عن بُعد</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={batteryNotification} onChange={e => setBatteryNotification(e.target.checked)} />تنبيه تيليجرام عند انخفاض البطارية</label>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <input value={criticalPercentage} onChange={e => setCriticalPercentage(Number(e.target.value.replace(/\D/g, "")) || 0)} placeholder="نسبة البطارية الحرجة" dir="ltr" className="h-9 rounded-xl border border-slate-200 px-3 text-left text-xs outline-none" />
        <input value={telegramChatId} onChange={e => setTelegramChatId(e.target.value)} placeholder="معرّف محادثة تيليجرام" dir="ltr" className="h-9 rounded-xl border border-slate-200 px-3 text-left text-xs outline-none" />
        <button disabled={saveSettings.isPending} onClick={() => saveSettings.mutate({ organizationSlug, rebootable, shutdownable, batteryNotification, batteryNotificationType: "telegram", batteryWarningPercentage: Math.min(criticalPercentage + 20, 100), batteryCriticalPercentage: criticalPercentage, telegramChatId: telegramChatId.trim() || null })} className="inline-flex h-9 items-center justify-center gap-1 rounded-xl bg-violet-600 text-xs font-bold text-white disabled:opacity-60"><Save className="h-3.5 w-3.5" />حفظ الإعدادات</button>
      </div>
    </section>

    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(23,35,61,.035)]">
      <h2 className="text-sm font-bold text-slate-900">إجراءات الراوتر عن بُعد</h2>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <select value={actionRouterId} onChange={e => setActionRouterId(e.target.value)} className="h-9 flex-1 min-w-[200px] rounded-xl border border-slate-200 bg-white px-2 text-xs outline-none">
          <option value="">اختر الراوتر</option>
          {routers.map(r => <option key={r.id} value={String(r.id)}>{r.name} — {r.managementAddress}</option>)}
        </select>
        <button disabled={runAction.isPending} onClick={() => confirmAction("reboot")} className="inline-flex h-9 items-center gap-1 rounded-xl bg-amber-600 px-4 text-xs font-bold text-white disabled:opacity-60"><RotateCcw className="h-3.5 w-3.5" />إعادة تشغيل</button>
        <button disabled={runAction.isPending} onClick={() => confirmAction("shutdown")} className="inline-flex h-9 items-center gap-1 rounded-xl bg-rose-600 px-4 text-xs font-bold text-white disabled:opacity-60"><Power className="h-3.5 w-3.5" />إيقاف تشغيل</button>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-[560px] w-full text-right text-xs">
          <thead className="bg-slate-50 text-[11px] text-slate-500">
            <tr><th className="px-5 py-2">الراوتر</th><th>الإجراء</th><th>الحالة</th><th className="px-5">التاريخ</th></tr>
          </thead>
          <tbody>
            {actions.length ? actions.map(a => <tr key={a.id} className="border-t border-slate-100">
              <td className="px-5 py-2 font-bold text-slate-800">{a.routerName ?? `#${a.routerId ?? "—"}`}</td>
              <td className="text-slate-700">{a.action === "reboot" ? "إعادة تشغيل" : "إيقاف تشغيل"}</td>
              <td className={a.status === "sent" ? "text-emerald-700" : a.status === "queued" ? "text-amber-700" : "text-rose-700"}>{a.status === "sent" ? "أُرسل" : a.status === "queued" ? "قيد التنفيذ" : "فشل"}</td>
              <td className="px-5 text-slate-500">{new Date(a.createdAt).toLocaleString()}</td>
            </tr>) : <tr><td colSpan={4} className="py-6 text-center text-slate-400">لا توجد إجراءات بعد.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(23,35,61,.035)]">
      <div className="border-b border-slate-100 px-5 py-4"><h2 className="text-sm font-bold text-slate-900">آخر القراءات</h2></div>
      <div className="overflow-x-auto"><table className="min-w-[560px] w-full text-right text-xs"><thead className="bg-slate-50 text-[11px] text-slate-500"><tr><th className="px-5 py-2">المعالج</th><th>الذاكرة</th><th>القرص</th><th>البطارية</th><th className="px-5">الحالة</th></tr></thead><tbody>{samplesQuery.data?.map(s => <tr key={s.id} className="border-t border-slate-100"><td className="px-5 py-2 text-slate-700">{s.cpuPercent ?? "—"}%</td><td className="text-slate-700">{s.memoryPercent ?? "—"}%</td><td className="text-slate-700">{s.diskPercent ?? "—"}%</td><td className="text-slate-700">{s.batteryPercent ?? "—"}%</td><td className="px-5 text-slate-500">{s.serviceStatus}</td></tr>) ?? <tr><td colSpan={5} className="py-8 text-center text-slate-400">لا توجد قراءات بعد. ثبّت سكربت المراقبة على الخادم.</td></tr>}</tbody></table></div>
    </section>
  </div>;
}
