import { Link } from "wouter";

export default function Trial() {
  return (
    <div className="min-h-screen bg-blue-50 py-20 px-4" dir="rtl">
      <div className="max-w-2xl mx-auto bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
        <h1 className="text-3xl font-bold text-slate-900 mb-6 text-center">ابدأ تجربتك المجانية</h1>
        <p className="text-slate-600 mb-8 text-center">احصل على 14 يوماً من التجربة الكاملة لمنصة Netora بدون بطاقة ائتمان.</p>
        <form className="space-y-4" onSubmit={e => e.preventDefault()}>
          <div>
            <label className="block text-sm font-medium mb-1">اسم المؤسسة</label>
            <input type="text" className="w-full border rounded-lg p-2" placeholder="مثال: شبكة الأفق" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">البريد الإلكتروني</label>
            <input type="email" className="w-full border rounded-lg p-2" placeholder="admin@example.com" />
          </div>
          <button className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700">إنشاء حسابي</button>
        </form>
        <div className="mt-8 text-center">
          <Link href="/" className="text-blue-600 hover:underline">العودة للرئيسية</Link>
        </div>
      </div>
    </div>
  );
}
