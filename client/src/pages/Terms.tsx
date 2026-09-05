import { Link } from "wouter";
import { ArrowRight } from "lucide-react";

export default function Terms() {
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
          الشروط والأحكام
        </h1>
        <div className="prose prose-slate max-w-none text-slate-600 space-y-6">
          <p>
            تحدد هذه الشروط اتفاقية استخدام منصة Netora. باستخدامك لخدماتنا، فإنك توافق على هذه الشروط والأحكام.
          </p>

          <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">1. نطاق الخدمة</h3>
          <p>
            توفر Netora منصة سحابية كخدمة (SaaS) لإدارة شبكات WISP/WiFi والتحكم بأجهزة MikroTik وإدارة الاشتراكات والمحاسبة. توافر الخدمة يخضع لأحكام اشتراكك ومستوى الخطة المختارة.
          </p>

          <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">2. مسؤوليات العميل</h3>
          <p>
            أنت مسؤول عن حفظ أمان حسابك، بيانات الاعتماد للراوترات، وأي وصول تمنحه لأعضاء فريقك. المنصة ليست مسؤولة عن التعديلات التي يقوم بها أي مستخدم مصرح له داخل مؤسستك.
          </p>

          <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">3. التجربة والفوترة</h3>
          <p>
            نقدم فترة تجربة مجانية تتيح الوصول لبعض أو كل الميزات لاختبار توافق المنصة مع أجهزتك. الاستمرار بعد فترة التجربة يتطلب اشتراكاً مدفوعاً وفق الكتالوج المعلن للمنصة.
          </p>

          <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">4. التوافر والتعديل</h3>
          <p>
            نسعى للحفاظ على استقرار الخدمة بنسبة 99.9%، ولكن نحتفظ بالحق في إيقاف الخدمة مؤقتاً لأغراض الصيانة مع إشعار مسبق.
          </p>
        </div>
      </section>
    </div>
  );
}
