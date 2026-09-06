import { trpc } from "@/lib/trpc";
import { ChevronLeft, ChevronRight, Plus, UsersRound, Download, Upload } from "lucide-react";
import { useMemo, useState, useRef } from "react";
import { toast } from "sonner";

const PAGE_SIZE = 25;
type CustomerStatus = "all" | "active" | "suspended" | "blocked" | "archived";
function Status({ value }: { value: string }) { const tone = value === "active" ? "bg-emerald-50 text-emerald-700" : value === "blocked" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"; return <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${tone}`}>{value}</span>; }

export function CustomerDirectoryPanel({ organizationSlug }: { organizationSlug: string }) {
  const utils = trpc.useUtils(); const [name, setName] = useState(""); const [username, setUsername] = useState(""); const [search, setSearch] = useState(""); const [status, setStatus] = useState<CustomerStatus>("all"); const [offset, setOffset] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const queryInput = useMemo(() => ({ organizationSlug, limit: PAGE_SIZE, offset, search: search.trim() || undefined, status: status === "all" ? undefined : status }), [offset, organizationSlug, search, status]);
  const customersQuery = trpc.workspace.customers.list.useQuery(queryInput, { enabled: Boolean(organizationSlug), retry: false });
  const activePlansQuery = trpc.workspace.servicePlans.list.useQuery({ organizationSlug, limit: 100, offset: 0, status: "active" }, { enabled: Boolean(organizationSlug), retry: false });
  const createCustomer = trpc.workspace.customers.create.useMutation({ onSuccess: async () => { setName(""); setUsername(""); toast.success("تمت إضافة العميل في المؤسسة الحالية."); await utils.workspace.customers.list.invalidate(); }, onError: error => toast.error(error.message) });
  const updateCustomerStatus = trpc.workspace.customers.updateStatus.useMutation({ onSuccess: async customer => { if (customer.changed) toast.success("تم تحديث حالة العميل محليًا في Netora."); await utils.workspace.customers.list.invalidate(); }, onError: error => toast.error(error.message) });
  const assignServicePlan = trpc.workspace.customers.assignServicePlan.useMutation({ onSuccess: async assignment => { toast.success(`تم إسناد باقة للعميل داخل Netora.`); await utils.workspace.customers.list.invalidate(); }, onError: error => toast.error(error.message) });
  const importCsvMutation = trpc.workspace.customers.importCsv.useMutation({
      onSuccess: async (data) => {
          toast.success(`تم استيراد ${data.created} عميل ورفض ${data.rejected}.`);
          await utils.workspace.customers.list.invalidate();
      },
      onError: error => toast.error(error.message)
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
          const content = e.target?.result as string;
          if (content) {
              importCsvMutation.mutate({ organizationSlug, content });
          }
      };
      reader.readAsText(file);
      if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const updateSearch = (value: string) => { setSearch(value); setOffset(0); }; const updateStatus = (value: CustomerStatus) => { setStatus(value); setOffset(0); }; const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return <div className="grid gap-5 xl:grid-cols-[.75fr_1.25fr]">
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(23,35,61,.035)]">
        <p className="text-xs font-bold text-violet-600">إضافة عميل</p>
        <p className="mt-2 text-xs leading-6 text-slate-500">اسم مستخدم العميل فريد داخل المؤسسة فقط، ويتحقق الخادم من النطاق والحالة قبل الحفظ.</p>
        <div className="mt-4 space-y-3">
            <input value={name} onChange={event => setName(event.target.value)} placeholder="الاسم الكامل" className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-violet-400" />
            <input value={username} onChange={event => setUsername(event.target.value)} placeholder="اسم المستخدم" dir="ltr" className="h-10 w-full rounded-xl border border-slate-200 px-3 text-left text-xs outline-none focus:border-violet-400" />
            <button disabled={createCustomer.isPending} onClick={() => { if (!name.trim() || !username.trim()) { toast.error("أدخل الاسم واسم المستخدم."); return; } createCustomer.mutate({ organizationSlug, fullName: name.trim(), username: username.trim() }); }} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-violet-600 text-xs font-bold text-white disabled:opacity-60 hover:bg-violet-700 transition-colors">
                <UsersRound className="h-4 w-4" />{createCustomer.isPending ? "جارٍ الحفظ…" : "إضافة العميل"}
            </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(23,35,61,.035)]">
        <p className="text-xs font-bold text-slate-900">استيراد وتصدير</p>
        <p className="mt-2 text-[11px] leading-5 text-slate-500">استيراد العملاء من ملف CSV يحتوي على (fullName, username) كأعمدة.</p>
        <div className="mt-4 flex gap-3">
            <button
                onClick={() => fileInputRef.current?.click()}
                disabled={importCsvMutation.isPending}
                className="flex-1 inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-slate-100 text-[11px] font-bold text-slate-700 hover:bg-slate-200 transition-colors disabled:opacity-50"
            >
                <Upload className="h-3.5 w-3.5" />
                {importCsvMutation.isPending ? "جار الاستيراد..." : "استيراد CSV"}
            </button>
            <input
                type="file"
                accept=".csv"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
            />
        </div>
      </section>
    </div>

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(23,35,61,.035)]">
        <div className="border-b border-slate-100 px-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h2 className="text-sm font-bold text-slate-900">دليل العملاء</h2>
                <p className="mt-1 text-xs text-slate-500">تصفح وإدارة عملاء المؤسسة وتعيين الباقات.</p>
            </div>
            <div className="flex flex-wrap gap-2">
                <input value={search} onChange={event => updateSearch(event.target.value)} placeholder="ابحث بالاسم، المستخدم، الهاتف" className="h-9 min-w-[190px] rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-violet-400" />
                <select value={status} onChange={event => updateStatus(event.target.value as CustomerStatus)} className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none">
                    <option value="all">كل الحالات</option>
                    <option value="active">نشط</option>
                    <option value="suspended">معلّق</option>
                    <option value="blocked">محظور</option>
                    <option value="archived">مؤرشف</option>
                </select>
            </div>
        </div>

        {customersQuery.isLoading ? <p className="py-12 text-center text-xs text-slate-500">يجري تحميل العملاء…</p> : customersQuery.error ? <p className="py-12 text-center text-xs text-rose-700">تعذر تحميل العملاء؛ تأكد من اتصالك بالخادم.</p> : customersQuery.data?.length ? <>
            <div className="overflow-x-auto">
                <table className="min-w-[920px] w-full text-right">
                    <thead className="bg-slate-50/50 text-[11px] text-slate-500 border-b border-slate-100">
                        <tr>
                            <th className="px-5 py-3 font-medium">اسم العميل</th>
                            <th className="font-medium">اسم المستخدم</th>
                            <th className="font-medium">الحالة</th>
                            <th className="font-medium">الباقة المخصصة</th>
                            <th className="font-medium">إجراءات سريعة</th>
                            <th className="px-5 font-medium">تاريخ الإضافة</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {customersQuery.data.map(customer => <tr key={customer.id} className="text-xs hover:bg-slate-50/50 transition-colors">
                            <td className="px-5 py-3.5 font-bold text-slate-800">{customer.fullName}</td>
                            <td dir="ltr" className="text-left font-mono text-[11px] text-slate-600">{customer.username}</td>
                            <td><Status value={customer.status} /></td>
                            <td>
                                <select value={String(customer.servicePlanId ?? "")} disabled={customer.status === "archived" || activePlansQuery.isLoading || assignServicePlan.isPending} onChange={event => { const servicePlanId = Number(event.target.value); if (servicePlanId) assignServicePlan.mutate({ organizationSlug, customerId: customer.id, servicePlanId }); }} className="h-8 max-w-40 rounded-lg border border-slate-200 bg-white px-2 text-[11px] text-slate-700 outline-none disabled:opacity-50 hover:border-slate-300 transition-colors">
                                    <option value="">{customer.servicePlanName ?? "بلا باقة"}</option>
                                    {activePlansQuery.data?.map(plan => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
                                </select>
                            </td>
                            <td>
                                {customer.status === "archived" ? <span className="text-[11px] text-slate-400">مؤرشف نهائيًا</span> : <select value={customer.status} disabled={updateCustomerStatus.isPending} onChange={event => updateCustomerStatus.mutate({ organizationSlug, customerId: customer.id, status: event.target.value as Exclude<CustomerStatus, "all"> })} className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[11px] text-slate-700 outline-none disabled:opacity-60 hover:border-slate-300 transition-colors">
                                    <option value="active">نشط</option>
                                    <option value="suspended">تعليق</option>
                                    <option value="blocked">حظر</option>
                                    <option value="archived">أرشفة</option>
                                </select>}
                            </td>
                            <td className="px-5 text-slate-500">{new Date(customer.createdAt).toLocaleDateString("ar")}</td>
                        </tr>)}
                    </tbody>
                </table>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 bg-slate-50/50">
                <span className="text-[11px] text-slate-500 font-medium">الصفحة {currentPage}</span>
                <div className="flex gap-1.5">
                    <button disabled={offset === 0} onClick={() => setOffset(current => Math.max(0, current - PAGE_SIZE))} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-bold text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition-colors">
                        <ChevronRight className="h-3.5 w-3.5" />السابق
                    </button>
                    <button disabled={customersQuery.data.length < PAGE_SIZE} onClick={() => setOffset(current => current + PAGE_SIZE)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-bold text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition-colors">
                        التالي<ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>
        </> : <div className="py-16 text-center"><UsersRound className="h-10 w-10 text-slate-200 mx-auto mb-3" /><p className="text-sm font-medium text-slate-600">لا توجد نتائج</p><p className="mt-1 text-xs text-slate-400">حاول تغيير كلمات البحث أو مرشح الحالة.</p></div>}
    </section>
  </div>;
}
