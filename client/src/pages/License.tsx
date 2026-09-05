import { Link } from "wouter";
import { ArrowRight } from "lucide-react";

export default function License() {
  return (
    <div className="min-h-screen bg-[#f4f7fb] text-slate-900 font-sans overflow-x-hidden" dir="rtl">
      {/* Simple Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <span className="text-xl font-bold text-slate-900">Netora</span>
          </Link>
          <div className="flex items-center gap-4">
             <Link href="/" className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors flex items-center gap-1">
              العودة للرئيسية <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <section className="pt-20 pb-24 px-6 max-w-3xl mx-auto">
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 mb-6">
          معلومات الترخيص
        </h1>
        <div className="prose prose-slate max-w-none text-slate-600 space-y-6">
          <p>
            تعتمد منصة Netora على مجموعة من التقنيات والبرمجيات مفتوحة المصدر لبناء خدماتها وإدارتها. يحدد هذا المستند الشروط المتعلقة بالبرمجيات والمكتبات المُضمنة.
          </p>
          <p>
            تمتلك Netora الحقوق الفكرية والتجارية الحصرية للكود المصدري للمنصة باستثناء المكتبات المفتوحة المصدر (مثل React، Node.js، MySQL، ومكتبات واجهة المستخدم).
          </p>
          <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">تراخيص الجهات الخارجية</h3>
          <p>
            تخضع كل مكتبة من الجهات الخارجية المضمنة في المنصة لشروط ترخيصها الخاص (مثل MIT أو Apache 2.0). لا تمنحك اتفاقية الخدمة هذه الحق في استنساخ أو توزيع الكود التجاري المغلق لمنصة Netora أو بيعه كمنتج برمجي مستقل.
          </p>
        </div>
      </section>
    </div>
  );
}
