import { trpc } from "@/lib/trpc";
import { Plus, Router } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function RouterProvisionPanel({ organizationSlug }: { organizationSlug: string }) {
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [mode, setMode] = useState<"api_ssl" | "rest_https" | "agent">("api_ssl");
  const [siteId, setSiteId] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const routersQuery = trpc.workspace.network.listRouters.useQuery({ organizationSlug, limit: 25, offset: 0 }, { enabled: Boolean(organizationSlug), retry: false });
  const sitesQuery = trpc.workspace.network.listSites.useQuery({ organizationSlug }, { enabled: Boolean(organizationSlug), retry: false });
  const createRouter = trpc.workspace.network.createRouter.useMutation({
    onSuccess: async () => {
      setName(""); setAddress(""); setSiteId(""); setUsername(""); setPassword("");
      toast.success("تم حفظ الراوتر بحالة انتظار التحقق.");
      await utils.workspace.network.listRouters.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  return (
    <div className="grid gap-5 xl:grid-cols-[.75fr_1.25fr]">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(23,35,61,.035)]">
        <p className="text-xs font-bold text-violet-600">إضافة راوتر</p>
        <p className="mt-2 text-xs leading-6 text-slate-500">
          اسم المستخدم وكلمة المرور يُشفّران فورًا (AES-256-GCM) ويُخزّنان في مخزن أسرار خاص بهذا الراوتر — لا يُعادان أبدًا إلى المتصفح.
        </p>
        <div className="mt-4 space-y-3">
          <input value={name} onChange={event => setName(event.target.value)} placeholder="اسم الراوتر" className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-violet-400" />
          <input value={address} onChange={event => setAddress(event.target.value)} placeholder="عنوان الإدارة أو DNS" dir="ltr" className="h-10 w-full rounded-xl border border-slate-200 px-3 text-left text-xs outline-none focus:border-violet-400" />
          <div className="grid grid-cols-2 gap-3">
            <select value={mode} onChange={event => setMode(event.target.value as typeof mode)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-violet-400">
              <option value="api_ssl">RouterOS API-SSL</option>
              <option value="rest_https">REST عبر HTTPS</option>
              <option value="agent">عامل محلي</option>
            </select>
            <select value={siteId} onChange={event => setSiteId(event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-violet-400">
              <option value="">بلا موقع</option>
              {sitesQuery.data?.map(site => <option key={site.id} value={site.id}>{site.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input value={username} onChange={event => setUsername(event.target.value)} placeholder="اسم مستخدم الراوتر (اختياري)" dir="ltr" className="h-10 w-full rounded-xl border border-slate-200 px-3 text-left text-xs outline-none focus:border-violet-400" />
            <input value={password} onChange={event => setPassword(event.target.value)} type="password" placeholder="كلمة المرور (اختياري)" dir="ltr" className="h-10 w-full rounded-xl border border-slate-200 px-3 text-left text-xs outline-none focus:border-violet-400" />
          </div>
          <button
            disabled={createRouter.isPending}
            onClick={() => {
              if (!name.trim() || !address.trim()) { toast.error("أدخل اسم الراوتر وعنوان الإدارة."); return; }
              if ((username.trim() && !password) || (!username.trim() && password)) { toast.error("أدخل اسم المستخدم وكلمة المرور معًا أو اتركهما فارغين."); return; }
              createRouter.mutate({
                organizationSlug, name: name.trim(), managementAddress: address.trim(), connectionMode: mode,
                siteId: siteId ? Number(siteId) : null,
                username: username.trim() || null, password: password || null,
              });
            }}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-violet-600 text-xs font-bold text-white disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />{createRouter.isPending ? "جارٍ الحفظ…" : "حفظ بحالة انتظار"}
          </button>
        </div>
      </section>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(23,35,61,.035)]">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">سجل الراوترات</h2>
            <p className="mt-1 text-xs text-slate-500">تُحدَّث الحالة تلقائيًا من مهام الفحص الدوري في الخلفية.</p>
          </div>
          <Router className="h-5 w-5 text-violet-600" />
        </div>
        {routersQuery.data?.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-[640px] w-full text-right">
              <thead className="bg-slate-50 text-[11px] text-slate-500">
                <tr><th className="px-5 py-3">الراوتر</th><th>الموقع</th><th>النمط</th><th className="px-5">الحالة</th></tr>
              </thead>
              <tbody>
                {routersQuery.data.map(router => (
                  <tr key={router.id} className="border-t border-slate-100 text-xs">
                    <td className="px-5 py-4"><p className="font-bold text-slate-800">{router.name}</p><p dir="ltr" className="mt-1 text-[10px] text-slate-500">{router.managementAddress}</p></td>
                    <td className="text-slate-600">{router.siteName ?? "—"}</td>
                    <td className="text-slate-600">{router.connectionMode}</td>
                    <td className="px-5"><span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700">{router.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 text-center text-xs text-slate-500">أضف أول راوتر ثم هيّئ بيانات اعتماده.</div>
        )}
      </section>
    </div>
  );
}
