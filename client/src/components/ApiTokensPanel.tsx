import { trpc } from "@/lib/trpc";
import { FileKey2, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const ABILITIES = [
  { key: "create", label: "إنشاء" },
  { key: "read", label: "قراءة" },
  { key: "update", label: "تعديل" },
  { key: "delete", label: "حذف" },
] as const;

type AbilityKey = typeof ABILITIES[number]["key"];

export function ApiTokensPanel({ organizationSlug }: { organizationSlug: string }) {
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const [ipAllowlist, setIpAllowlist] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<AbilityKey, boolean>>({ create: false, read: true, update: false, delete: false });

  const listQuery = trpc.apiTokens.list.useQuery({ organizationSlug }, { enabled: Boolean(organizationSlug), retry: false });
  const createMutation = trpc.apiTokens.create.useMutation({
    onSuccess: async result => {
      setName("");
      setIpAllowlist("");
      setExpiresAt("");
      setSelected({ create: false, read: true, update: false, delete: false });
      setRevealedToken(result.token);
      toast.success("تم إنشاء رمز API جديد.");
      await utils.apiTokens.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const revokeMutation = trpc.apiTokens.revoke.useMutation({
    onSuccess: async () => {
      toast.success("تم إلغاء الرمز.");
      await utils.apiTokens.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const abilities = useMemo(() => ABILITIES.filter(item => selected[item.key]).map(item => item.key), [selected]);

  if (!organizationSlug) return <section className="rounded-2xl border border-dashed border-violet-200 bg-violet-50/60 p-5 text-xs text-slate-600">اختر مؤسسة أولًا لإدارة رموز API.</section>;

  return <div className="space-y-5">
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(23,35,61,.035)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900"><FileKey2 className="ml-2 inline h-4 w-4 text-violet-600" />رموز API</h2>
          <p className="mt-1 text-xs leading-6 text-slate-500">أنشئ رموز وصول شخصية بقدرات محددة وقيود عناوين IP وتاريخ انتهاء اختياري.</p>
        </div>
        <span className="rounded-full bg-violet-50 px-3 py-1 text-[11px] font-semibold text-violet-700">{listQuery.data?.length ?? 0} رمز</span>
      </div>
      {revealedToken && <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800"><p className="font-bold">انسخ الرمز الآن، لن يظهر كاملًا مرة أخرى:</p><p dir="ltr" className="mt-2 overflow-x-auto rounded-xl bg-white px-3 py-2 font-mono text-[11px] text-slate-700">{revealedToken}</p></div>}
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <input value={name} onChange={event => setName(event.target.value)} placeholder="اسم الرمز" className="h-10 rounded-xl border border-slate-200 px-3 text-xs outline-none" />
        <input value={ipAllowlist} onChange={event => setIpAllowlist(event.target.value)} dir="ltr" placeholder="IP allowlist مفصولة بفواصل" className="h-10 rounded-xl border border-slate-200 px-3 text-left text-xs outline-none" />
        <input value={expiresAt} onChange={event => setExpiresAt(event.target.value)} type="date" className="h-10 rounded-xl border border-slate-200 px-3 text-xs outline-none" />
        <button onClick={() => {
          if (!name.trim()) { toast.error("أدخل اسمًا للرمز."); return; }
          if (!abilities.length) { toast.error("اختر قدرة واحدة على الأقل."); return; }
          createMutation.mutate({ organizationSlug, name: name.trim(), abilities, ipAllowlist: ipAllowlist.split(",").map(part => part.trim()).filter(Boolean), expiresAt: expiresAt ? new Date(`${expiresAt}T00:00:00.000Z`) : null });
        }} disabled={createMutation.isPending} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 text-xs font-bold text-white disabled:opacity-60 xl:col-span-4"><Plus className="h-3.5 w-3.5" />{createMutation.isPending ? "جارٍ الإنشاء…" : "إنشاء رمز جديد"}</button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {ABILITIES.map(item => <label key={item.key} className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs ${selected[item.key] ? "border-violet-200 bg-violet-50 text-violet-700" : "border-slate-200 bg-white text-slate-600"}`}><input type="checkbox" className="hidden" checked={selected[item.key]} onChange={() => setSelected(current => ({ ...current, [item.key]: !current[item.key] }))} /><ShieldCheck className="h-3.5 w-3.5" />{item.label}</label>)}
      </div>
    </section>

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(23,35,61,.035)]">
      <div className="overflow-x-auto">
        <table className="min-w-[860px] w-full text-right text-xs">
          <thead className="bg-slate-50 text-[11px] text-slate-500"><tr><th className="px-5 py-3">الاسم</th><th>المعرّف</th><th>القدرات</th><th>السماح بالعناوين</th><th>ينتهي في</th><th>آخر استخدام</th><th className="px-5">إجراء</th></tr></thead>
          <tbody>
            {(listQuery.data ?? []).map(token => <tr key={token.id} className="border-t border-slate-100">
              <td className="px-5 py-3 font-bold text-slate-800">{token.name}</td>
              <td dir="ltr" className="font-mono text-[11px] text-slate-600">{token.tokenLabel}</td>
              <td className="text-slate-600">{token.abilities.length ? token.abilities.join("، ") : "—"}</td>
              <td dir="ltr" className="text-slate-500">{token.ipAllowlist.length ? token.ipAllowlist.join(", ") : "—"}</td>
              <td className="text-slate-500">{token.expiresAt ? new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium" }).format(token.expiresAt) : "غير محدد"}</td>
              <td className="text-slate-500">{token.lastUsedAt ? new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short" }).format(token.lastUsedAt) : "لم يُستخدم"}</td>
              <td className="px-5"><button disabled={Boolean(token.revokedAt) || revokeMutation.isPending} onClick={() => revokeMutation.mutate({ organizationSlug, tokenId: token.id })} className="inline-flex h-8 items-center gap-1 rounded-xl border border-rose-200 px-3 text-[11px] font-bold text-rose-700 disabled:opacity-50"><Trash2 className="h-3 w-3" />{token.revokedAt ? "ملغى" : "إلغاء"}</button></td>
            </tr>)}
            {!listQuery.data?.length && <tr><td colSpan={7} className="px-5 py-10 text-center text-slate-400">لا توجد رموز API بعد.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  </div>;
}
