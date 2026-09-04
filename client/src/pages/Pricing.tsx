import { Link } from "wouter";

export default function Pricing() {
  return (
    <div className="min-h-screen bg-slate-50 text-center py-20 px-4" dir="rtl">
      <h1 className="text-4xl font-bold text-slate-900 mb-6">الخطط والأسعار</h1>
      <p className="text-xl text-slate-600 mb-12">اختر الخطة التي تناسب حجم شبكتك</p>
      <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-8">
        <PricingCard title="أساسي" price="99" features={["1 راوتر", "500 عميل نشط", "دعم فني عادي"]} />
        <PricingCard title="متقدم" price="199" features={["5 راوترات", "2000 عميل نشط", "دعم فني سريع", "رسائل SMS"]} highlighted />
        <PricingCard title="احترافي" price="399" features={["راوترات غير محدودة", "عملاء غير محدودين", "دعم 24/7", "نظام محاسبة كامل"]} />
      </div>
      <div className="mt-12">
        <Link href="/" className="text-blue-600 hover:underline">العودة للرئيسية</Link>
      </div>
    </div>
  );
}

function PricingCard({ title, price, features, highlighted }: { title: string; price: string; features: string[]; highlighted?: boolean }) {
  return (
    <div className={`p-8 rounded-2xl border ${highlighted ? 'border-blue-500 shadow-xl bg-blue-50/10 scale-105' : 'border-slate-200 bg-white'}`}>
      <h3 className="text-2xl font-bold mb-4">{title}</h3>
      <div className="text-4xl font-extrabold mb-6">${price}<span className="text-lg text-slate-500 font-medium">/شهرياً</span></div>
      <ul className="text-right space-y-3 mb-8">
        {features.map((f, i) => (
          <li key={i} className="flex gap-2 items-center"><span className="text-blue-500">✓</span> {f}</li>
        ))}
      </ul>
      <Link href="/trial" className={`block w-full py-3 rounded-lg font-bold transition-all ${highlighted ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-slate-100 text-slate-800 hover:bg-slate-200'}`}>ابدأ الآن</Link>
    </div>
  );
}
