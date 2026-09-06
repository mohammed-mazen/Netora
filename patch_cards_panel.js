const fs = require('fs');

let content = fs.readFileSync('client/src/components/CardsPanel.tsx', 'utf8');

const importSection = `      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(23,35,61,.035)] xl:col-span-2">
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
      </section>`;

// Replace import section with a batches section as well
const batchesSection = `      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(23,35,61,.035)] xl:col-span-2">
        <div className="border-b border-slate-100 px-5 py-4 flex items-center justify-between">
          <div>
              <h2 className="text-sm font-bold text-slate-900">إدارة دفعات البطاقات (Voucher Batches)</h2>
              <p className="mt-1 text-xs text-slate-500">
                توليد كميات من البطاقات للباقات المفعّلة، وإرسالها للطباعة عبر استوديو التصميم.
              </p>
          </div>
        </div>
        <div className="grid gap-5 p-5 lg:grid-cols-2">
          <div className="grid gap-2">
            <select
              id="batch-plan-select"
              className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-xs outline-none"
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
              id="batch-qty-input"
              min="1"
              max="250"
              defaultValue="50"
              placeholder="الكمية (الحد الأقصى 250)"
              className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none"
            />
            <button
              onClick={() => {
                const planId = (document.getElementById('batch-plan-select') as HTMLSelectElement).value;
                const qty = (document.getElementById('batch-qty-input') as HTMLInputElement).value;
                if (!planId || !qty) {
                  toast.error("اختر باقة وأدخل الكمية.");
                  return;
                }
                // use utils to dispatch since hooks can't be added here easily
                // we'll patch the whole file instead to be safe.
              }}
              className="inline-flex h-10 items-center justify-center rounded-xl bg-violet-600 px-4 text-xs font-bold text-white hover:bg-violet-700 transition-colors"
            >
              إصدار دفعة جديدة
            </button>
          </div>
          <div className="overflow-x-auto">
            {/* Batches list */}
          </div>
        </div>
      </section>`;

// let's do a full replacement using AST or just string replacement to add the hooks.
