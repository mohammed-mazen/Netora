import { Link } from "wouter";
import { ArrowRight, ChevronDown } from "lucide-react";
import { useState } from "react";

const faqs = [
  {
    q: "هل تدعمون RouterOS 6 و RouterOS 7؟",
    a: "نعم، ندعم كلا الإصدارين بشكل كامل. يتم الاتصال بـ RouterOS 7 عبر REST API، بينما يتم الاتصال بـ RouterOS 6 باستخدام Binary API-SSL المخصص."
  },
  {
    q: "كيف تتم إدارة النسخ الاحتياطي؟",
    a: "يتيح النظام تصدير نسخة احتياطية كاملة للمؤسسة (تتضمن العملاء، الاشتراكات، الجلسات، والفواتير) بصيغة JSON عبر واجهة إدارة المنصة لتتمكن من الاحتفاظ بنسخك محلياً."
  },
  {
    q: "ما هو مدى أمان البيانات في Netora؟",
    a: "نعتمد على بيئة معزولة بالكامل لكل مؤسسة (Multi-tenant)، ونقوم بتشفير بيانات الاعتماد للراوترات وتكاملات RADIUS باستخدام تشفير AES-256، مما يمنع الوصول إليها حتى من قبل فرق الدعم."
  },
  {
    q: "هل يمكنني تجربة المنصة قبل الاشتراك؟",
    a: "بالتأكيد، نوفر فترة تجربة مجانية لمدة 14 يوماً للتعرف على جميع الميزات، بدون الحاجة لإدخال أي بطاقة ائتمانية."
  },
  {
    q: "هل يعمل النظام مع خدمات RADIUS خارجية؟",
    a: "نعم، يمكن ربط Netora مع خوادم FreeRADIUS واستقبال أحداث الاستهلاك (Accounting) والمصادقة (Authentication) بفاعلية."
  }
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

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
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 mb-6 text-center">
          الأسئلة الشائعة
        </h1>
        <p className="text-lg text-slate-600 mb-10 text-center leading-relaxed">
          إليك بعض الإجابات عن الأسئلة الأكثر شيوعاً حول Netora.
        </p>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div key={index} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <button
                className="w-full text-right px-6 py-4 flex justify-between items-center focus:outline-none"
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
              >
                <span className="font-bold text-slate-900">{faq.q}</span>
                <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${openIndex === index ? "rotate-180" : ""}`} />
              </button>
              {openIndex === index && (
                <div className="px-6 pb-4 pt-2 text-slate-600 leading-relaxed border-t border-slate-100">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
