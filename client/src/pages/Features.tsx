import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  Network, Server, ShieldCheck, Zap,
  Settings, Users, CreditCard, Ticket,
  BarChart, ArrowRight, CheckCircle2,
  BellRing, LayoutDashboard, Database
} from "lucide-react";

export default function Features() {
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5 } }
  };

  return (
    <div className="min-h-screen bg-[#f4f7fb] text-slate-900 font-sans selection:bg-indigo-500/30 overflow-x-hidden" dir="rtl">

      {/* Simple Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
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

      {/* Hero Section */}
      <section className="pt-20 pb-16 px-6 text-center max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 mb-6">
            ميزات هندسية <span className="text-transparent bg-clip-text bg-gradient-to-l from-indigo-600 to-blue-600">تفوق التوقعات</span>
          </h1>
          <p className="text-lg text-slate-600 mb-10 leading-relaxed max-w-2xl mx-auto">
            تم بناء Netora باستخدام أحدث التقنيات لضمان الأداء، الأمان، وسهولة الاستخدام. اكتشف كيف يمكن لمنصتنا تحويل طريقة إدارتك لشبكتك.
          </p>
        </motion.div>
      </section>

      {/* Bento Grid Features */}
      <section className="px-6 pb-24 max-w-7xl mx-auto">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {/* Feature 1 */}
          <motion.div variants={itemVariants} className="lg:col-span-2 relative group overflow-hidden rounded-[2rem] bg-white border border-slate-200 p-8 shadow-sm hover:shadow-xl transition-all duration-300">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 to-blue-500" />
            <div className="flex flex-col md:flex-row gap-8 items-start">
              <div className="flex-1">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center mb-6">
                  <Server className="h-6 w-6 text-indigo-600" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-4">تكامل MikroTik العميق</h3>
                <p className="text-slate-600 mb-6 leading-relaxed">
                  ليس مجرد اتصال بسيط، بل تحكم كامل. يتواصل النظام مع راوترات المايكروتيك عبر REST API الحديث لإدارة الموارد، قراءة الهوية، وفصل الجلسات النشطة لـ Hotspot و PPPoE فورياً.
                </p>
                <ul className="space-y-3">
                  {['دعم اتصالات متعددة وآمنة', 'تحديث فوري لبيانات الجلسات', 'عزل تام للموارد بين الشبكات'].map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" /> {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="w-full md:w-1/3 bg-slate-50 rounded-xl p-4 border border-slate-100 hidden md:block">
                 <pre className="text-[10px] text-slate-500 font-mono overflow-hidden">
{`POST /rest/ip/hotspot/active/remove
{
  "numbers": "*A1B"
}
-> 200 OK
`}
                 </pre>
              </div>
            </div>
          </motion.div>

          {/* Feature 2 */}
          <motion.div variants={itemVariants} className="relative group overflow-hidden rounded-[2rem] bg-white border border-slate-200 p-8 shadow-sm hover:shadow-xl transition-all duration-300">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mb-6">
              <Zap className="h-6 w-6 text-blue-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-4">معالجة RADIUS قوية</h3>
            <p className="text-slate-600 mb-6 text-sm leading-relaxed">
              محرك محاسبة قادر على استيعاب آلاف أحداث Start/Stop/Interim يومياً. مزود بنظام إعادة محاولة (Retries) وطوابير معالجة خلفية لضمان عدم ضياع أي بيانات استهلاك حتى في أوقات الذروة.
            </p>
          </motion.div>

          {/* Feature 3 */}
          <motion.div variants={itemVariants} className="relative group overflow-hidden rounded-[2rem] bg-white border border-slate-200 p-8 shadow-sm hover:shadow-xl transition-all duration-300">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center mb-6">
              <ShieldCheck className="h-6 w-6 text-emerald-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-4">عزل وحماية متعددة المستأجرين</h3>
            <p className="text-slate-600 mb-6 text-sm leading-relaxed">
              معمارية Multi-Tenant حقيقية. تشفير AES-256 لأسرار الراوترات (Vault). لا يمكن لأي مستأجر الوصول لبيانات أو إعدادات غيره، مع مصفوفة صلاحيات (RBAC) دقيقة للفرق.
            </p>
          </motion.div>

          {/* Feature 4 */}
          <motion.div variants={itemVariants} className="relative group overflow-hidden rounded-[2rem] bg-white border border-slate-200 p-8 shadow-sm hover:shadow-xl transition-all duration-300">
            <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center mb-6">
              <Ticket className="h-6 w-6 text-orange-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-4">استوديو طباعة الكروت</h3>
            <p className="text-slate-600 mb-6 text-sm leading-relaxed">
              نظام توليد كروت ذكي يضمن عدم تكرار الأرقام. تخصيص تصميم الكرت بالكامل (ألوان، شعار، باركود/QR) وإرسالها لطابور الطباعة لإنتاج ملفات PDF عالية الدقة جاهزة للقص.
            </p>
          </motion.div>

          {/* Feature 5 */}
          <motion.div variants={itemVariants} className="lg:col-span-2 relative group overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-900 to-indigo-950 text-white p-8 shadow-xl transition-all duration-300">
            <div className="flex flex-col md:flex-row gap-8 items-center">
              <div className="flex-1">
                <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center mb-6 backdrop-blur-sm">
                  <CreditCard className="h-6 w-6 text-indigo-300" />
                </div>
                <h3 className="text-2xl font-bold mb-4 text-white">نظام محاسبي ومالي متكامل</h3>
                <p className="text-slate-300 mb-6 leading-relaxed">
                  تجاوزنا مجرد إدارة الكروت لنوفر نظاماً محاسبياً متكاملاً يشمل دليل حسابات، صناديق مالية، سندات قبض ودفع، وإصدار فواتير ضريبية، مما يغنيك عن استخدام برامج محاسبية منفصلة.
                </p>
                <Link href="/trial" className="inline-flex items-center gap-2 px-6 py-3 bg-white text-indigo-900 rounded-xl font-bold text-sm hover:bg-indigo-50 transition-colors">
                  جربه الآن <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="w-full md:w-5/12 grid grid-cols-2 gap-4">
                {[
                  { i: <Database/>, t: "قواعد محاسبية" },
                  { i: <Users/>, t: "إدارة المشتركين" },
                  { i: <BarChart/>, t: "تقارير مالية" },
                  { i: <LayoutDashboard/>, t: "واجهات ديناميكية" },
                ].map((item, i) => (
                   <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col items-center justify-center text-center backdrop-blur-md hover:bg-white/10 transition-colors">
                     <div className="text-indigo-400 mb-2">{item.i}</div>
                     <span className="text-xs font-semibold text-slate-300">{item.t}</span>
                   </div>
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      </section>

    </div>
  );
}
