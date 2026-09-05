import { Link } from "wouter";
import { ArrowRight } from "lucide-react";

export default function Privacy() {
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
          سياسة الخصوصية
        </h1>
        <div className="prose prose-slate max-w-none text-slate-600 space-y-6">
          <p>
            في Netora، نولي أهمية قصوى لخصوصية عملائنا ونلتزم بحماية المعلومات الشخصية وبيانات الشبكات. توضح هذه السياسة كيف نجمع المعلومات ونستخدمها ونحميها.
          </p>

          <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">1. المعلومات التي نجمعها</h3>
          <p>
            نقوم بجمع المعلومات اللازمة لتقديم خدماتنا، بما في ذلك بيانات الحساب (مثل الاسم والبريد الإلكتروني)، ومعلومات الاتصال بأجهزة الشبكة (RouterOS)، وسجلات النشاط المالي للمشتركين داخل مساحة العمل الخاصة بك.
          </p>

          <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">2. كيف نستخدم المعلومات</h3>
          <p>
            نستخدم المعلومات لتقديم وصيانة خدمات Netora، ومعالجة المعاملات المالية، وتوفير الدعم الفني، وإرسال التنبيهات المتعلقة بصحة الشبكة والخدمات. لا يتم بيع أو تأجير أي من بياناتك أو بيانات عملائك لأطراف خارجية.
          </p>

          <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">3. أمان البيانات والعزل الخادمي</h3>
          <p>
            تطبق منصتنا بنية معزولة (Multi-tenant) لضمان عدم وصول أي مستأجر لبيانات مستأجر آخر. تخضع أسرار التكاملات (مثل بيانات الدخول للراوترات وكلمات مرور RADIUS) لتشفير AES-256 لحمايتها حتى في حالات الوصول المباشر لقواعد البيانات.
          </p>
        </div>
      </section>
    </div>
  );
}
