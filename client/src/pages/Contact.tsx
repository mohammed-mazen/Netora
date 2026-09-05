import { Link } from "wouter";
import { motion } from "framer-motion";
import { Network, ArrowRight, Mail, Phone, MapPin, Send } from "lucide-react";

export default function Contact() {
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

      {/* Main Content */}
      <section className="pt-20 pb-24 px-6 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-start max-w-5xl mx-auto">

          {/* Info Side */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 mb-6">
              لنبقى على <span className="text-transparent bg-clip-text bg-gradient-to-l from-indigo-600 to-blue-600">تواصل</span>
            </h1>
            <p className="text-lg text-slate-600 mb-10 leading-relaxed">
              فريقنا متواجد دائماً للإجابة على استفساراتك، مساعدتك في اختيار الخطة المناسبة، أو تقديم الدعم الفني اللازم لنجاح شبكتك.
            </p>

            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center shrink-0">
                  <Mail className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 mb-1">البريد الإلكتروني</h4>
                  <p className="text-slate-600">hello@netora.io</p>
                  <p className="text-slate-600">support@netora.io</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center shrink-0">
                  <Phone className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 mb-1">الهاتف المباشر</h4>
                  <p className="text-slate-600" dir="ltr">+971 50 123 4567</p>
                  <p className="text-sm text-slate-400 mt-1">متاح من 9 ص إلى 5 م بتوقيت دبي</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center shrink-0">
                  <MapPin className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 mb-1">المكتب الرئيسي</h4>
                  <p className="text-slate-600 leading-relaxed">
                    منطقة الابتكار والتكنولوجيا<br />
                    المبنى رقم 4، الطابق الثاني<br />
                    دبي، الإمارات العربية المتحدة
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Form Side */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="bg-white p-8 md:p-10 rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-200/50"
          >
            <h3 className="text-2xl font-bold text-slate-900 mb-8">أرسل لنا رسالة</h3>

            <form className="space-y-6" onSubmit={e => e.preventDefault()}>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">الاسم الكامل</label>
                  <input
                    type="text"
                    placeholder="محمد عبدالله"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">رقم الهاتف</label>
                  <input
                    type="tel"
                    placeholder="050xxxxxxx"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">البريد الإلكتروني</label>
                <input
                  type="email"
                  placeholder="name@company.com"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">الرسالة</label>
                <textarea
                  placeholder="كيف يمكننا مساعدتك اليوم؟"
                  rows={4}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
                ></textarea>
              </div>

              <button className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-bold py-4 rounded-xl hover:shadow-lg hover:shadow-indigo-500/25 transition-all hover:-translate-y-0.5">
                إرسال الرسالة <Send className="w-4 h-4" />
              </button>
            </form>
          </motion.div>

        </div>
      </section>

    </div>
  );
}
