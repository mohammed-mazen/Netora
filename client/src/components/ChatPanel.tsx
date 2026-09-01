import { trpc } from "@/lib/trpc";
import { MessageCircle, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function ChatPanel({ organizationSlug }: { organizationSlug: string }) {
  const utils = trpc.useUtils();
  const [selectedThreadId, setSelectedThreadId] = useState(""); const [subject, setSubject] = useState(""); const [message, setMessage] = useState("");

  const threadsQuery = trpc.chat.threads.list.useQuery({ organizationSlug, limit: 25, offset: 0 }, { enabled: Boolean(organizationSlug), retry: false });
  const messagesQuery = trpc.chat.messages.list.useQuery({ organizationSlug, threadId: Number(selectedThreadId), limit: 100 }, { enabled: Boolean(organizationSlug) && Boolean(selectedThreadId), retry: false });
  const createThread = trpc.chat.threads.create.useMutation({ onSuccess: async thread => { setSubject(""); setSelectedThreadId(String(thread.id)); toast.success("تم فتح محادثة جديدة."); await utils.chat.threads.list.invalidate(); }, onError: e => toast.error(e.message) });
  const updateStatus = trpc.chat.threads.updateStatus.useMutation({ onSuccess: async () => { toast.success("تم تحديث حالة المحادثة."); await utils.chat.threads.list.invalidate(); }, onError: e => toast.error(e.message) });
  const postMessage = trpc.chat.messages.post.useMutation({ onSuccess: async () => { setMessage(""); await utils.chat.messages.list.invalidate(); }, onError: e => toast.error(e.message) });

  if (!organizationSlug) return <section className="rounded-2xl border border-dashed border-violet-200 bg-violet-50/60 p-5 text-xs text-slate-600">اختر مؤسسة أولًا لإدارة الدعم المباشر.</section>;

  return <div className="grid gap-5 xl:grid-cols-[.4fr_.6fr]">
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(23,35,61,.035)]">
      <div className="border-b border-slate-100 px-5 py-4"><h2 className="text-sm font-bold text-slate-900"><MessageCircle className="ml-2 inline h-4 w-4 text-violet-600" />محادثات الدعم</h2><div className="mt-3 flex gap-2"><input value={subject} onChange={e => setSubject(e.target.value)} placeholder="موضوع محادثة جديدة" className="h-9 flex-1 rounded-xl border border-slate-200 px-3 text-xs outline-none" /><button disabled={createThread.isPending} onClick={() => createThread.mutate({ organizationSlug, subject: subject.trim() || undefined })} className="rounded-xl bg-violet-600 px-3 text-xs font-bold text-white disabled:opacity-60">فتح</button></div></div>
      <ul className="max-h-[420px] overflow-y-auto p-3 text-xs">{threadsQuery.data?.map(t => <li key={t.id} onClick={() => setSelectedThreadId(String(t.id))} className={`mb-2 cursor-pointer rounded-xl border px-3 py-2 ${String(t.id) === selectedThreadId ? "border-violet-300 bg-violet-50" : "border-slate-200"}`}><div className="flex items-center justify-between"><span className="font-bold text-slate-800">{t.subject ?? `محادثة #${t.id}`}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${t.status === "open" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{t.status}</span></div></li>) ?? <li className="text-slate-400">لا توجد محادثات بعد.</li>}</ul>
    </section>

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(23,35,61,.035)]">
      {selectedThreadId ? <>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><h3 className="text-sm font-bold text-slate-900">محادثة #{selectedThreadId}</h3><button onClick={() => updateStatus.mutate({ organizationSlug, threadId: Number(selectedThreadId), status: "closed" })} className="text-xs font-bold text-slate-500">إغلاق المحادثة</button></div>
        <div className="max-h-[320px] space-y-2 overflow-y-auto p-4">{messagesQuery.data?.map(m => <div key={m.id} className={`max-w-[80%] rounded-xl px-3 py-2 text-xs ${m.senderKind === "staff" ? "mr-auto bg-violet-50 text-violet-800" : "ml-auto bg-slate-100 text-slate-700"}`}>{m.body}</div>) ?? <p className="text-xs text-slate-400">لا توجد رسائل بعد.</p>}</div>
        <div className="flex gap-2 border-t border-slate-100 p-4"><input value={message} onChange={e => setMessage(e.target.value)} placeholder="اكتب ردًا كموظف دعم…" className="h-9 flex-1 rounded-xl border border-slate-200 px-3 text-xs outline-none" /><button disabled={postMessage.isPending} onClick={() => { if (!message.trim()) return; postMessage.mutate({ organizationSlug, threadId: Number(selectedThreadId), senderKind: "staff", body: message.trim() }); }} className="inline-flex h-9 items-center gap-1 rounded-xl bg-violet-600 px-3 text-xs font-bold text-white disabled:opacity-60"><Send className="h-3.5 w-3.5" /></button></div>
      </> : <div className="p-12 text-center text-xs text-slate-400">اختر محادثة من القائمة لعرض الرسائل.</div>}
    </section>
  </div>;
}
