import { trpc } from "@/lib/trpc";
import { MessageSquareText, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export function SmsPanel({ organizationSlug }: { organizationSlug: string }) {
  const utils = trpc.useUtils();
  const [serverType, setServerType] = useState<"cloud" | "local_modem">("cloud"); const [simCardsCount, setSimCardsCount] = useState<"one" | "two">("one"); const [sendingType, setSendingType] = useState<"auto" | "manual">("auto"); const [secretValue, setSecretValue] = useState("");
  const [toNumber, setToNumber] = useState(""); const [body, setBody] = useState("");

  const settingsQuery = trpc.sms.settings.get.useQuery({ organizationSlug }, { enabled: Boolean(organizationSlug), retry: false });
  const messagesQuery = trpc.sms.messages.list.useQuery({ organizationSlug, limit: 25, offset: 0 }, { enabled: Boolean(organizationSlug), retry: false });
  useEffect(() => { if (settingsQuery.data) { setServerType(settingsQuery.data.serverType); setSimCardsCount(settingsQuery.data.simCardsCount); setSendingType(settingsQuery.data.sendingType); } }, [settingsQuery.data]);
  const saveSettings = trpc.sms.settings.save.useMutation({ onSuccess: async () => { setSecretValue(""); toast.success("تم حفظ إعدادات بوابة الرسائل."); await utils.sms.settings.get.invalidate(); }, onError: e => toast.error(e.message) });
  const queueMessage = trpc.sms.messages.queue.useMutation({ onSuccess: async () => { setToNumber(""); setBody(""); toast.success("تمت إضافة الرسالة إلى الطابور."); await utils.sms.messages.list.invalidate(); }, onError: e => toast.error(e.message) });

  if (!organizationSlug) return <section className="rounded-2xl border border-dashed border-violet-200 bg-violet-50/60 p-5 text-xs text-slate-600">اختر مؤسسة أولًا لإدارة بوابة الرسائل.</section>;

  return <div className="space-y-5">
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(23,35,61,.035)]">
      <h2 className="text-sm font-bold text-slate-900"><MessageSquareText className="ml-2 inline h-4 w-4 text-violet-600" />إعدادات بوابة الرسائل</h2>
      <p className="mt-2 text-xs leading-6 text-slate-500">مفتاح المزود يُخزَّن مشفّرًا في خزنة الأسرار الخادمية {settingsQuery.data?.hasSecret ? "(مهيأ حاليًا)" : "(غير مهيأ)"}.</p>
      <div className="mt-4 grid gap-2 md:grid-cols-4">
        <select value={serverType} onChange={e => setServerType(e.target.value as typeof serverType)} className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-xs outline-none"><option value="cloud">سحابي</option><option value="local_modem">مودم محلي</option></select>
        <select value={simCardsCount} onChange={e => setSimCardsCount(e.target.value as typeof simCardsCount)} className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-xs outline-none"><option value="one">شريحة واحدة</option><option value="two">شريحتان</option></select>
        <select value={sendingType} onChange={e => setSendingType(e.target.value as typeof sendingType)} className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-xs outline-none"><option value="auto">إرسال آلي</option><option value="manual">إرسال يدوي</option></select>
        <input value={secretValue} onChange={e => setSecretValue(e.target.value)} dir="ltr" placeholder="مفتاح API (اختياري)" className="h-9 rounded-xl border border-slate-200 px-3 text-left text-xs outline-none" />
      </div>
      <button disabled={saveSettings.isPending} onClick={() => saveSettings.mutate({ organizationSlug, serverType, simCardsCount, defaultSimCard: 1, sendingType, secretValue: secretValue.trim() || undefined })} className="mt-3 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-60">حفظ الإعدادات</button>
    </section>

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(23,35,61,.035)]">
      <div className="border-b border-slate-100 px-5 py-4"><h2 className="text-sm font-bold text-slate-900">إرسال رسالة</h2></div>
      <div className="grid gap-2 p-5 md:grid-cols-3">
        <input value={toNumber} onChange={e => setToNumber(e.target.value)} dir="ltr" placeholder="رقم الهاتف" className="h-9 rounded-xl border border-slate-200 px-3 text-left text-xs outline-none" />
        <input value={body} onChange={e => setBody(e.target.value)} placeholder="نص الرسالة" className="h-9 rounded-xl border border-slate-200 px-3 text-xs outline-none md:col-span-1" />
        <button disabled={queueMessage.isPending} onClick={() => { if (!toNumber.trim() || !body.trim()) { toast.error("أدخل الرقم ونص الرسالة."); return; } queueMessage.mutate({ organizationSlug, toNumber: toNumber.trim(), body: body.trim() }); }} className="inline-flex h-9 items-center justify-center gap-1 rounded-xl bg-violet-600 text-xs font-bold text-white disabled:opacity-60"><Send className="h-3.5 w-3.5" />إرسال</button>
      </div>
      <div className="overflow-x-auto"><table className="min-w-[520px] w-full text-right text-xs"><thead className="bg-slate-50 text-[11px] text-slate-500"><tr><th className="px-5 py-2">الرقم</th><th>النص</th><th className="px-5">الحالة</th></tr></thead><tbody>{messagesQuery.data?.map(m => <tr key={m.id} className="border-t border-slate-100"><td dir="ltr" className="px-5 py-2 font-mono">{m.toNumber}</td><td className="max-w-xs truncate text-slate-700">{m.body}</td><td className="px-5 text-slate-500">{m.status}</td></tr>) ?? <tr><td colSpan={3} className="py-8 text-center text-slate-400">لا توجد رسائل بعد.</td></tr>}</tbody></table></div>
    </section>
  </div>;
}
