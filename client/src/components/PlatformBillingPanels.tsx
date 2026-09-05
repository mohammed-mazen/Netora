import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { ReceiptText, CircleDollarSign } from "lucide-react";

export function PlatformInvoicesPanel() {
  const [offset, setOffset] = useState(0);
  const { data, isLoading, error } = trpc.platform.billing.listInvoices.useQuery({ offset, limit: 25 });

  if (error) return <div className="text-red-500 text-center p-4">حدث خطأ أثناء تحميل الفواتير.</div>;
  if (isLoading) return <div className="text-gray-500 text-center p-4">جارٍ التحميل...</div>;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <ReceiptText className="w-6 h-6 text-violet-600" />
        <h2 className="text-lg font-bold text-slate-900">فواتير المنصة</h2>
      </div>
      {!data?.length ? (
        <p className="text-center text-slate-500 py-8">لا توجد فواتير.</p>
      ) : (
        <table className="w-full text-right">
          <thead className="bg-slate-50 text-slate-500 text-xs">
            <tr>
              <th className="px-4 py-3">رقم الفاتورة</th>
              <th>المؤسسة</th>
              <th>المبلغ</th>
              <th>الحالة</th>
              <th>تاريخ الإصدار</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {data.map((inv) => (
              <tr key={inv.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-mono text-slate-700">{inv.number}</td>
                <td className="text-slate-600">{inv.organizationName}</td>
                <td className="text-slate-900 font-medium">${inv.total}</td>
                <td>
                  <span className={`px-2 py-1 text-xs rounded-full ${inv.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {inv.status}
                  </span>
                </td>
                <td className="text-slate-500">{inv.issuedAt ? new Date(inv.issuedAt).toLocaleDateString("ar-SA") : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="mt-4 flex justify-between">
        <button disabled={offset === 0} onClick={() => setOffset(o => Math.max(0, o - 25))} className="text-violet-600 disabled:opacity-50 text-sm">السابق</button>
        <button disabled={(data?.length ?? 0) < 25} onClick={() => setOffset(o => o + 25)} className="text-violet-600 disabled:opacity-50 text-sm">التالي</button>
      </div>
    </div>
  );
}

export function PlatformPaymentsPanel() {
  const [offset, setOffset] = useState(0);
  const { data, isLoading, error } = trpc.platform.billing.listPayments.useQuery({ offset, limit: 25 });

  if (error) return <div className="text-red-500 text-center p-4">حدث خطأ أثناء تحميل الدفعات.</div>;
  if (isLoading) return <div className="text-gray-500 text-center p-4">جارٍ التحميل...</div>;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <CircleDollarSign className="w-6 h-6 text-violet-600" />
        <h2 className="text-lg font-bold text-slate-900">سجل الدفعات</h2>
      </div>
      {!data?.length ? (
        <p className="text-center text-slate-500 py-8">لا توجد دفعات مسجلة.</p>
      ) : (
        <table className="w-full text-right">
          <thead className="bg-slate-50 text-slate-500 text-xs">
            <tr>
              <th className="px-4 py-3">المرجع</th>
              <th>المؤسسة</th>
              <th>المبلغ</th>
              <th>طريقة الدفع</th>
              <th>الحالة</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {data.map((pay) => (
              <tr key={pay.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-mono text-slate-700">{pay.reference || '—'}</td>
                <td className="text-slate-600">{pay.organizationName}</td>
                <td className="text-slate-900 font-medium">${pay.amount}</td>
                <td className="text-slate-500">{pay.method}</td>
                <td>
                  <span className={`px-2 py-1 text-xs rounded-full ${pay.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
                    {pay.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="mt-4 flex justify-between">
        <button disabled={offset === 0} onClick={() => setOffset(o => Math.max(0, o - 25))} className="text-violet-600 disabled:opacity-50 text-sm">السابق</button>
        <button disabled={(data?.length ?? 0) < 25} onClick={() => setOffset(o => o + 25)} className="text-violet-600 disabled:opacity-50 text-sm">التالي</button>
      </div>
    </div>
  );
}
