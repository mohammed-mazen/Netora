import { trpc } from "@/lib/trpc";
import { ChevronLeft, ChevronRight, Headphones, Plus, Router, Shield } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const PAGE_SIZE = 25;
type TicketStatus = "all" | "open" | "pending" | "resolved" | "closed";
type TicketPriority = "low" | "normal" | "high" | "critical";

function Status({ value }: { value: string }) {
  const tone = value === "resolved" ? "bg-emerald-50 text-emerald-700" : value === "closed" ? "bg-slate-100 text-slate-600" : "bg-amber-50 text-amber-700";
  return <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${tone}`}>{value}</span>;
}

export function SupportTicketDirectoryPanel({ organizationSlug }: { organizationSlug: string }) {
  const utils = trpc.useUtils();
  const [subject, setSubject] = useState("");
  const [priority, setPriority] = useState<TicketPriority>("normal");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<TicketStatus>("all");
  const [offset, setOffset] = useState(0);
  const [macAddress, setMacAddress] = useState("");
  const [routerId, setRouterId] = useState("");

  const queryInput = useMemo(() => ({ organizationSlug, limit: PAGE_SIZE, offset, search: search.trim() || undefined, status: status === "all" ? undefined : status }), [offset, organizationSlug, search, status]);
  const ticketsQuery = trpc.workspace.support.list.useQuery(queryInput, { enabled: Boolean(organizationSlug), retry: false });
  const createTicket = trpc.workspace.support.create.useMutation({ onSuccess: async ticket => { setSubject(""); setMacAddress(""); setRouterId(""); toast.success(`تم فتح التذكرة ${ticket.reference}.`); await utils.workspace.support.list.invalidate(); }, onError: error => toast.error(error.message) });
  const updateStatus = trpc.workspace.support.updateStatus.useMutation({ onSuccess: async ticket => { if (ticket.changed) toast.success("تم تحديث حالة التذكرة."); await Promise.all([utils.workspace.support.list.invalidate(), utils.workspace.support.listMessages.invalidate()]); }, onError: error => toast.error(error.message) });

  return <div className="grid gap-5 xl:grid-cols-[.75fr_1.25fr]">
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(23,35,61,.035)]">
      <p className="text-xs font-bold text-violet-600">فتح تذكرة</p>
      <h2 className="mt-1 text-base font-bold text-slate-900">سياق دعم متقدم</h2>
      <p className="mt-2 text-xs leading-6 text-slate-500">يمكن إرفاق بيانات الجهاز والراوتر مع التذكرة لرفع جودة الدعم بدون المساس بهوية واجهة Netora.</p>
      <div className="mt-4 space-y-3">
        <input value={subject} onChange={event => setSubject(event.target.value)} placeholder="موضوع واضح للتذكرة" className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-violet-400" />
        <select value={priority} onChange={event => setPriority(event.target.value as TicketPriority)} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-violet-400"><option value="low">منخفضة</option><option value="normal">عادية</option><option value="high">مرتفعة</option><option value="critical">حرجة</option></select>
        <div className="grid gap-3 md:grid-cols-2">
          <input value={macAddress} onChange={event => setMacAddress(event.target.value)} dir="ltr" placeholder="MAC Address اختياري" className="h-10 rounded-xl border border-slate-200 px-3 text-left text-xs outline-none focus:border-violet-400" />
          <input value={routerId} onChange={event => setRouterId(event.target.value)} inputMode="numeric" placeholder="Router ID اختياري" className="h-10 rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-violet-400" />
        </div>
        <button disabled={createTicket.isPending} onClick={() => { if (subject.trim().length < 5) { toast.error("اكتب موضوعًا من خمسة أحرف على الأقل."); return; } createTicket.mutate({ organizationSlug, subject: subject.trim(), priority, metadata: { userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined, macAddress: macAddress.trim() || undefined, routerId: routerId ? Number(routerId) : undefined } }); }} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-violet-600 text-xs font-bold text-white disabled:opacity-60"><Plus className="h-4 w-4" />{createTicket.isPending ? "جارٍ الفتح…" : "فتح التذكرة"}</button>
      </div>
    </section>

    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(23,35,61,.035)]">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold text-violet-600">الدليل</p><h2 className="mt-1 text-base font-bold text-slate-900"><Headphones className="ml-2 inline h-4 w-4 text-violet-600" />تذاكر الدعم</h2></div><div className="flex flex-wrap items-center gap-2"><input value={search} onChange={event => { setOffset(0); setSearch(event.target.value); }} placeholder="بحث" className="h-9 rounded-xl border border-slate-200 px-3 text-xs outline-none" /><select value={status} onChange={event => { setOffset(0); setStatus(event.target.value as TicketStatus); }} className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none"><option value="all">كل الحالات</option><option value="open">مفتوحة</option><option value="pending">معلقة</option><option value="resolved">محلولة</option><option value="closed">مغلقة</option></select></div></div>
      <div className="mt-4 space-y-3">{ticketsQuery.data?.length ? ticketsQuery.data.map(ticket => <article key={ticket.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-bold text-slate-900">{ticket.subject}</p><Status value={ticket.status} /></div><p className="mt-1 text-[11px] text-slate-500">{ticket.reference} • {ticket.createdByName || "—"}</p></div><div className="flex gap-2"><button disabled={updateStatus.isPending || ticket.status === "resolved"} onClick={() => updateStatus.mutate({ organizationSlug, ticketId: ticket.id, status: "resolved" })} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-700 disabled:opacity-40">حل</button><button disabled={updateStatus.isPending || ticket.status === "closed"} onClick={() => updateStatus.mutate({ organizationSlug, ticketId: ticket.id, status: "closed" })} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-bold text-slate-700 disabled:opacity-40">إغلاق</button></div></div><div className="mt-3 grid gap-2 md:grid-cols-3 text-[11px] text-slate-500">{ticket.deviceMacAddress ? <div className="rounded-xl bg-slate-50 px-3 py-2"><Shield className="ml-1 inline h-3.5 w-3.5" />{ticket.deviceMacAddress}</div> : <div className="rounded-xl bg-slate-50 px-3 py-2">بدون MAC</div>}{ticket.routerName || ticket.routerId ? <div className="rounded-xl bg-slate-50 px-3 py-2"><Router className="ml-1 inline h-3.5 w-3.5" />{ticket.routerName || `Router #${ticket.routerId}`}</div> : <div className="rounded-xl bg-slate-50 px-3 py-2">بدون راوتر</div>}{ticket.deviceUserAgent ? <div className="rounded-xl bg-slate-50 px-3 py-2 line-clamp-1">{ticket.deviceUserAgent}</div> : <div className="rounded-xl bg-slate-50 px-3 py-2">بدون User-Agent</div>}</div></article>) : <p className="py-8 text-center text-xs text-slate-500">لا توجد تذاكر مطابقة.</p>}</div>
      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-500"><button disabled={offset === 0} onClick={() => setOffset(current => Math.max(0, current - PAGE_SIZE))} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-40"><ChevronRight className="h-3.5 w-3.5" />السابق</button><button disabled={!ticketsQuery.data || ticketsQuery.data.length < PAGE_SIZE} onClick={() => setOffset(current => current + PAGE_SIZE)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-40">التالي<ChevronLeft className="h-3.5 w-3.5" /></button></div>
    </section>
  </div>;
}
