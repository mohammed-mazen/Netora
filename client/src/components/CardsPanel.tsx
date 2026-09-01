import { trpc } from "@/lib/trpc";
import { Boxes, CreditCard, Plus, Tags, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const moneyRe = /^\d{1,10}(?:\.\d{1,2})?$/;
const bulkActions = [
  { value: "delete", label: "إتلاف / إلغاء" },
  { value: "stop", label: "إيقاف / إنهاء" },
  { value: "group_change", label: "نقل مجموعة" },
] as const;

export function CardsPanel({ organizationSlug }: { organizationSlug: string }) {
  const utils = trpc.useUtils();
  const [catName, setCatName] = useState("");
  const [catAmount, setCatAmount] = useState("0");
  const [catPriceType, setCatPriceType] = useState<"fixed" | "customer">("fixed");
  const [groupName, setGroupName] = useState("");
  const [groupCategoryId, setGroupCategoryId] = useState("");
  const [limitUsers, setLimitUsers] = useState("1");
  const [bulkAction, setBulkAction] = useState<(typeof bulkActions)[number]["value"]>("delete");
  const [bulkSerials, setBulkSerials] = useState("");
  const [bulkTargetGroupId, setBulkTargetGroupId] = useState("");
  const [importCsv, setImportCsv] = useState("code,serial\n");
  const [importPlanId, setImportPlanId] = useState("");

  const categoriesQuery = trpc.cards.categories.list.useQuery(
    { organizationSlug },
    { enabled: Boolean(organizationSlug), retry: false },
  );
  const groupsQuery = trpc.cards.groups.list.useQuery(
    { organizationSlug },
    { enabled: Boolean(organizationSlug), retry: false },
  );
  const bulkHistoryQuery = trpc.cards.bulk.list.useQuery(
    { organizationSlug, limit: 12, offset: 0 },
    { enabled: Boolean(organizationSlug), retry: false },
  );
  const importJobsQuery = trpc.cards.imports.list.useQuery(
    { organizationSlug, limit: 12, offset: 0 },
    { enabled: Boolean(organizationSlug), retry: false },
  );
  const activePlansQuery = trpc.workspace.servicePlans.list.useQuery(
    { organizationSlug, limit: 100, offset: 0, status: "active" },
    { enabled: Boolean(organizationSlug), retry: false },
  );

  const createCategory = trpc.cards.categories.create.useMutation({
    onSuccess: async () => {
      setCatName("");
      setCatAmount("0");
      toast.success("تم إنشاء الفئة.");
      await utils.cards.categories.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const createGroup = trpc.cards.groups.create.useMutation({
    onSuccess: async () => {
      setGroupName("");
      toast.success("تم إنشاء المجموعة.");
      await utils.cards.groups.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const createBulk = trpc.cards.bulk.create.useMutation({
    onSuccess: async (result) => {
      setBulkSerials("");
      toast.success(`تم تنفيذ العملية على ${result.affectedCards} بطاقة.`);
      await utils.cards.bulk.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const createImport = trpc.cards.imports.create.useMutation({
    onSuccess: async (result) => {
      setImportCsv("code,serial\n");
      toast.success(`تم استيراد ${result.importedRows} قسيمة.`);
      await utils.cards.imports.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const parsedSerials = useMemo(
    () => bulkSerials.split(/[\n,;]+/).map((item) => item.trim()).filter(Boolean),
    [bulkSerials],
  );

  if (!organizationSlug) {
    return (
      <section className="rounded-2xl border border-dashed border-violet-200 bg-violet-50/60 p-5 text-xs text-slate-600">
        اختر مؤسسة أولًا لإدارة البطاقات.
      </section>
    );
  }

  const categories = categoriesQuery.data ?? [];
  const groups = groupsQuery.data ?? [];
  const bulkHistory = bulkHistoryQuery.data ?? [];
  const importJobs = importJobsQuery.data ?? [];
  const activePlans = activePlansQuery.data ?? [];

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(23,35,61,.035)]">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-bold text-slate-900">
            <Tags className="ml-2 inline h-4 w-4 text-violet-600" />
            فئات البطاقات
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            تسعير ثابت أو حسب العميل، مع أسعار تجزئة/جملة اختيارية.
          </p>
        </div>

        <div className="grid gap-2 p-5 md:grid-cols-4">
          <input
            value={catName}
            onChange={(event) => setCatName(event.target.value)}
            placeholder="اسم الفئة"
            className="h-9 rounded-xl border border-slate-200 px-3 text-xs outline-none"
          />
          <select
            value={catPriceType}
            onChange={(event) => setCatPriceType(event.target.value as typeof catPriceType)}
            className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-xs outline-none"
          >
            <option value="fixed">سعر ثابت</option>
            <option value="customer">حسب العميل</option>
          </select>
          <input
            value={catAmount}
            onChange={(event) => setCatAmount(event.target.value)}
            dir="ltr"
            placeholder="المبلغ"
            className="h-9 rounded-xl border border-slate-200 px-3 text-left text-xs outline-none"
          />
          <button
            disabled={createCategory.isPending}
            onClick={() => {
              if (!catName.trim() || !moneyRe.test(catAmount)) {
                toast.error("أدخل اسمًا ومبلغًا صحيحين.");
                return;
              }
              createCategory.mutate({
                organizationSlug,
                name: catName.trim(),
                priceType: catPriceType,
                amount: catAmount,
              });
            }}
            className="inline-flex h-9 items-center justify-center gap-1 rounded-xl bg-violet-600 text-xs font-bold text-white disabled:opacity-60"
          >
            <Plus className="h-3.5 w-3.5" />
            إضافة
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[420px] w-full text-right text-xs">
            <thead className="bg-slate-50 text-[11px] text-slate-500">
              <tr>
                <th className="px-5 py-2">الفئة</th>
                <th>النوع</th>
                <th className="px-5">المبلغ</th>
              </tr>
            </thead>
            <tbody>
              {categories.length ? (
                categories.map((category) => (
                  <tr key={category.id} className="border-t border-slate-100">
                    <td className="px-5 py-2 font-bold text-slate-800">{category.name}</td>
                    <td className="text-slate-500">{category.priceType}</td>
                    <td dir="ltr" className="px-5 text-left text-slate-700">
                      {category.amount}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-slate-400">
                    لا توجد فئات بعد.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(23,35,61,.035)]">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-bold text-slate-900">
            <CreditCard className="ml-2 inline h-4 w-4 text-violet-600" />
            مجموعات البطاقات
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            ضبط حدود المستخدمين وربط المجموعة بفئة البطاقة.
          </p>
        </div>

        <div className="grid gap-2 p-5 md:grid-cols-4">
          <input
            value={groupName}
            onChange={(event) => setGroupName(event.target.value)}
            placeholder="اسم المجموعة"
            className="h-9 rounded-xl border border-slate-200 px-3 text-xs outline-none"
          />
          <select
            value={groupCategoryId}
            onChange={(event) => setGroupCategoryId(event.target.value)}
            className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-xs outline-none"
          >
            <option value="">بدون فئة</option>
            {categories.map((category) => (
              <option key={category.id} value={String(category.id)}>
                {category.name}
              </option>
            ))}
          </select>
          <input
            value={limitUsers}
            onChange={(event) => setLimitUsers(event.target.value)}
            inputMode="numeric"
            placeholder="عدد المستخدمين"
            className="h-9 rounded-xl border border-slate-200 px-3 text-xs outline-none"
          />
          <button
            disabled={createGroup.isPending}
            onClick={() => {
              if (!groupName.trim()) {
                toast.error("أدخل اسم المجموعة.");
                return;
              }
              createGroup.mutate({
                organizationSlug,
                name: groupName.trim(),
                categoryId: groupCategoryId ? Number(groupCategoryId) : null,
                limitUsers: Number(limitUsers || 1),
              });
            }}
            className="inline-flex h-9 items-center justify-center gap-1 rounded-xl bg-violet-600 text-xs font-bold text-white disabled:opacity-60"
          >
            <Plus className="h-3.5 w-3.5" />
            إضافة
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[460px] w-full text-right text-xs">
            <thead className="bg-slate-50 text-[11px] text-slate-500">
              <tr>
                <th className="px-5 py-2">المجموعة</th>
                <th>الفئة</th>
                <th>المستخدمون</th>
              </tr>
            </thead>
            <tbody>
              {groups.length ? (
                groups.map((group) => (
                  <tr key={group.id} className="border-t border-slate-100">
                    <td className="px-5 py-2 font-bold text-slate-800">{group.name}</td>
                    <td className="text-slate-500">{group.categoryName || "—"}</td>
                    <td className="text-slate-700">{group.limitUsers}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-slate-400">
                    لا توجد مجموعات بعد.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(23,35,61,.035)] xl:col-span-2">
        <div className="grid gap-5 p-5 xl:grid-cols-[.9fr_1.1fr]">
          <div>
            <p className="text-xs font-bold text-violet-600">عمليات مجمعة</p>
            <h2 className="mt-1 text-sm font-bold text-slate-900">
              <Zap className="ml-2 inline h-4 w-4 text-violet-600" />
              إدارة جماعية للبطاقات
            </h2>
            <p className="mt-2 text-xs leading-6 text-slate-500">
              تنفيذ إيقاف أو إلغاء أو نقل مجموعة لعدد كبير من البطاقات دفعة واحدة، مع سجل واضح للنتائج.
            </p>

            <div className="mt-4 grid gap-3">
              <select
                value={bulkAction}
                onChange={(event) =>
                  setBulkAction(event.target.value as (typeof bulkActions)[number]["value"])
                }
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none"
              >
                {bulkActions.map((action) => (
                  <option key={action.value} value={action.value}>
                    {action.label}
                  </option>
                ))}
              </select>

              {bulkAction === "group_change" ? (
                <select
                  value={bulkTargetGroupId}
                  onChange={(event) => setBulkTargetGroupId(event.target.value)}
                  className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none"
                >
                  <option value="">اختر المجموعة الهدف</option>
                  {groups.map((group) => (
                    <option key={group.id} value={String(group.id)}>
                      {group.name}
                    </option>
                  ))}
                </select>
              ) : null}

              <textarea
                value={bulkSerials}
                onChange={(event) => setBulkSerials(event.target.value)}
                rows={8}
                placeholder="ألصق السيريالات، كل سيريال في سطر أو افصل بينها بفاصلة"
                className="rounded-2xl border border-slate-200 px-3 py-3 text-xs outline-none"
              />

              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>
                  <Boxes className="ml-1 inline h-3.5 w-3.5" />
                  عدد البطاقات المرصودة: {parsedSerials.length}
                </span>
                <button
                  disabled={createBulk.isPending}
                  onClick={() => {
                    if (!parsedSerials.length) {
                      toast.error("ألصق سيريالًا واحدًا على الأقل.");
                      return;
                    }
                    if (bulkAction === "group_change" && !bulkTargetGroupId) {
                      toast.error("اختر المجموعة الهدف أولًا.");
                      return;
                    }
                    createBulk.mutate({
                      organizationSlug,
                      action: bulkAction,
                      serials: parsedSerials,
                      targetGroupId: bulkAction === "group_change" ? Number(bulkTargetGroupId) : null,
                    });
                  }}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-violet-600 px-4 text-xs font-bold text-white disabled:opacity-60"
                >
                  <Zap className="h-3.5 w-3.5" />
                  تنفيذ العملية
                </button>
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-violet-600">السجل</p>
            <h3 className="mt-1 text-sm font-bold text-slate-900">آخر العمليات المجمعة</h3>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-[520px] w-full text-right text-xs">
                <thead className="bg-slate-50 text-[11px] text-slate-500">
                  <tr>
                    <th className="px-5 py-2">العملية</th>
                    <th>الحالة</th>
                    <th>الإجمالي</th>
                    <th>نجح</th>
                    <th>فشل</th>
                  </tr>
                </thead>
                <tbody>
                  {bulkHistory.length ? (
                    bulkHistory.map((job) => (
                      <tr key={job.id} className="border-t border-slate-100">
                        <td className="px-5 py-2 font-bold text-slate-800">{job.action}</td>
                        <td className="text-slate-500">{job.status}</td>
                        <td>{job.totalCards}</td>
                        <td className="text-emerald-700">{job.affectedCards}</td>
                        <td className="text-rose-700">{job.failedCards}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        لا توجد عمليات مجمعة بعد.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(23,35,61,.035)] xl:col-span-2">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-bold text-slate-900">استيراد قسائم CSV</h2>
          <p className="mt-1 text-xs text-slate-500">
            رأس الملف يجب أن يحتوي code ويمكن إضافة serial. تُدرج القسائم الجديدة فقط بعد التحقق من التكرار.
          </p>
        </div>
        <div className="grid gap-5 p-5 lg:grid-cols-2">
          <div className="grid gap-2">
            <select
              value={importPlanId}
              onChange={(event) => setImportPlanId(event.target.value)}
              className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-xs outline-none"
            >
              <option value="">اختر باقة مفعّلة</option>
              {activePlans.map((plan) => (
                <option key={plan.id} value={String(plan.id)}>
                  {plan.name}
                </option>
              ))}
            </select>
            <textarea
              value={importCsv}
              onChange={(event) => setImportCsv(event.target.value)}
              rows={8}
              className="rounded-2xl border border-slate-200 px-3 py-3 font-mono text-xs outline-none"
            />
            <button
              disabled={createImport.isPending}
              onClick={() => {
                if (!importPlanId) {
                  toast.error("اختر باقة مفعّلة أولاً.");
                  return;
                }
                createImport.mutate({
                  organizationSlug,
                  source: "csv",
                  content: importCsv,
                  servicePlanId: Number(importPlanId),
                });
              }}
              className="inline-flex h-10 items-center justify-center rounded-xl bg-violet-600 px-4 text-xs font-bold text-white disabled:opacity-60"
            >
              استيراد القسائم
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[520px] w-full text-right text-xs">
              <thead className="bg-slate-50 text-[11px] text-slate-500">
                <tr>
                  <th className="px-5 py-2">المصدر</th>
                  <th>الحالة</th>
                  <th>الإجمالي</th>
                  <th>أُدرج</th>
                  <th>مكرر</th>
                  <th>غير صالح</th>
                </tr>
              </thead>
              <tbody>
                {importJobs.length ? (
                  importJobs.map((job) => (
                    <tr key={job.id} className="border-t border-slate-100">
                      <td className="px-5 py-2 font-bold text-slate-800">{job.source}</td>
                      <td className="text-slate-500">{job.status}</td>
                      <td>{job.totalRows}</td>
                      <td className="text-emerald-700">{job.importedRows}</td>
                      <td>{job.duplicateRows}</td>
                      <td className="text-rose-700">{job.invalidRows}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      لا توجد مهام استيراد بعد.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
