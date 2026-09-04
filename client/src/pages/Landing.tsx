import { Link } from "wouter";

export default function Landing() {
  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-8 py-4 bg-white border-b border-slate-200">
        <div className="flex items-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-[#6e5eff] to-[#4432d6] text-base font-extrabold text-white">ن</span>
          <span className="text-xl font-bold text-slate-900">Netora</span>
        </div>
        <div className="flex gap-6 items-center font-medium text-slate-600">
          <Link href="/features" className="hover:text-blue-600">الميزات</Link>
          <Link href="/pricing" className="hover:text-blue-600">الأسعار</Link>
          <Link href="/contact" className="hover:text-blue-600">تواصل معنا</Link>
        </div>
        <div className="flex gap-4">
          <Link href="/login" className="px-4 py-2 text-blue-600 font-medium hover:bg-blue-50 rounded-lg">تسجيل الدخول</Link>
          <Link href="/trial" className="px-4 py-2 bg-blue-600 text-white font-medium hover:bg-blue-700 rounded-lg">ابدأ التجربة المجانية</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-20 text-center max-w-4xl mx-auto px-4">
        <h1 className="text-5xl font-extrabold text-slate-900 mb-6 leading-tight">
          منصة إدارة مزودي الإنترنت <span className="text-blue-600">الكاملة والمتكاملة</span>
        </h1>
        <p className="text-xl text-slate-600 mb-10 leading-relaxed">
          نظام سحابي قوي لإدارة شبكات WISP/WiFi متعدد المؤسسات، يشمل إدارة الراوترات، العملاء، الكروت، الفواتير، والمزيد من مكان واحد.
        </p>
        <div className="flex justify-center gap-4">
          <Link href="/trial" className="px-8 py-4 bg-blue-600 text-white text-lg font-bold rounded-xl shadow-lg hover:bg-blue-700 hover:shadow-blue-600/20 transition-all">
            ابدأ التجربة المجانية الآن
          </Link>
          <Link href="/contact" className="px-8 py-4 bg-white text-slate-700 text-lg font-bold rounded-xl shadow-sm border border-slate-200 hover:bg-slate-50 transition-all">
            اطلب عرضاً
          </Link>
        </div>
      </section>

      {/* Features Overview */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-slate-900 mb-12">كل ما تحتاجه لإدارة شبكتك بفعالية</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard title="إدارة MikroTik و RADIUS" desc="تكامل عميق مع الراوترات وإدارة حسابات الجلسات والمصادقة بشكل سلس." icon="🌐" />
            <FeatureCard title="Hotspot و PPPoE" desc="إدارة شاملة لبروتوكولات الاتصال مع العملاء وملفات السرعة بكل دقة." icon="⚡" />
            <FeatureCard title="المحاسبة والفوترة" desc="نظام قيود مزدوجة، فواتير، سندات قبض وصرف، وضرائب متكاملة." icon="💰" />
            <FeatureCard title="طباعة وتصدير الكروت" desc="إنشاء كروت مجمعة، تصميم وطباعة PDF، وتشفير الأكواد بأمان." icon="🎟️" />
            <FeatureCard title="تحليلات الجلسات" desc="متابعة حية لاستهلاك البيانات، الجلسات النشطة، وتقارير شاملة." icon="📊" />
            <FeatureCard title="الإشعارات و SMS" desc="تنبيهات تلقائية للعملاء عبر SMS، تيليجرام، والبريد الإلكتروني." icon="📱" />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-12 text-center">
        <p>© {new Date().getFullYear()} Netora. جميع الحقوق محفوظة.</p>
      </footer>
    </div>
  );
}

function FeatureCard({ title, desc, icon }: { title: string; desc: string; icon: string }) {
  return (
    <div className="p-6 border border-slate-100 rounded-2xl bg-slate-50/50 hover:bg-white hover:shadow-xl hover:-translate-y-1 transition-all">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-xl font-bold text-slate-900 mb-2">{title}</h3>
      <p className="text-slate-600 leading-relaxed">{desc}</p>
    </div>
  );
}
