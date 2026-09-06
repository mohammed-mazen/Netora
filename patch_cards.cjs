const fs = require('fs');
let content = fs.readFileSync('client/src/components/CardsPanel.tsx', 'utf8');

const hookAddition = `  const batchesQuery = trpc.workspace.vouchers.listBatches.useQuery(
    { organizationSlug, limit: 5, offset: 0 },
    { enabled: Boolean(organizationSlug), retry: false }
  );

  const [batchPlanId, setBatchPlanId] = useState("");
  const [batchQty, setBatchQty] = useState("50");

  const issueBatchMutation = trpc.workspace.vouchers.issueBatch.useMutation({
    onSuccess: async () => {
      setBatchQty("50");
      toast.success("تم إصدار دفعة البطاقات بنجاح.");
      await utils.workspace.vouchers.listBatches.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
`;

content = content.replace('  const activePlans = activePlansQuery.data ?? [];', hookAddition + '\n  const activePlans = activePlansQuery.data ?? [];');

const batchesSectionUI = `      {/* Batches Section */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(23,35,61,.035)] xl:col-span-2">
        <div className="border-b border-slate-100 px-5 py-4 flex items-center justify-between">
          <div>
              <h2 className="text-sm font-bold text-slate-900">إدارة دفعات البطاقات (Voucher Batches)</h2>
              <p className="mt-1 text-xs text-slate-500">
                توليد كميات من البطاقات للباقات المفعّلة. يمكن إرسالها لاحقاً للطباعة.
              </p>
          </div>
        </div>
        <div className="grid gap-5 p-5 lg:grid-cols-2">
          <div className="grid gap-2">
            <select
              value={batchPlanId}
              onChange={(event) => setBatchPlanId(event.target.value)}
              className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-xs outline-none focus:border-violet-400"
            >
              <option value="">اختر باقة مفعّلة</option>
              {activePlans.map((plan) => (
                <option key={plan.id} value={String(plan.id)}>
                  {plan.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              min="1"
              max="250"
              value={batchQty}
              onChange={(e) => setBatchQty(e.target.value)}
              placeholder="الكمية (الحد الأقصى 250)"
              className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-violet-400"
            />
            <button
              disabled={issueBatchMutation.isPending}
              onClick={() => {
                if (!batchPlanId || !batchQty) {
                  toast.error("اختر باقة وأدخل الكمية.");
                  return;
                }
                issueBatchMutation.mutate({
                   organizationSlug,
                   servicePlanId: Number(batchPlanId),
                   quantity: Number(batchQty)
                });
              }}
              className="inline-flex h-10 items-center justify-center rounded-xl bg-violet-600 px-4 text-xs font-bold text-white hover:bg-violet-700 transition-colors disabled:opacity-50"
            >
              {issueBatchMutation.isPending ? "جارِ التوليد..." : "إصدار دفعة جديدة"}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[520px] w-full text-right text-xs">
              <thead className="bg-slate-50 text-[11px] text-slate-500">
                <tr>
                  <th className="px-5 py-2">المرجع</th>
                  <th>الباقة</th>
                  <th>الكمية</th>
                  <th>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {batchesQuery.data?.length ? (
                  batchesQuery.data.map((batch) => (
                    <tr key={batch.id} className="border-t border-slate-100">
                      <td className="px-5 py-2 font-mono font-bold text-slate-800 text-[10px]" dir="ltr">{batch.reference}</td>
                      <td className="text-slate-600 font-medium">{batch.planName}</td>
                      <td className="text-indigo-600 font-bold">{batch.quantity}</td>
                      <td>
                        <span className={\`px-2 py-1 rounded-full text-[10px] font-bold \${batch.status === 'printed' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}\`}>
                          {batch.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400">
                      لا توجد دفعات تم إصدارها بعد.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
`;

content = content.replace('<section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(23,35,61,.035)] xl:col-span-2">', batchesSectionUI + '\n      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(23,35,61,.035)] xl:col-span-2">');

fs.writeFileSync('client/src/components/CardsPanel.tsx', content);
console.log('CardsPanel patched');
