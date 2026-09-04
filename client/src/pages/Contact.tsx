import { Link } from "wouter";

export default function Contact() {
  return (
    <div className="min-h-screen bg-slate-50 py-20 px-4" dir="rtl">
      <div className="max-w-2xl mx-auto bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
        <h1 className="text-3xl font-bold text-slate-900 mb-6 text-center">تواصل معنا</h1>
        <p className="text-slate-600 mb-8 text-center">لطلب عرض أسعار أو الاستفسار عن خدماتنا، يرجى ملء النموذج أدناه.</p>
        <form className="space-y-4" onSubmit={e => e.preventDefault()}>
          <div>
            <label className="block text-sm font-medium mb-1">الاسم</label>
            <input type="text" className="w-full border rounded-lg p-2" placeholder="أدخل اسمك" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">البريد الإلكتروني</label>
            <input type="email" className="w-full border rounded-lg p-2" placeholder="أدخل بريدك الإلكتروني" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">الرسالة</label>
            <textarea className="w-full border rounded-lg p-2 h-32" placeholder="اكتب رسالتك هنا"></textarea>
          </div>
          <button className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700">إرسال</button>
        </form>
        <div className="mt-8 text-center">
          <Link href="/" className="text-blue-600 hover:underline">العودة للرئيسية</Link>
        </div>
      </div>
    </div>
  );
}
