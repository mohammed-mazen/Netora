import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  Network, Zap, CreditCard, Ticket,
  BarChart3, MessageSquare, ShieldCheck,
  Globe, ArrowLeft, CheckCircle2
} from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#0b1020] text-slate-100 font-sans selection:bg-indigo-500/30 overflow-x-hidden" dir="rtl">
      {/* Dynamic Background Effects */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-600/10 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-600/10 blur-[120px]" />
        <div className="absolute top-[40%] left-[60%] w-[30%] h-[30%] rounded-full bg-purple-600/10 blur-[100px]" />
      </div>

      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 bg-[#0b1020]/80 backdrop-blur-md border-b border-white/5 transition-all">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 shadow-[0_0_20px_rgba(99,102,241,0.4)] group-hover:shadow-[0_0_25px_rgba(99,102,241,0.6)] transition-shadow">
              <Network className="h-5 w-5 text-white" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-white">Netora</span>
          </Link>

          <div className="hidden md:flex gap-8 items-center text-sm font-medium text-slate-300">
            <Link href="/features" className="hover:text-white transition-colors relative after:absolute after:bottom-[-4px] after:left-0 after:w-0 after:h-[2px] after:bg-indigo-500 hover:after:w-full after:transition-all">الميزات</Link>
            <Link href="/pricing" className="hover:text-white transition-colors relative after:absolute after:bottom-[-4px] after:left-0 after:w-0 after:h-[2px] after:bg-indigo-500 hover:after:w-full after:transition-all">الأسعار</Link>
            <Link href="/contact" className="hover:text-white transition-colors relative after:absolute after:bottom-[-4px] after:left-0 after:w-0 after:h-[2px] after:bg-indigo-500 hover:after:w-full after:transition-all">تواصل معنا</Link>
          </div>

          <div className="flex gap-4 items-center">
            <Link href="/login" className="hidden sm:block text-sm font-medium text-slate-300 hover:text-white transition-colors">
              تسجيل الدخول
            </Link>
            <Link href="/trial" className="px-5 py-2.5 rounded-xl bg-white text-[#0b1020] text-sm font-bold hover:bg-slate-100 transition-colors shadow-[0_0_15px_rgba(255,255,255,0.1)] hover:shadow-[0_0_20px_rgba(255,255,255,0.2)]">
              ابدأ مجاناً
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 pt-32 pb-20 lg:pt-48 lg:pb-32 px-6 max-w-7xl mx-auto flex flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs font-semibold mb-8"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
          </span>
          الإصدار 2.0 متاح الآن — استكشف الميزات الجديدة
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-[1.1]"
        >
          أقوى واجهة <br className="hidden md:block" />
          <span className="text-transparent bg-clip-text bg-gradient-to-l from-indigo-400 via-blue-400 to-purple-400">
            لإدارة مزودي الإنترنت
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-lg md:text-xl text-slate-400 max-w-3xl mb-12 leading-relaxed"
        >
          نظام سحابي متكامل واحترافي للتحكم بشبكات WISP. أداء فائق، أمان عالي، وتصميم مذهل يضع كل أدوات الإدارة والمحاسبة بين يديك.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto"
        >
          <Link href="/trial" className="group relative flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-r from-indigo-600 to-blue-600 rounded-2xl text-white font-bold text-lg overflow-hidden transition-all hover:scale-105 hover:shadow-[0_0_40px_rgba(79,70,229,0.4)]">
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
            <span className="relative z-10">ابدأ تجربتك المجانية</span>
            <ArrowLeft className="relative z-10 h-5 w-5 group-hover:-translate-x-1 transition-transform" />
          </Link>
          <Link href="/features" className="flex items-center justify-center px-8 py-4 bg-white/5 border border-white/10 rounded-2xl text-white font-bold text-lg hover:bg-white/10 transition-colors">
            استكشف المنصة
          </Link>
        </motion.div>

        {/* Mockup / Dashboard Preview image placeholder */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="mt-20 w-full max-w-5xl rounded-[2rem] border border-white/10 bg-[#151b2b]/50 p-2 sm:p-4 backdrop-blur-xl shadow-2xl relative"
        >
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b1020] via-transparent to-transparent z-10 rounded-[2rem]" />
          <div className="rounded-2xl sm:rounded-[1.5rem] overflow-hidden border border-white/5 bg-[#0b1020] aspect-video relative flex items-center justify-center">
             <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-20 filter grayscale mix-blend-overlay"></div>
             <div className="z-20 text-center">
               <Network className="h-16 w-16 text-indigo-500/50 mx-auto mb-4" />
               <p className="text-slate-400 font-medium">لوحة تحكم خيالية (مساحة للمعاينة)</p>
             </div>
          </div>
        </motion.div>
      </section>

      {/* Stats Section */}
      <section className="relative z-10 py-12 border-y border-white/5 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 divide-x divide-x-reverse divide-white/10">
            <div className="text-center">
              <h4 className="text-4xl font-extrabold text-white mb-2">99.9%</h4>
              <p className="text-sm text-slate-400 font-medium">استقرار الخدمة</p>
            </div>
            <div className="text-center">
              <h4 className="text-4xl font-extrabold text-white mb-2">+10k</h4>
              <p className="text-sm text-slate-400 font-medium">عميل نشط</p>
            </div>
            <div className="text-center">
              <h4 className="text-4xl font-extrabold text-white mb-2">+5M</h4>
              <p className="text-sm text-slate-400 font-medium">جلسة معالجة يومياً</p>
            </div>
            <div className="text-center">
              <h4 className="text-4xl font-extrabold text-white mb-2">24/7</h4>
              <p className="text-sm text-slate-400 font-medium">دعم فني متواصل</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="relative z-10 py-32 max-w-7xl mx-auto px-6">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">كل ما تحتاجه، <span className="text-indigo-400">وأكثر بكثير</span></h2>
          <p className="text-lg text-slate-400">تم تصميم المنصة لتلبية كافة احتياجات مزودي الخدمة بدءاً من الإدارة التقنية وحتى المحاسبة الدقيقة.</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <FeatureCard
            icon={<Globe />}
            title="إدارة MikroTik حية"
            desc="تكامل REST فوري مع راوترات مايكروتيك للتحكم بالهوية، الموارد، وفصل الجلسات النشطة."
            color="from-blue-500 to-cyan-400"
          />
          <FeatureCard
            icon={<Zap />}
            title="محرك RADIUS خارق"
            desc="استقبال أحداث المحاسبة والمصادقة بشكل موثوق مع نظام قوائم انتظار للتعامل مع الضغط."
            color="from-indigo-500 to-purple-500"
          />
          <FeatureCard
            icon={<CreditCard />}
            title="نظام مالي متكامل"
            desc="دليل حسابات، سندات قبض/صرف، فواتير ضريبية وقيود يومية مزدوجة معزولة لكل مؤسسة."
            color="from-emerald-500 to-teal-400"
          />
          <FeatureCard
            icon={<Ticket />}
            title="استوديو البطاقات"
            desc="تصميم وتوليد آلاف القسائم وتصديرها للطباعة مع دعم الباركود والأسعار المخصصة."
            color="from-orange-500 to-red-500"
          />
          <FeatureCard
            icon={<BarChart3 />}
            title="تقارير ديناميكية"
            desc="منشئ تقارير مخصص مع إمكانية الجدولة التلقائية وتصدير البيانات الشاملة."
            color="from-pink-500 to-rose-400"
          />
          <FeatureCard
            icon={<ShieldCheck />}
            title="عزل أمني صارم"
            desc="تشفير للأسرار AES-256، وفصل تام للبيانات بين المستأجرين مع مصفوفة صلاحيات دقيقة."
            color="from-slate-400 to-slate-200"
          />
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 py-24 mb-20">
        <div className="max-w-5xl mx-auto px-6">
          <div className="relative rounded-[2.5rem] bg-gradient-to-br from-indigo-900/50 to-blue-900/50 border border-indigo-500/20 p-12 overflow-hidden text-center backdrop-blur-sm">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-[80px]" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/20 rounded-full blur-[80px]" />

            <h2 className="text-3xl md:text-5xl font-bold text-white mb-6 relative z-10">مستعد للارتقاء بشبكتك؟</h2>
            <p className="text-xl text-indigo-200 mb-10 max-w-2xl mx-auto relative z-10">انضم إلى النخبة من مزودي الإنترنت الذين يعتمدون على Netora يومياً لإدارة أعمالهم بكفاءة.</p>

            <Link href="/trial" className="relative z-10 inline-flex items-center gap-2 px-10 py-5 bg-white text-indigo-900 rounded-2xl font-bold text-lg hover:scale-105 transition-transform shadow-[0_0_30px_rgba(255,255,255,0.2)]">
              أنشئ مساحة عملك الآن
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10 bg-[#060913] pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            <div className="col-span-2">
              <Link href="/" className="flex items-center gap-2 mb-4">
                <Network className="h-6 w-6 text-indigo-500" />
                <span className="text-xl font-bold text-white">Netora</span>
              </Link>
              <p className="text-slate-400 max-w-sm mb-6">نظام إدارة متكامل يضع معايير جديدة في عالم شبكات الإنترنت.</p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">المنتج</h4>
              <ul className="space-y-2 text-slate-400">
                <li><Link href="/features" className="hover:text-indigo-400 transition-colors">الميزات</Link></li>
                <li><Link href="/pricing" className="hover:text-indigo-400 transition-colors">الأسعار</Link></li>
                <li><Link href="#" className="hover:text-indigo-400 transition-colors">التحديثات</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">الشركة</h4>
              <ul className="space-y-2 text-slate-400">
                <li><Link href="/contact" className="hover:text-indigo-400 transition-colors">تواصل معنا</Link></li>
                <li><Link href="#" className="hover:text-indigo-400 transition-colors">الشروط والأحكام</Link></li>
                <li><Link href="#" className="hover:text-indigo-400 transition-colors">الخصوصية</Link></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-white/5 text-center text-slate-500 text-sm">
            <p>© {new Date().getFullYear()} Netora. جميع الحقوق محفوظة.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ title, desc, icon, color }: { title: string; desc: string; icon: React.ReactNode; color: string }) {
  return (
    <div className="group p-8 rounded-3xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] hover:border-white/10 transition-all duration-300 hover:-translate-y-1 relative overflow-hidden">
      <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${color} opacity-0 group-hover:opacity-10 blur-[50px] transition-opacity duration-500 rounded-full`} />
      <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${color} p-0.5 mb-6 shadow-lg`}>
        <div className="w-full h-full bg-[#0b1020] rounded-[14px] flex items-center justify-center text-white">
          {icon}
        </div>
      </div>
      <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
      <p className="text-slate-400 leading-relaxed font-medium">{desc}</p>
    </div>
  );
}
