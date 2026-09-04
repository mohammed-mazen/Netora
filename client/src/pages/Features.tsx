import { Link } from "wouter";

export default function Features() {
  return (
    <div className="min-h-screen bg-white py-20 px-4" dir="rtl">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-slate-900 mb-8 text-center">كل الميزات التي تحتاجها</h1>
        <div className="space-y-12">
          <section>
            <h2 className="text-2xl font-bold text-blue-600 mb-4">إدارة MikroTik و RADIUS</h2>
            <p className="text-slate-600 leading-relaxed text-lg">تحكم كامل بالراوترات، حسابات الجلسات، وقراءة البيانات الحية بفضل تكامل API المتقدم.</p>
          </section>
          <section>
            <h2 className="text-2xl font-bold text-blue-600 mb-4">نظام الفوترة والمحاسبة</h2>
            <p className="text-slate-600 leading-relaxed text-lg">قيود محاسبية مزدوجة، فواتير ضريبية، إدارة المصروفات، وتقارير أرباح وخسائر شاملة.</p>
          </section>
          <section>
            <h2 className="text-2xl font-bold text-blue-600 mb-4">الكروت والعملاء</h2>
            <p className="text-slate-600 leading-relaxed text-lg">توليد آلاف الكروت بنقرة، طباعة بتصاميم مخصصة، وإدارة دورة حياة العميل بسهولة.</p>
          </section>
        </div>
        <div className="mt-12 text-center">
          <Link href="/" className="text-blue-600 hover:underline">العودة للرئيسية</Link>
        </div>
      </div>
    </div>
  );
}
