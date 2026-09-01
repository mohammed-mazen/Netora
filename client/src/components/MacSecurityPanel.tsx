import { trpc } from "@/lib/trpc";
import { Ban, LockKeyhole, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function MacSecurityPanel({ organizationSlug }: { organizationSlug: string }) {
  const utils = trpc.useUtils();
  const [macAddress, setMacAddress] = useState("");
  const [listType, setListType] = useState<"whitelist" | "blacklist">("whitelist");
  const [reason, setReason] = useState("");
  const [actionMac, setActionMac] = useState("");

  const rulesQuery = trpc.macSecurity.rules.list.useQuery({ organizationSlug }, { enabled: Boolean(organizationSlug), retry: false });
  const actionsQuery = trpc.macSecurity.actions.list.useQuery({ organizationSlug, limit: 15, offset: 0 }, { enabled: Boolean(organizationSlug), retry: false });
  const saveMutation = trpc.macSecurity.rules.save.useMutation({
    onSuccess: async () => {
      setMacAddress("");
      setReason("");
      toast.success("تم حفظ قاعدة MAC Security.");
      await Promise.all([utils.macSecurity.rules.list.invalidate(), utils.macSecurity.actions.list.invalidate()]);
    },
    onError: error => toast.error(error.message),
  });
  const deleteMutation = trpc.macSecurity.rules.delete.useMutation({
    onSuccess: async () => {
      toast.success("تم حذف القاعدة.");
      await utils.macSecurity.rules.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const actionMutation = trpc.macSecurity.actions.record.useMutation({
    onSuccess: async () => {
      setActionMac("");
      toast.success("تم تسجيل الإجراء.");
      await utils.macSecurity.actions.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  if (!organizationSlug) return <section className="rounded-2xl border border-dashed border-violet-200 bg-violet-50/60 p-5 text-xs text-slate-600">اختر مؤسسة أولًا لإدارة MAC Security.</section>;

  return <div className="space-y-5">
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(23,35,61,.035)]">
      <h2 className="text-sm font-bold text-slate-900"><LockKeyhole className="ml-2 inline h-4 w-4 text-violet-600" />قواعد حماية عناوين MAC</h2>
      <p className="mt-2 text-xs leading-6 text-slate-500">أنشئ قوائم سماح أو حظر لعناوين MAC مع سبب تشغيلي واضح وسجل إجراءات منفصل.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <input value={macAddress} onChange={event => setMacAddress(event.target.value)} dir="ltr" placeholder="AA:BB:CC:DD:EE:FF" className="h-10 rounded-xl border border-slate-200 px-3 text-left text-xs outline-none" />
        <select value={listType} onChange={event => setListType(event.target.value as typeof listType)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none"><option value="whitelist">Whitelist</option><option value="blacklist">Blacklist</option></select>
        <input value={reason} onChange={event => setReason(event.target.value)} placeholder="السبب" className="h-10 rounded-xl border border-slate-200 px-3 text-xs outline-none" />
        <button disabled={saveMutation.isPending} onClick={() => { if (!macAddress.trim()) { toast.error("أدخل عنوان MAC."); return; } saveMutation.mutate({ organizationSlug, macAddress: macAddress.trim(), listType, reason: reason.trim() || null }); }} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 text-xs font-bold text-white disabled:opacity-60"><Plus className="h-3.5 w-3.5" />حفظ القاعدة</button>
      </div>
    </section>

    <section className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(23,35,61,.035)]">
        <div className="border-b border-slate-100 px-5 py-4"><h3 className="text-sm font-bold text-slate-900">القواعد الحالية</h3></div>
        <div className="overflow-x-auto"><table className="min-w-[620px] w-full text-right text-xs"><thead className="bg-slate-50 text-[11px] text-slate-500"><tr><th className="px-5 py-3">MAC</th><th>النوع</th><th>السبب</th><th>العميل</th><th className="px-5">إجراء</th></tr></thead><tbody>{(rulesQuery.data ?? []).map(rule => <tr key={rule.id} className="border-t border-slate-100"><td dir="ltr" className="px-5 py-3 font-mono text-[11px] text-slate-700">{rule.macAddress}</td><td><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${rule.listType === "blacklist" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>{rule.listType === "blacklist" ? "حظر" : "سماح"}</span></td><td className="text-slate-500">{rule.reason || "—"}</td><td className="text-slate-500">{rule.customerName || "—"}</td><td className="px-5"><button disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate({ organizationSlug, ruleId: rule.id })} className="inline-flex h-8 items-center gap-1 rounded-xl border border-rose-200 px-3 text-[11px] font-bold text-rose-700"><Trash2 className="h-3 w-3" />حذف</button></td></tr>)}{!rulesQuery.data?.length && <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-400">لا توجد قواعد بعد.</td></tr>}</tbody></table></div>
      </div>

      <div className="space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(23,35,61,.035)]">
          <h3 className="text-sm font-bold text-slate-900"><Ban className="ml-2 inline h-4 w-4 text-violet-600" />إجراء سريع</h3>
          <div className="mt-4 grid gap-3">
            <input value={actionMac} onChange={event => setActionMac(event.target.value)} dir="ltr" placeholder="عنوان MAC لتنفيذ الإجراء" className="h-10 rounded-xl border border-slate-200 px-3 text-left text-xs outline-none" />
            <div className="grid gap-2 md:grid-cols-2"><button disabled={actionMutation.isPending} onClick={() => { if (!actionMac.trim()) { toast.error("أدخل عنوان MAC."); return; } actionMutation.mutate({ organizationSlug, macAddress: actionMac.trim(), action: "block" }); }} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 text-xs font-bold text-white disabled:opacity-60"><Ban className="h-3.5 w-3.5" />حظر</button><button disabled={actionMutation.isPending} onClick={() => { if (!actionMac.trim()) { toast.error("أدخل عنوان MAC."); return; } actionMutation.mutate({ organizationSlug, macAddress: actionMac.trim(), action: "unblock" }); }} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white disabled:opacity-60"><ShieldCheck className="h-3.5 w-3.5" />إلغاء الحظر</button></div>
          </div>
        </section>
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(23,35,61,.035)]">
          <div className="border-b border-slate-100 px-5 py-4"><h3 className="text-sm font-bold text-slate-900">سجل الإجراءات</h3></div>
          <div className="overflow-x-auto"><table className="min-w-[420px] w-full text-right text-xs"><thead className="bg-slate-50 text-[11px] text-slate-500"><tr><th className="px-5 py-3">الإجراء</th><th>MAC</th><th className="px-5">الوقت</th></tr></thead><tbody>{(actionsQuery.data ?? []).map(action => <tr key={action.id} className="border-t border-slate-100"><td className="px-5 py-3 font-bold text-slate-800">{action.action === "block" ? "حظر" : "إلغاء حظر"}</td><td dir="ltr" className="font-mono text-[11px] text-slate-600">{action.macAddress}</td><td className="px-5 text-slate-500">{new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short" }).format(action.createdAt)}</td></tr>)}{!actionsQuery.data?.length && <tr><td colSpan={3} className="px-5 py-10 text-center text-slate-400">لا توجد أحداث حتى الآن.</td></tr>}</tbody></table></div>
        </section>
      </div>
    </section>
  </div>;
}
