import { Link } from "wouter";
import { useState } from "react";
import { motion } from "framer-motion";
import { Network, ArrowRight, Check, X, Shield, Zap } from "lucide-react";

export default function Pricing() {
  const [isAnnual, setIsAnnual] = useState(false);

  return (
    <div className="min-h-screen bg-[#f4f7fb] text-slate-900 font-sans overflow-x-hidden" dir="rtl">
      {/* Simple Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 shadow-md">
              <Network className="h-4 w-4 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-900">Netora</span>
          </Link>
          <div className="flex items-center gap-4">
             <Link href="/" className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors flex items-center gap-1">
              العودة للرئيسية <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Pricing Header */}
      <section className="pt-20 pb-12 px-6 text-center max-w-3xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 mb-6">
            أسعار بسيطة، <span className="text-transparent bg-clip-text bg-gradient-to-l from-indigo-600 to-blue-600">بدون مفاجآت</span>
          </h1>
          <p className="text-lg text-slate-600 mb-10 leading-relaxed">
            اختر الخطة المناسبة لحجم شبكتك. جميع الخطط تشمل تجربة مجانية لمدة 14 يوماً بدون الحاجة لبطاقة ائتمانية.
          </p>

          {/* Toggle */}
          <div className="flex items-center justify-center gap-4 mb-8">
            <span className={`text-sm font-bold ${!isAnnual ? 'text-slate-900' : 'text-slate-400'}`}>شهري</span>
            <button
              onClick={() => setIsAnnual(!isAnnual)}
              className="relative w-16 h-8 rounded-full bg-slate-200 p-1 transition-colors hover:bg-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              aria-label="تبديل الدفع السنوي"
            >
              <div className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow-sm transition-transform duration-300 ${isAnnual ? 'translate-x-[-32px] bg-indigo-600' : 'translate-x-0'}`} />
            </button>
            <span className={`flex items-center gap-2 text-sm font-bold ${isAnnual ? 'text-slate-900' : 'text-slate-400'}`}>
              سنوي <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 text-[10px]">خصم 20%</span>
            </span>
          </div>
        </motion.div>
      </section>

      {/* Pricing Cards */}
      <section className="px-6 pb-24 max-w-7xl mx-auto">
        <div className="grid md:grid-cols-3 gap-8 items-center max-w-5xl mx-auto">

          {/* Basic Plan */}
          <PricingCard
            title="الأساسية"
            desc="مثالية للشبكات الصغيرة والمبتدئين."
            price={isAnnual ? "79" : "99"}
            features={[
              { t: "1 راوتر مايكروتيك", in: true },
              { t: "حتى 500 عميل نشط", in: true },
              { t: "إدارة الباقات والسرعات", in: true },
              { t: "استوديو طباعة الكروت", in: true },
              { t: "محاسبة أساسية", in: false },
              { t: "نظام التذاكر والدعم", in: false },
            ]}
          />

          {/* Pro Plan */}
          <PricingCard
            title="المتقدمة"
            desc="لأصحاب الشبكات المتوسطة الطموحين."
            price={isAnnual ? "159" : "199"}
            highlighted
            features={[
              { t: "حتى 5 راوترات مايكروتيك", in: true },
              { t: "حتى 2000 عميل نشط", in: true },
              { t: "إدارة الباقات والسرعات", in: true },
              { t: "استوديو طباعة الكروت", in: true },
              { t: "محاسبة متقدمة وفواتير ضريبية", in: true },
              { t: "دعم RADIUS متكامل", in: true },
              { t: "بوابة SMS للتنبيهات", in: true },
            ]}
          />

          {/* Enterprise Plan */}
          <PricingCard
            title="الاحترافية"
            desc="للمؤسسات والشركات الكبرى."
            price={isAnnual ? "319" : "399"}
            features={[
              { t: "عدد لا محدود من الراوترات", in: true },
              { t: "عملاء نشطين غير محدودين", in: true },
              { t: "واجهة تقارير مخصصة", in: true },
              { t: "صلاحيات وأدوار مخصصة", in: true },
              { t: "تصدير نسخ احتياطية للبيانات", in: true },
              { t: "دعم فني على مدار الساعة", in: true },
              { t: "مدير حساب مخصص", in: true },
            ]}
          />

        </div>
      </section>

      {/* FAQ Section (Placeholder) */}
      <section className="bg-white py-24 border-t border-slate-200">
        <div className="max-w-3xl mx-auto px-6 text-center">
           <h2 className="text-3xl font-bold mb-10">هل لديك أسئلة؟</h2>
           <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-4">
                <Shield className="w-8 h-8 text-indigo-500" />
                <div className="text-right">
                  <h4 className="font-bold text-slate-900">أمان البيانات</h4>
                  <p className="text-sm text-slate-500">نستخدم تشفير AES-256 لحفظ بياناتك.</p>
                </div>
              </div>
              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-4">
                <Zap className="w-8 h-8 text-blue-500" />
                <div className="text-right">
                  <h4 className="font-bold text-slate-900">ترقية سريعة</h4>
                  <p className="text-sm text-slate-500">يمكنك الترقية في أي وقت بضغطة زر.</p>
                </div>
              </div>
           </div>
        </div>
      </section>

    </div>
  );
}

function PricingCard({ title, desc, price, features, highlighted }: {
  title: string;
  desc: string;
  price: string;
  features: {t: string, in: boolean}[];
  highlighted?: boolean
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -5 }}
      transition={{ duration: 0.3 }}
      className={`relative bg-white rounded-3xl p-8 flex flex-col h-full ${
        highlighted
        ? 'border-2 border-indigo-500 shadow-2xl shadow-indigo-500/10 lg:scale-105 z-10'
        : 'border border-slate-200 shadow-sm'
      }`}
    >
      {highlighted && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <span className="bg-gradient-to-r from-indigo-500 to-blue-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
            الأكثر طلباً
          </span>
        </div>
      )}

      <div className="mb-8">
        <h3 className={`text-2xl font-bold mb-2 ${highlighted ? 'text-indigo-600' : 'text-slate-900'}`}>{title}</h3>
        <p className="text-slate-500 text-sm">{desc}</p>
      </div>

      <div className="mb-8">
        <span className="text-4xl font-extrabold text-slate-900">${price}</span>
        <span className="text-slate-500 font-medium"> / شهر</span>
      </div>

      <ul className="space-y-4 mb-8 flex-1">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-3 text-sm">
            {f.in ? (
              <div className="mt-0.5 shrink-0 w-5 h-5 rounded-full bg-indigo-50 flex items-center justify-center">
                <Check className="w-3 h-3 text-indigo-600" />
              </div>
            ) : (
              <div className="mt-0.5 shrink-0 w-5 h-5 rounded-full bg-slate-50 flex items-center justify-center">
                <X className="w-3 h-3 text-slate-400" />
              </div>
            )}
            <span className={f.in ? 'text-slate-700 font-medium' : 'text-slate-400 line-through'}>{f.t}</span>
          </li>
        ))}
      </ul>

      <Link
        href="/trial"
        className={`w-full block text-center py-3.5 rounded-xl font-bold transition-all ${
          highlighted
          ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white hover:shadow-lg hover:shadow-indigo-500/25'
          : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 hover:text-slate-900'
        }`}
      >
        ابدأ الآن مجاناً
      </Link>
    </motion.div>
  );
}