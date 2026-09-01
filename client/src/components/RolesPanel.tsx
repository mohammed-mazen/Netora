import { trpc } from "@/lib/trpc";
import { ShieldCheck, Plus, UsersRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const ALL_PERMISSIONS = [
  "network:read", "network:write", "customers:read", "customers:write", "vouchers:read", "vouchers:write",
  "sessions:read", "sessions:write", "billing:read", "billing:write", "support:read", "support:write",
  "reports:read", "settings:read", "settings:write", "accounting:read", "accounting:write", "cards:read",
  "cards:write", "cardDesign:read", "cardDesign:write", "reports:builder", "backup:read", "backup:write",
  "monitor:read", "monitor:write", "points:read", "points:write", "sms:read", "sms:write",
  "competitions:read", "competitions:write", "chat:read", "chat:write", "roles:read", "roles:write",
] as const;

export function RolesPanel({ organizationSlug }: { organizationSlug: string }) {
  const utils = trpc.useUtils();
  const [name, setName] = useState(""); const [selected, setSelected] = useState<string[]>([]);
  const rolesQuery = trpc.roles.list.useQuery({ organizationSlug }, { enabled: Boolean(organizationSlug), retry: false });
  const membersQuery = trpc.roles.members.list.useQuery({ organizationSlug }, { enabled: Boolean(organizationSlug), retry: false });
  const createRole = trpc.roles.create.useMutation({ onSuccess: async () => { setName(""); setSelected([]); toast.success("تم إنشاء الدور المخصص."); await utils.roles.list.invalidate(); }, onError: e => toast.error(e.message) });
  const assignRole = trpc.roles.members.assignRole.useMutation({ onSuccess: async () => { toast.success("تم تحديث دور العضو."); await utils.roles.members.list.invalidate(); }, onError: e => toast.error(e.message) });

  const toggle = (permission: string) => setSelected(current => current.includes(permission) ? current.filter(p => p !== permission) : [...current, permission]);

  if (!organizationSlug) return <section className="rounded-2xl border border-dashed border-violet-200 bg-violet-50/60 p-5 text-xs text-slate-600">اختر مؤسسة أولًا لإدارة أدوارها المخصصة.</section>;

  return <div className="space-y-5">
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(23,35,61,.035)]">
      <h2 className="text-sm font-bold text-slate-900"><ShieldCheck className="ml-2 inline h-4 w-4 text-violet-600" />إنشاء دور مخصص</h2>
      <p className="mt-2 text-xs leading-6 text-slate-500">تُضاف صلاحيات الدور المخصص فوق الدور الأساسي للعضو، ولا تستبدله.</p>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="اسم الدور" className="mt-3 h-10 w-full max-w-md rounded-xl border border-slate-200 px-3 text-xs outline-none" />
      <div className="mt-3 flex flex-wrap gap-2">{ALL_PERMISSIONS.map(permission => <button key={permission} onClick={() => toggle(permission)} className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-mono ${selected.includes(permission) ? "border-violet-300 bg-violet-50 text-violet-700" : "border-slate-200 text-slate-500"}`}>{permission}</button>)}</div>
      <button disabled={createRole.isPending} onClick={() => { if (!name.trim()) { toast.error("أدخل اسم الدور."); return; } createRole.mutate({ organizationSlug, name: name.trim(), permissions: selected as never }); }} className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 text-xs font-bold text-white disabled:opacity-60"><Plus className="h-4 w-4" />حفظ الدور</button>
      <div className="mt-4 flex flex-wrap gap-2">{rolesQuery.data?.map(r => <span key={r.id} className="rounded-xl border border-slate-200 px-3 py-2 text-xs"><span className="font-bold text-slate-800">{r.name}</span><span className="mx-2 text-[10px] text-slate-400">{r.permissions.length} صلاحية</span></span>) ?? <span className="text-xs text-slate-400">لا توجد أدوار مخصصة بعد.</span>}</div>
    </section>

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(23,35,61,.035)]">
      <div className="border-b border-slate-100 px-5 py-4"><h2 className="text-sm font-bold text-slate-900"><UsersRound className="ml-2 inline h-4 w-4 text-violet-600" />أعضاء المؤسسة</h2></div>
      <div className="overflow-x-auto"><table className="min-w-[560px] w-full text-right text-xs"><thead className="bg-slate-50 text-[11px] text-slate-500"><tr><th className="px-5 py-2">العضو</th><th>الدور الأساسي</th><th>الدور المخصص</th><th className="px-5">إجراء</th></tr></thead><tbody>{membersQuery.data?.map(m => <tr key={m.id} className="border-t border-slate-100"><td className="px-5 py-2 font-bold text-slate-800">{m.userName}</td><td className="text-slate-500">{m.role}</td><td className="text-slate-500">{m.customRoleName ?? "—"}</td><td className="px-5"><select value={m.customRoleId ?? ""} onChange={e => assignRole.mutate({ organizationSlug, memberId: m.id, customRoleId: e.target.value ? Number(e.target.value) : null })} className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[11px] outline-none"><option value="">بلا دور مخصص</option>{rolesQuery.data?.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></td></tr>) ?? <tr><td colSpan={4} className="py-8 text-center text-slate-400">لا يوجد أعضاء بعد.</td></tr>}</tbody></table></div>
    </section>
  </div>;
}
