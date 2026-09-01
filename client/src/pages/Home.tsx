import {
  Activity,
  ArrowUpLeft,
  BadgeDollarSign,
  Bell,
  BookOpenCheck,
  Boxes,
  Cable,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  CircleDollarSign,
  CloudCog,
  Command,
  CreditCard,
  DatabaseBackup,
  FileArchive,
  FileBarChart2,
  FileKey2,
  FileStack,
  Gauge,
  Headphones,
  History,
  LayoutDashboard,
  LoaderCircle,
  LockKeyhole,
  MessageCircle,
  MessageSquareText,
  Network,
  PanelRight,
  Palette,
  Plus,
  RadioTower,
  ReceiptText,
  RefreshCw,
  Router,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  Trophy,
  UsersRound,
  WalletCards,
  Wifi,
  X,
  type LucideIcon,
} from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { TenantPlanUsageCard } from "@/components/TenantPlanUsageCard";

const PlatformOrganizationsPanel = lazy(() => import("@/components/PlatformPanels").then(module => ({ default: module.PlatformOrganizationsPanel })));
const PlatformPlansPanel = lazy(() => import("@/components/PlatformPanels").then(module => ({ default: module.PlatformPlansPanel })));
const PlatformSubscriptionsPanel = lazy(() => import("@/components/PlatformPanels").then(module => ({ default: module.PlatformSubscriptionsPanel })));
const PlatformSupportTicketsPanel = lazy(() => import("@/components/PlatformPanels").then(module => ({ default: module.PlatformSupportTicketsPanel })));
const OperationalBillingPanel = lazy(() => import("@/components/BillingPanel").then(module => ({ default: module.OperationalBillingPanel })));
const FinancialLedgerPanel = lazy(() => import("@/components/BillingPanel").then(module => ({ default: module.FinancialLedgerPanel })));
const TenantFilesPanel = lazy(() => import("@/components/TenantFilesPanel").then(module => ({ default: module.TenantFilesPanel })));
const TenantIntegrationPanel = lazy(() => import("@/components/IntegrationPanel").then(module => ({ default: module.TenantIntegrationPanel })));
const TenantAuditLogPanel = lazy(() => import("@/components/AuditLogPanel").then(module => ({ default: module.TenantAuditLogPanel })));
const NetworkResourcesPanel = lazy(() => import("@/components/NetworkResourcesPanel").then(module => ({ default: module.NetworkResourcesPanel })));
const SupportOperationsPanel = lazy(() => import("@/components/SupportOperationsPanel").then(module => ({ default: module.SupportOperationsPanel })));
const SupportTicketDirectoryPanel = lazy(() => import("@/components/SupportTicketDirectoryPanel").then(module => ({ default: module.SupportTicketDirectoryPanel })));
const SupportTemplatesPanel = lazy(() => import("@/components/SupportTemplatesPanel").then(module => ({ default: module.SupportTemplatesPanel })));
const TenantReportsPanel = lazy(() => import("@/components/TenantReportsPanel").then(module => ({ default: module.TenantReportsPanel })));
const CustomerImportPanel = lazy(() => import("@/components/CustomerImportPanel").then(module => ({ default: module.CustomerImportPanel })));
const CustomerDirectoryPanel = lazy(() => import("@/components/CustomerDirectoryPanel").then(module => ({ default: module.CustomerDirectoryPanel })));
const SessionControlPanel = lazy(() => import("@/components/SessionControlPanel").then(module => ({ default: module.SessionControlPanel })));
const RouterProvisionPanel = lazy(() => import("@/components/RouterProvisionPanel").then(module => ({ default: module.RouterProvisionPanel })));
const ServicePlanPolicyPanel = lazy(() => import("@/components/ServicePlanPolicyPanel").then(module => ({ default: module.ServicePlanPolicyPanel })));
const RouterSearchPanel = lazy(() => import("@/components/RouterSearchPanel").then(module => ({ default: module.RouterSearchPanel })));
const AccountingPanel = lazy(() => import("@/components/AccountingPanel").then(module => ({ default: module.AccountingPanel })));
const CardsPanel = lazy(() => import("@/components/CardsPanel").then(module => ({ default: module.CardsPanel })));
const CardDesignPanel = lazy(() => import("@/components/CardDesignPanel").then(module => ({ default: module.CardDesignPanel })));
const RolesPanel = lazy(() => import("@/components/RolesPanel").then(module => ({ default: module.RolesPanel })));
const ReportBuilderPanel = lazy(() => import("@/components/ReportBuilderPanel").then(module => ({ default: module.ReportBuilderPanel })));
const BackupPanel = lazy(() => import("@/components/BackupPanel").then(module => ({ default: module.BackupPanel })));
const ApiTokensPanel = lazy(() => import("@/components/ApiTokensPanel").then(module => ({ default: module.ApiTokensPanel })));
const MacSecurityPanel = lazy(() => import("@/components/MacSecurityPanel").then(module => ({ default: module.MacSecurityPanel })));
const HotspotLoginBuilderPanel = lazy(() => import("@/components/HotspotLoginBuilderPanel").then(module => ({ default: module.HotspotLoginBuilderPanel })));
const AdvancedReportBuilderPanel = lazy(() => import("@/components/AdvancedReportBuilderPanel").then(module => ({ default: module.AdvancedReportBuilderPanel })));
const CardsImportPanel = lazy(() => import("@/components/CardsImportPanel").then(module => ({ default: module.CardsImportPanel })));
const BackupSchedulingPanel = lazy(() => import("@/components/BackupSchedulingPanel").then(module => ({ default: module.BackupSchedulingPanel })));
const DynamicSettingsPanel = lazy(() => import("@/components/DynamicSettingsPanel").then(module => ({ default: module.DynamicSettingsPanel })));
const MonitorPanel = lazy(() => import("@/components/MonitorPanel").then(module => ({ default: module.MonitorPanel })));
const PointsPanel = lazy(() => import("@/components/PointsPanel").then(module => ({ default: module.PointsPanel })));
const SmsPanel = lazy(() => import("@/components/SmsPanel").then(module => ({ default: module.SmsPanel })));
const SmsTemplatesPanel = lazy(() => import("@/components/SmsTemplatesPanel").then(module => ({ default: module.SmsTemplatesPanel })));
const TwoFactorSettingsPanel = lazy(() => import("@/components/TwoFactorSettingsPanel").then(module => ({ default: module.TwoFactorSettingsPanel })));
const CompetitionsPanel = lazy(() => import("@/components/CompetitionsPanel").then(module => ({ default: module.CompetitionsPanel })));
const ChatPanel = lazy(() => import("@/components/ChatPanel").then(module => ({ default: module.ChatPanel })));

function ModulePanelFallback() { return <div className="flex min-h-48 items-center justify-center rounded-2xl border border-slate-200 bg-white text-xs font-semibold text-slate-500">جارٍ تجهيز الوحدة…</div>; }

type Workspace = "tenant" | "platform";
type ModuleKey =
  | "overview"
  | "network"
  | "customers"
  | "vouchers"
  | "sessions"
  | "billing"
  | "support"
  | "reports"
  | "settings"
  | "organizations"
  | "plans"
  | "subscriptions"
  | "audit"
  | "accounting"
  | "cards"
  | "cardDesign"
  | "roles"
  | "reportBuilder"
  | "backup"
  | "apiTokens"
  | "macSecurity"
  | "hotspotPages"
  | "reportBuilderAdvanced"
  | "cardsImport"
  | "backupScheduling"
  | "smsTemplates"
  | "dynamicSettings"
  | "monitor"
  | "points"
  | "sms"
  | "competitions"
  | "chat";

type NavItem = { key: ModuleKey; label: string; icon: LucideIcon; badge?: string };

const tenantNavigation: { title: string; items: NavItem[] }[] = [
  { title: "المتابعة", items: [{ key: "overview", label: "نظرة عامة", icon: LayoutDashboard }, { key: "sessions", label: "الجلسات", icon: Activity, badge: "0" }, { key: "reports", label: "التقارير", icon: FileBarChart2 }] },
  { title: "التشغيل", items: [{ key: "network", label: "الشبكة والراوترات", icon: Router }, { key: "customers", label: "العملاء", icon: UsersRound }, { key: "vouchers", label: "البطاقات والباقات", icon: CreditCard }] },
  { title: "البطاقات والتصميم", items: [{ key: "cards", label: "فئات ومجموعات البطاقات", icon: CreditCard }, { key: "cardDesign", label: "استوديو تصميم البطاقات", icon: Palette }] },
  { title: "المحاسبة", items: [{ key: "accounting", label: "دليل الحسابات والسندات", icon: BookOpenCheck }] },
  { title: "التسويق والولاء", items: [{ key: "points", label: "النقاط والولاء", icon: Star }, { key: "competitions", label: "المسابقات", icon: Trophy }] },
  { title: "المال والدعم", items: [{ key: "billing", label: "الفوترة والحسابات", icon: WalletCards }, { key: "support", label: "الدعم والرسائل", icon: Headphones }, { key: "chat", label: "الدعم المباشر", icon: MessageCircle }, { key: "settings", label: "الإعدادات والتكاملات", icon: Settings2 }] },
  { title: "الاتصالات", items: [{ key: "sms", label: "بوابة الرسائل النصية", icon: MessageSquareText }, { key: "smsTemplates", label: "قوالب الرسائل", icon: MessageSquareText }] },
  { title: "الميزات المتقدمة", items: [{ key: "apiTokens", label: "API Tokens", icon: FileKey2 }, { key: "macSecurity", label: "MAC Security", icon: LockKeyhole }, { key: "hotspotPages", label: "Hotspot Login Builder", icon: Wifi }, { key: "reportBuilderAdvanced", label: "Report Builder Pro", icon: Sparkles }, { key: "cardsImport", label: "Cards Import", icon: FileArchive }, { key: "backupScheduling", label: "Backup Scheduling", icon: DatabaseBackup }, { key: "dynamicSettings", label: "Dynamic Settings", icon: SlidersHorizontal }] },
  { title: "الإدارة والنظام", items: [{ key: "roles", label: "الأدوار والصلاحيات", icon: ShieldCheck }, { key: "reportBuilder", label: "منشئ التقارير", icon: FileBarChart2 }, { key: "monitor", label: "مراقبة الخادم", icon: Gauge }, { key: "backup", label: "النسخ الاحتياطية", icon: DatabaseBackup }] },
];

const platformNavigation: { title: string; items: NavItem[] }[] = [
  { title: "مركز المنصة", items: [{ key: "overview", label: "نبض المنصة", icon: LayoutDashboard }, { key: "organizations", label: "المؤسسات", icon: Boxes }, { key: "plans", label: "الخطط والحدود", icon: SlidersHorizontal }, { key: "subscriptions", label: "الاشتراكات", icon: ReceiptText }] },
  { title: "الضبط", items: [{ key: "support", label: "دعم المؤسسات", icon: Headphones }, { key: "audit", label: "سجل التدقيق", icon: History }, { key: "settings", label: "سياسات المنصة", icon: ShieldCheck }] },
];

const moduleDetails: Record<ModuleKey, { eyebrow: string; title: string; description: string; action?: string }> = {
  overview: { eyebrow: "مساحة العمليات", title: "صورة موحدة لما يحدث في شبكتك", description: "تبدأ لوحة Netora بلا أرقام مضللة: تُظهر بوضوح ما تم ربطه وما ينتظر التهيئة، ثم تتحول إلى مراقبة حية بعد تفعيل تدفق RADIUS ومزامنة الراوترات.", action: "بدء التهيئة" },
  network: { eyebrow: "التشغيل", title: "الشبكة والراوترات", description: "سجل موحد للمواقع والراوترات وملفات السرعة وحالة الربط، مع مسار إعداد آمن لا يعرض الأسرار للواجهة.", action: "إضافة راوتر" },
  customers: { eyebrow: "المشتركون", title: "العملاء والحسابات", description: "إدارة عملاء المؤسسة ببحث دقيق وحالات تشغيل واضحة، مع حماية من التكرار وعزل خادمي حسب المؤسسة.", action: "إضافة عميل" },
  vouchers: { eyebrow: "المبيعات", title: "البطاقات والباقات", description: "إنشاء دفعات بطاقات وربطها بباقات وسرعات وحدود صالحة للمصادقة عبر RADIUS دون إعادة كشف أسرار البطاقة.", action: "إنشاء دفعة" },
  sessions: { eyebrow: "المراقبة", title: "جلسات HotSpot وPPPoE", description: "تتبع الجلسات النشطة والمغلقة واستهلاكها من accounting، مع طلبات قطع جلسة أو تغيير سرعة كمهام قابلة للتدقيق.", action: "تحديث الحالة" },
  billing: { eyebrow: "المالية", title: "الفوترة ودفتر القيود", description: "دورة منظمة للفواتير والقبض والصرف والقيود المزدوجة، مع منع الاعتماد على تعديل الرصيد اليدوي غير المدقق.", action: "فاتورة جديدة" },
  support: { eyebrow: "التعاون", title: "الدعم والإشعارات", description: "تذاكر مؤسسية وقوالب رسائل وتنبيهات تشغيلية منفصلة عن أسرار الراوترات وعن بيانات المؤسسات الأخرى.", action: "تذكرة جديدة" },
  reports: { eyebrow: "الرؤية", title: "التقارير والتصدير", description: "تقارير جلسات واستهلاك ومبيعات مع نطاق زمني واضح، وتصدير يحترم صلاحيات المؤسسة وسجل الوصول.", action: "إنشاء تقرير" },
  settings: { eyebrow: "الضبط", title: "إعدادات وتكاملات آمنة", description: "إدارة أدوار الفريق وRADIUS وMikroTik والرسائل والتخزين عبر مراجع أسرار خادمية فقط، من دون عرض المفاتيح للمتصفح.", action: "إدارة التكاملات" },
  organizations: { eyebrow: "إدارة المنصة", title: "المؤسسات المستأجرة", description: "مساحة مركزية لمراقبة حالة كل مؤسسة وحدودها وطلباتها، مع فصل كامل عن بيانات تشغيل عملائها.", action: "مؤسسة جديدة" },
  plans: { eyebrow: "إدارة المنصة", title: "خطط الخدمة والحدود", description: "تعريف حدود الراوترات والعملاء والموظفين والتخزين لكل خطة، وتطبيقها على الخادم لا في الواجهة فقط.", action: "خطة جديدة" },
  subscriptions: { eyebrow: "إدارة المنصة", title: "الاشتراكات والفوترة المركزية", description: "متابعة التجارب والتجديدات والتعليق بطريقة تحافظ على البيانات وتطبق سياسة تشغيل معلنة للجلسات والتكاملات.", action: "اشتراك جديد" },
  audit: { eyebrow: "الحوكمة", title: "سجل التدقيق والسياسات", description: "مصدر مركزي للعمليات الحساسة: من قام بماذا، على أي مؤسسة أو مورد، وبأي نتيجة، من دون تسجيل أسرار أو بيانات اعتماد.", action: "تصفية السجل" },
  accounting: { eyebrow: "المحاسبة", title: "دليل الحسابات والسندات", description: "دليل حسابات هرمي وصناديق نقدية ومخازن، مع سندات قبض وصرف تنشئ قيدًا متوازنًا مدين/دائن فور تسجيلها.", action: "حساب جديد" },
  cards: { eyebrow: "البطاقات", title: "فئات ومجموعات البطاقات", description: "تعريف فئات تسعير البطاقات ومجموعاتها بحدود استخدام وربط بملفات سرعة MikroTik، تمهيدًا لإصدار الدفعات.", action: "فئة جديدة" },
  cardDesign: { eyebrow: "التصميم", title: "استوديو تصميم البطاقات", description: "تصميم مقاس البطاقة وألوانها وعلامتها المائية، وإدارة طابور طباعة الدفعات بحالة قابلة للتتبع.", action: "تصميم جديد" },
  roles: { eyebrow: "الحوكمة", title: "الأدوار والصلاحيات المخصصة", description: "أدوار مخصصة تُضاف فوق الدور الأساسي لكل عضو، مع صلاحيات دقيقة تُطبَّق على الخادم لا في الواجهة فقط.", action: "دور جديد" },
  reportBuilder: { eyebrow: "الرؤية", title: "منشئ التقارير المخصصة", description: "بناء تعريفات تقارير حسب مجموعة بيانات وأعمدة مختارة، مع جدولة دورية وتصدير محفوظ في التخزين المحمي.", action: "تقرير جديد" },
  backup: { eyebrow: "الاستمرارية", title: "النسخ الاحتياطية", description: "لقطات JSON دورية لبيانات المؤسسة المعزولة، محفوظة في التخزين المحمي مع سجل حالة وحجم واضح.", action: "نسخة جديدة" },
  apiTokens: { eyebrow: "الأمان", title: "API Tokens", description: "رموز وصول شخصية بقدرات دقيقة وسماح لعناوين IP وتواريخ انتهاء لإتاحة التكامل الآمن مع تطبيقات الطرف الثالث.", action: "إنشاء رمز" },
  macSecurity: { eyebrow: "الأمان", title: "MAC Security", description: "قوائم سماح وحظر لعناوين MAC مع سجل إجراءات تشغيلي منفصل لقرارات الحظر وفك الحظر.", action: "حفظ قاعدة" },
  hotspotPages: { eyebrow: "الهوت سبوت", title: "Hotspot Login Page Builder", description: "بناء صفحات دخول مخصّصة للهوت سبوت تتضمن الهوية البصرية ورسائل الترحيب والشروط ونطاق مجموعات الكروت.", action: "حفظ الصفحة" },
  reportBuilderAdvanced: { eyebrow: "الرؤية", title: "Report Builder المتقدم", description: "طبقة متقدمة فوق منشئ التقارير تشمل PIN حماية، فئات، معلمات، فلاتر محفوظة، قنوات تسليم وسجل تشغيل.", action: "إنشاء تعريف" },
  cardsImport: { eyebrow: "البطاقات", title: "Cards Import", description: "مهمات استيراد للكروت من CSV أو أدوات MikroTik مع كشف التكرار والصفوف غير الصالحة وتجاوز السعة.", action: "بدء الاستيراد" },
  backupScheduling: { eyebrow: "الاستمرارية", title: "Backup Scheduling", description: "جدولة النسخ الاحتياطية على مستوى المؤسسة مع تكرار مرن ومدة احتفاظ ومراقبة لآخر وآتي تشغيل.", action: "حفظ الجدولة" },
  dynamicSettings: { eyebrow: "الضبط", title: "Dynamic Settings Engine", description: "محرك مركزي لإنشاء حقول إعدادات ديناميكية قابلة للتخصيص لأي وحدة داخل النظام دون إعادة بناء الواجهة كل مرة.", action: "حفظ المحرك" },
  monitor: { eyebrow: "المراقبة", title: "مراقبة الخادم وتنبيهات البطارية", description: "ضبط سياسة إعادة التشغيل والإيقاف عن بُعد، وتنبيهات تيليجرام عند انخفاض البطارية عن الحد الحرج.", action: "حفظ الإعدادات" },
  points: { eyebrow: "الولاء", title: "النقاط والولاء", description: "برنامج نقاط قابل للتفعيل مع مستويات مزايا وسجل حركة نقاط يُعد المصدر الوحيد لرصيد كل عميل.", action: "تسجيل حركة" },
  sms: { eyebrow: "الاتصالات", title: "بوابة الرسائل النصية", description: "إعداد مزود الرسائل ونوع الإرسال، مع مفتاح مزود مخزَّن مشفّرًا في الخادم فقط، وطابور رسائل مرئي.", action: "إرسال رسالة" },
  smsTemplates: { eyebrow: "الاتصالات", title: "SMS Templates", description: "قوالب رسائل قابلة لإعادة الاستخدام مع متغيرات ومعاينة قبل الإرسال وربط واضح بأنواع الرسائل المباشرة والمجدولة.", action: "حفظ القالب" },
  competitions: { eyebrow: "التفاعل", title: "المسابقات والتحفيز", description: "مسابقات بمستويات صعوبة ونقاط، بأسئلة قابلة للإضافة وانتقال حالة واضح من مسودة إلى تفعيل إلى إنهاء.", action: "مسابقة جديدة" },
  chat: { eyebrow: "الدعم", title: "الدعم المباشر", description: "محادثات دعم فورية مع العملاء، بحالة مفتوحة أو مغلقة وسجل رسائل موظف/عميل واضح.", action: "محادثة جديدة" },
};

const operationalSteps = [
  { number: "01", title: "عرّف المؤسسة", body: "اضبط الهوية والمنطقة الزمنية والعملة وحدود الخطة. يُثبت سياق المؤسسة في الخادم قبل أي قراءة أو كتابة." },
  { number: "02", title: "اربط الشبكة بأمان", body: "أضف الموقع والراوتر عبر API-SSL أو REST HTTPS، واحفظ مرجع السر فقط. لا يمر أي سر عبر المتصفح." },
  { number: "03", title: "فعّل RADIUS والمحاسبة", body: "حوّل الباقات إلى سياسات، واستقبل Start وInterim وStop لتغذية الجلسات والاستهلاك دون عدّ مكرر." },
];

function StatusPill({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "success" | "warning" | "critical" }) {
  const tones = {
    neutral: "bg-slate-100 text-slate-600",
    success: "bg-emerald-50 text-emerald-700",
    warning: "bg-amber-50 text-amber-700",
    critical: "bg-rose-50 text-rose-700",
  };
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${tones[tone]}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{label}</span>;
}

function MetricCard({ label, value, detail, icon: Icon, accent }: { label: string; value: string; detail: string; icon: LucideIcon; accent: "violet" | "teal" | "orange" | "blue" }) {
  const colors = {
    violet: "bg-violet-50 text-violet-600",
    teal: "bg-teal-50 text-teal-600",
    orange: "bg-orange-50 text-orange-600",
    blue: "bg-blue-50 text-blue-600",
  };
  return <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_8px_30px_rgba(23,35,61,.035)]">
    <div className="flex items-start justify-between gap-3">
      <div><p className="text-xs font-medium text-slate-500">{label}</p><p className="mt-3 text-2xl font-bold tracking-tight text-slate-900">{value}</p></div>
      <span className={`grid h-10 w-10 place-items-center rounded-xl ${colors[accent]}`}><Icon className="h-5 w-5" /></span>
    </div>
    <p className="mt-3 text-[11px] leading-5 text-slate-500">{detail}</p>
  </section>;
}

function EmptyTable({ title, body, columns, action }: { title: string; body: string; columns: string[]; action: string }) {
  return <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_30px_rgba(23,35,61,.035)]">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
      <div><h3 className="text-sm font-bold text-slate-800">{title}</h3><p className="mt-1 text-xs text-slate-500">{body}</p></div>
      <button onClick={() => toast.info(`${action} يحتاج إكمال إعداد المؤسسة أولًا.`)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"><Plus className="h-3.5 w-3.5" />{action}</button>
    </div>
    <div className="overflow-x-auto [scrollbar-width:thin]">
      <table className="min-w-[620px] text-right"><thead><tr className="border-b border-slate-100 bg-slate-50/70">{columns.map(column => <th key={column} className="whitespace-nowrap px-5 py-3 text-[11px] font-semibold text-slate-500">{column}</th>)}</tr></thead>
        <tbody><tr><td colSpan={columns.length} className="px-5 py-12 text-center"><div className="mx-auto flex max-w-sm flex-col items-center"><span className="grid h-10 w-10 place-items-center rounded-full bg-violet-50 text-violet-600"><FileStack className="h-5 w-5" /></span><p className="mt-3 text-sm font-bold text-slate-700">لا توجد سجلات بعد</p><p className="mt-1 text-xs leading-5 text-slate-500">{body}</p></div></td></tr></tbody>
      </table>
    </div>
  </section>;
}

type PreviewOverview = {
  mode: "preview";
  dataFreshness: string;
  actor: { name: string; email: string | null; platformRole: "user" | "admin" };
  network: { activeSessions: number; healthyRouters: number; totalRouters: number; usagePercent: number };
  finance: { monthlyRevenue: number; openInvoices: number; outstandingBalance: number };
};

type TenantMembership = {
  organizationId: number;
  organizationSlug: string;
  organizationName: string;
  organizationStatus: "trial" | "active" | "suspended" | "archived";
  memberRole: "owner" | "manager" | "operator" | "accountant" | "support" | "viewer";
};

type TenantOverview = {
  mode: "operational";
  organization: { id: number; slug: string; name: string; status: "trial" | "active" | "suspended" | "archived"; role: "owner" | "manager" | "operator" | "accountant" | "support" | "viewer" };
  network: { activeSessions: number; healthyRouters: number; totalRouters: number };
  customers: { total: number };
  finance: { monthlyRevenue: string; openInvoices: number; outstandingBalance: string };
};

function TenantSetupCard({ onCreated }: { onCreated: (slug: string) => void }) {
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const createTenant = trpc.tenant.create.useMutation({
    onSuccess: async organization => {
      toast.success("تم إنشاء مساحة المؤسسة. يمكنك الآن إعداد البنية التشغيلية.");
      onCreated(organization.slug);
      await utils.tenant.listMine.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const submit = () => {
    if (!name.trim() || !slug.trim()) { toast.error("أدخل اسم المؤسسة ومعرّفًا صالحًا لها."); return; }
    createTenant.mutate({ name: name.trim(), slug: slug.trim().toLowerCase(), timezone: "Asia/Riyadh", currency: "SAR" });
  };
  return <section className="rounded-2xl border border-dashed border-violet-200 bg-violet-50/60 p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold text-violet-700">تهيئة المؤسسة</p><h2 className="mt-1 text-base font-bold text-slate-900">أنشئ مساحة مستأجر معزولة</h2><p className="mt-2 max-w-2xl text-xs leading-6 text-slate-600">سيُنشئ هذا الإجراء مؤسسة تجريبية وعضوية مالك لحسابك. لا يُنشئ اتصالًا فعليًا مع MikroTik أو RADIUS ولا يخزّن أي سر في المتصفح.</p></div><StatusPill label="آمن" tone="success" /></div><div className="mt-4 grid gap-3 md:grid-cols-[1fr_.8fr_auto]"><input value={name} onChange={event => setName(event.target.value)} placeholder="اسم المؤسسة" className="h-10 rounded-xl border border-violet-100 bg-white px-3 text-xs outline-none focus:border-violet-400" /><input value={slug} onChange={event => setSlug(event.target.value.replace(/[^a-zA-Z0-9-]/g, "").toLowerCase())} placeholder="network-company" dir="ltr" className="h-10 rounded-xl border border-violet-100 bg-white px-3 text-left text-xs outline-none focus:border-violet-400" /><button disabled={createTenant.isPending} onClick={submit} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 text-xs font-bold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"><Plus className="h-4 w-4" />{createTenant.isPending ? "جارٍ الإنشاء…" : "إنشاء المؤسسة"}</button></div></section>;
}

function TenantContextCard({ isAuthenticated, isLoading, error, memberships, selectedSlug, onSelect }: { isAuthenticated: boolean; isLoading: boolean; error: boolean; memberships?: TenantMembership[]; selectedSlug: string; onSelect: (slug: string) => void }) {
  if (!isAuthenticated) return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(23,35,61,.035)]"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-bold text-violet-600">سياق المؤسسة</p><h2 className="mt-1 text-base font-bold text-slate-900">سجّل الدخول لعرض بياناتك المعزولة</h2><p className="mt-2 text-xs leading-6 text-slate-500">تُقرأ المؤسسات والعضويات من الخادم فقط بعد التحقق من الجلسة؛ لا يكفي معرّف مؤسسة من الواجهة للوصول إلى بياناتها.</p></div><button onClick={() => startLogin()} className="rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-bold text-white">تسجيل الدخول</button></div></section>;
  if (isLoading) return <section className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-5 text-xs font-semibold text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin text-violet-600" />يجري تحميل عضويات مؤسستك الآمنة…</section>;
  if (error) return <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><p className="text-sm font-bold text-amber-900">تعذر تحميل سياق المؤسسة</p><p className="mt-1 text-xs leading-6 text-amber-800">تحقق من اتصالك ثم أعد فتح الصفحة. لا تعرض الواجهة بيانات بديلة عند فشل التفويض.</p></section>;
  if (!memberships?.length) return <TenantSetupCard onCreated={onSelect} />;
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(23,35,61,.035)]"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold text-violet-600">سياق المؤسسة</p><h2 className="mt-1 text-base font-bold text-slate-900">اختر مساحة العمل الحالية</h2></div><p className="text-xs text-slate-500">تتغير البيانات وفق العضوية النشطة فقط</p></div><div className="mt-4 flex flex-wrap gap-2">{memberships.map(member => <button key={member.organizationId} onClick={() => onSelect(member.organizationSlug)} className={`rounded-xl border px-3 py-2 text-right text-xs transition ${selectedSlug === member.organizationSlug ? "border-violet-200 bg-violet-50 text-violet-700" : "border-slate-200 bg-white text-slate-600 hover:border-violet-200"}`}><span className="font-bold">{member.organizationName}</span><span className="mx-2 text-[10px] opacity-70">{member.memberRole}</span><span className="text-[10px] opacity-70">{member.organizationStatus}</span></button>)}</div></section>;
}

function Overview({ workspace, preview, tenant, isLoading, error }: { workspace: Workspace; preview?: PreviewOverview; tenant?: TenantOverview; isLoading: boolean; error: boolean }) {
  const isPlatform = workspace === "platform";
  const hasLiveData = Boolean(preview || tenant);
  const activeNetwork = tenant?.network ?? preview?.network;
  const metricValue = (value: number) => hasLiveData ? new Intl.NumberFormat("ar-SA").format(value) : "—";
  const metricDetail = isLoading ? "يجري التحقق من حالة مساحة العمل…" : error ? "يتطلب عرض بيانات التشغيل تسجيل الدخول إلى Netora." : tenant ? `بيانات محصورة في مؤسسة ${tenant.organization.name}.` : preview?.dataFreshness ?? "لا توجد بيانات تشغيلية متاحة الآن.";
  return <div className="space-y-5 netora-enter">
    <section className="relative overflow-hidden rounded-3xl bg-[#121b37] p-6 text-white shadow-[0_18px_40px_rgba(28,31,77,.17)] sm:p-7">
      <div className="absolute inset-y-0 left-0 w-1/2 bg-[radial-gradient(circle_at_top_left,rgba(107,94,255,.48),transparent_58%)]" />
      <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div className="max-w-2xl"><div className="flex items-center gap-2 text-xs text-violet-200"><Sparkles className="h-4 w-4" />{isPlatform ? "Control Plane · إدارة مركزية" : "Tenant Workspace · مساحة مؤسسة"}</div><h1 className="mt-4 text-2xl font-bold leading-relaxed sm:text-3xl">{isPlatform ? "منصة واحدة، مؤسسات معزولة، قرارات تشغيل أوضح." : "مرحبًا بك في مساحة شبكة جاهزة للنمو الآمن."}</h1><p className="mt-3 max-w-xl text-sm leading-7 text-slate-300">{isPlatform ? "راقب الصحة العامة، حدود الاشتراكات، والعمليات الحساسة من دون الخلط بين بيانات المؤسسات." : "ابدأ بربط بنيتك مرة واحدة، ثم اجعل Netora ينظم الأشخاص والباقات والجلسات والمالية في نفس السياق."}</p></div>
        <div className="flex flex-wrap gap-2"><button onClick={() => toast.message(isLoading ? "يجري تحميل حالة العمل…" : error ? "سجّل الدخول أولًا لعرض حالة مساحة العمل." : "وضع معاينة آمن: لا توجد تكاملات مفعلة بعد.")} className="rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-[#161d42] transition hover:bg-violet-50">فحص الجاهزية</button><button onClick={() => toast.info("سيظهر معالج التهيئة بعد إنشاء المؤسسة وربط أول مصدر شبكة.")} className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-white/10">فتح معالج التهيئة</button></div>
      </div>
    </section>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard label={isPlatform ? "المؤسسات النشطة" : "الجلسات النشطة"} value={metricValue(activeNetwork?.activeSessions ?? 0)} detail={metricDetail} icon={isPlatform ? Boxes : Activity} accent="violet" />
      <MetricCard label={isPlatform ? "اشتراكات تحتاج مراجعة" : "الراوترات السليمة"} value={metricValue(activeNetwork?.healthyRouters ?? 0)} detail={metricDetail} icon={isPlatform ? ReceiptText : Router} accent="teal" />
      <MetricCard label={isPlatform ? "تنبيهات المنصة" : "العملاء المسجلون"} value={tenant ? metricValue(tenant.customers.total) : hasLiveData ? `${preview?.network.usagePercent ?? 0}%` : "—"} detail={metricDetail} icon={CircleAlert} accent="orange" />
      <MetricCard label={isPlatform ? "صحة الخدمات" : "الإيراد الشهري"} value={tenant ? tenant.finance.monthlyRevenue : metricValue(preview?.finance.monthlyRevenue ?? 0)} detail={metricDetail} icon={isPlatform ? CloudCog : CircleDollarSign} accent="blue" />
    </div>

    <div className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_30px_rgba(23,35,61,.035)]"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold text-violet-600">حالة الإطلاق</p><h2 className="mt-1 text-lg font-bold text-slate-900">مسار التشغيل المنضبط</h2></div><StatusPill label="بانتظار التهيئة" tone="warning" /></div><div className="mt-6 grid gap-4 md:grid-cols-3">{operationalSteps.map(step => <div key={step.number} className="rounded-xl bg-slate-50 p-4"><span className="font-mono text-xs font-medium text-violet-600">{step.number}</span><h3 className="mt-3 text-sm font-bold text-slate-800">{step.title}</h3><p className="mt-2 text-xs leading-6 text-slate-500">{step.body}</p></div>)}</div></section>
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_30px_rgba(23,35,61,.035)]"><div className="flex items-center justify-between"><h2 className="text-sm font-bold text-slate-800">سلامة التكاملات</h2><button onClick={() => toast.info("فحص الاتصالات يحتاج بيانات اعتماد خادمية مهيأة.")} className="text-xs font-semibold text-violet-600">تفاصيل</button></div><div className="mt-5 space-y-4">{([["MikroTik", "لم يُربط", Router], ["FreeRADIUS", "لم يُهيأ", RadioTower], ["التخزين المحمي", "جاهز", FileKey2]] as [string, string, LucideIcon][]).map(([label, state, Icon]) => <div key={label} className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-slate-600"><Icon className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="text-xs font-bold text-slate-700">{label}</p><p className="mt-1 text-[11px] text-slate-500">{state}</p></div><StatusPill label={state} tone={state === "جاهز" ? "success" : "warning"} /></div>)}</div></section>
    </div>

    <EmptyTable title={isPlatform ? "آخر عمليات المؤسسات" : "آخر أحداث الجلسات"} body={isPlatform ? "ستظهر طلبات التفعيل والتعليق والتجديد هنا مع سياق المؤسسة." : "ستظهر أحداث RADIUS والمحاسبة هنا بعد تسجيل أول جلسة."} columns={isPlatform ? ["المؤسسة", "العملية", "الحالة", "الوقت"] : ["المستخدم", "الراوتر", "البروتوكول", "الحالة", "الوقت"]} action={isPlatform ? "مراجعة المؤسسات" : "ربط راوتر"} />
  </div>;
}

function ModuleWorkspace({ active, workspace, organizationSlug, isPlatformAdmin }: { active: ModuleKey; workspace: Workspace; organizationSlug: string; isPlatformAdmin: boolean }) {
  const detail = moduleDetails[active];
  const tableMap: Partial<Record<ModuleKey, { title: string; body: string; columns: string[] }>> = {
    network: { title: "سجل الراوترات", body: "أضف أول راوتر بعد تخزين مرجع السر في الخادم، ثم اختبر الهوية والإصدار ووقت الاستجابة كعملية قابلة للتدقيق.", columns: ["الراوتر", "الموقع", "نمط الاتصال", "الحالة", "آخر ظهور"] },
    customers: { title: "دليل العملاء", body: "لا يظهر أي عميل قبل إدخاله ضمن المؤسسة الحالية. عمليات الاستيراد والتحرير يجب أن تتحقق من التكرار والصلاحيات.", columns: ["العميل", "اسم المستخدم", "الحالة", "الباقة", "آخر نشاط"] },
    vouchers: { title: "دفعات البطاقات", body: "أنشئ الدفعات بأرقام تسلسلية وسجل طباعة، واحفظ السر بطريقة لا تتيح عرضه مرة أخرى بعد انتهاء عملية الإنشاء المصرح بها.", columns: ["الدفعة", "الباقة", "العدد", "الحالة", "تاريخ الإنشاء"] },
    sessions: { title: "سجل الجلسات", body: "لا يتم ملء السجل إلا من accounting موثق. يظهر استخدام البيانات بعد تطبيع Start وInterim وStop وربطها بالراوتر الصحيح.", columns: ["المستخدم", "الراوتر", "HotSpot / PPPoE", "الاستهلاك", "الحالة"] },
    billing: { title: "الفواتير والدفعات", body: "تُنشأ الفواتير من عمليات مؤكدة، وتسجل الدفعات بمرجع واضح قبل أن تؤثر في التقارير والقيود المالية.", columns: ["رقم الفاتورة", "العميل", "الإجمالي", "الحالة", "تاريخ الاستحقاق"] },
    support: { title: workspace === "platform" ? "تذاكر المؤسسات" : "تذاكر الدعم", body: "أنشئ تذكرة بسياق المؤسسة، واختر الأولوية والحالة، ثم اربط الرسائل وسجل التغيير دون عرض أسرار الشبكة.", columns: ["المرجع", "الموضوع", "الأولوية", "الحالة", "آخر تحديث"] },
    reports: { title: "التقارير المحفوظة", body: "أنشئ تقريرًا نطاقه زمني واضح، ثم احفظه ككائن محمي مع سجل وصول بدل وضعه في رابط عام.", columns: ["اسم التقرير", "النطاق", "الحالة", "أنشئ بواسطة", "الإنشاء"] },
    organizations: { title: "دليل المؤسسات", body: "مساحة المنصة لا تعرض بيانات العملاء أو الجلسات التفصيلية؛ تعرض فقط حالة الاشتراك والحدود والصحة اللازمة للإدارة المركزية.", columns: ["المؤسسة", "الخطة", "الاشتراك", "استخدام الموارد", "الحالة"] },
    plans: { title: "كتالوج خطط Netora", body: "حدد الحدود على الخادم: راوترات، عملاء، موظفون، وتخزين. لا يكفي تعطيل عناصر الواجهة عند بلوغ الحد.", columns: ["الخطة", "الراوترات", "العملاء", "التخزين", "الحالة"] },
    subscriptions: { title: "سجل الاشتراكات", body: "يظهر هنا التفعيل والتجديد والتعليق وانتهاء التجربة. يجب أن تكون سياسة كل انتقال حالة واضحة وقابلة للتدقيق.", columns: ["المؤسسة", "الخطة", "الحالة", "تنتهي في", "التجديد"] },
    audit: { title: "أحداث التدقيق", body: "سجل غير قابل للتحرير من الواجهة للعمليات الحساسة. يحفظ الفاعل والسياق والنتيجة دون أسرار أو كلمات مرور.", columns: ["الفاعل", "العملية", "المورد", "النتيجة", "الوقت"] },
    settings: { title: "قائمة التكاملات", body: "كل تكامل يعرض حالة ومرجع إعداد فقط. تحفظ المفاتيح وshared secrets في الخادم ولا تنتقل إطلاقًا إلى الواجهة.", columns: ["التكامل", "النمط", "الحالة", "آخر فحص", "السياسة"] },
  };
  const table = tableMap[active];
  return <div className="space-y-5 netora-enter"><section className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_30px_rgba(23,35,61,.035)] lg:flex-row lg:items-end lg:justify-between"><div className="max-w-2xl"><p className="text-xs font-semibold text-violet-600">{detail.eyebrow}</p><h1 className="mt-2 text-xl font-bold text-slate-900">{detail.title}</h1><p className="mt-2 text-sm leading-7 text-slate-500">{detail.description}</p></div>{detail.action && <button onClick={() => toast.info(`${detail.action}: هذه الخطوة محفوظة كواجهة تشغيل وتنتظر ربط بيانات مؤسستك.`)} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-bold text-white shadow-[0_9px_20px_rgba(86,70,234,.2)] transition hover:bg-violet-700 active:scale-[.97]"><Plus className="h-4 w-4" />{detail.action}</button>}</section><Suspense fallback={<ModulePanelFallback />}>
    {workspace === "platform" && active === "organizations" ? <PlatformOrganizationsPanel isAdmin={isPlatformAdmin} /> : workspace === "platform" && active === "plans" ? <PlatformPlansPanel isAdmin={isPlatformAdmin} /> : workspace === "platform" && active === "subscriptions" ? <PlatformSubscriptionsPanel isAdmin={isPlatformAdmin} /> : workspace === "platform" && active === "support" ? <PlatformSupportTicketsPanel isAdmin={isPlatformAdmin} /> : active === "settings" ? <SettingsPanel organizationSlug={organizationSlug} /> : active === "billing" ? <div className="space-y-5"><OperationalBillingPanel organizationSlug={organizationSlug} /><FinancialLedgerPanel organizationSlug={organizationSlug} /></div> : active === "network" ? <OperationalNetworkPanel organizationSlug={organizationSlug} /> : active === "customers" ? <OperationalCustomersPanel organizationSlug={organizationSlug} /> : active === "support" ? <div className="space-y-5"><OperationalSupportPanel organizationSlug={organizationSlug} /><SupportTemplatesPanel organizationSlug={organizationSlug} /></div> : active === "sessions" ? <OperationalSessionsPanel organizationSlug={organizationSlug} /> : active === "vouchers" ? <div className="space-y-5"><ServicePlanPolicyPanel organizationSlug={organizationSlug} /><OperationalVouchersPanel organizationSlug={organizationSlug} /></div> : active === "audit" ? <TenantAuditLogPanel organizationSlug={organizationSlug} /> : active === "reports" ? <TenantReportsPanel organizationSlug={organizationSlug} /> : active === "accounting" ? <AccountingPanel organizationSlug={organizationSlug} /> : active === "cards" ? <CardsPanel organizationSlug={organizationSlug} /> : active === "cardDesign" ? <CardDesignPanel organizationSlug={organizationSlug} /> : active === "apiTokens" ? <ApiTokensPanel organizationSlug={organizationSlug} /> : active === "macSecurity" ? <MacSecurityPanel organizationSlug={organizationSlug} /> : active === "hotspotPages" ? <HotspotLoginBuilderPanel organizationSlug={organizationSlug} /> : active === "reportBuilderAdvanced" ? <AdvancedReportBuilderPanel organizationSlug={organizationSlug} /> : active === "cardsImport" ? <CardsImportPanel organizationSlug={organizationSlug} /> : active === "backupScheduling" ? <BackupSchedulingPanel organizationSlug={organizationSlug} /> : active === "smsTemplates" ? <SmsTemplatesPanel organizationSlug={organizationSlug} /> : active === "dynamicSettings" ? <DynamicSettingsPanel organizationSlug={organizationSlug} /> : active === "roles" ? <RolesPanel organizationSlug={organizationSlug} /> : active === "reportBuilder" ? <ReportBuilderPanel organizationSlug={organizationSlug} /> : active === "backup" ? <BackupPanel organizationSlug={organizationSlug} /> : active === "monitor" ? <MonitorPanel organizationSlug={organizationSlug} /> : active === "points" ? <PointsPanel organizationSlug={organizationSlug} /> : active === "sms" ? <SmsPanel organizationSlug={organizationSlug} /> : active === "competitions" ? <CompetitionsPanel organizationSlug={organizationSlug} /> : active === "chat" ? <ChatPanel organizationSlug={organizationSlug} /> : table ? <EmptyTable {...table} action={detail.action ?? "إضافة"} /> : <Overview workspace={workspace} isLoading={false} error={false} />}</Suspense>
  </div>;
}

function NetworkPanel() { return <div className="grid gap-5 xl:grid-cols-[.75fr_1.25fr]"><section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_30px_rgba(23,35,61,.035)]"><p className="text-xs font-semibold text-slate-500">مخطط الاتصال</p><div className="mt-5 space-y-3">{([["لوحة Netora", "سياسات وصلاحيات", ShieldCheck], ["خدمة التكامل", "Jobs آمنة وAllowlist", Cable], ["RouterOS", "API-SSL أو REST HTTPS", Router], ["FreeRADIUS", "Auth · Acct · CoA", RadioTower]] as [string, string, LucideIcon][]).map(([title, subtitle, Icon], index) => <div key={title} className="relative flex gap-3"><div className="relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-600"><Icon className="h-4 w-4" /></div>{index < 3 && <span className="absolute right-[18px] top-9 h-5 border-r border-dashed border-violet-200" />}<div className="pb-3"><p className="text-sm font-bold text-slate-800">{title}</p><p className="mt-1 text-xs text-slate-500">{subtitle}</p></div></div>)}</div></section><EmptyTable title="سجل الراوترات" body="لن تبدأ المزامنة قبل إضافة راوتر والتحقق من هويته وإصدار RouterOS، ثم حفظ credentials كمرجع خادمي." columns={["الراوتر", "الموقع", "الصحة", "آخر فحص"]} action="إضافة راوتر" /></div>; }

function OrganizationGate() { return <section className="rounded-2xl border border-dashed border-violet-200 bg-violet-50/60 p-6 text-center"><LockKeyhole className="mx-auto h-5 w-5 text-violet-600" /><h2 className="mt-3 text-sm font-bold text-slate-900">اختر أو أنشئ مؤسسة أولًا</h2><p className="mx-auto mt-2 max-w-lg text-xs leading-6 text-slate-600">لا يمكن للوحدات التشغيلية إجراء أي طلب دون سياق مؤسسة مستخرج من عضويتك في الخادم.</p></section>; }

function DataFeedback({ loading, error, empty, message }: { loading: boolean; error: boolean; empty: boolean; message: string }) { if (loading) return <div className="flex items-center justify-center gap-2 py-14 text-xs font-semibold text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin text-violet-600" />يجري تحميل بيانات المؤسسة…</div>; if (error) return <div className="py-12 text-center"><CircleAlert className="mx-auto h-5 w-5 text-rose-500" /><p className="mt-3 text-xs font-bold text-rose-700">تعذر تحميل البيانات</p><p className="mt-1 text-xs text-slate-500">لا تُعرض بيانات بديلة عند وقوع خطأ في الوصول أو التفويض.</p></div>; if (empty) return <div className="py-12 text-center"><FileStack className="mx-auto h-5 w-5 text-violet-500" /><p className="mt-3 text-xs font-bold text-slate-700">لا توجد سجلات بعد</p><p className="mt-1 text-xs text-slate-500">{message}</p></div>; return null; }

function formatWhen(value: Date | null) { return value ? new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short" }).format(value) : "—"; }

function OperationalNetworkPanel({ organizationSlug }: { organizationSlug: string }) { if (!organizationSlug) return <OrganizationGate />; return <div className="space-y-5"><RouterProvisionPanel organizationSlug={organizationSlug} /><RouterSearchPanel organizationSlug={organizationSlug} /><NetworkResourcesPanel organizationSlug={organizationSlug} /></div>; }

function OperationalCustomersPanel({ organizationSlug }: { organizationSlug: string }) { if (!organizationSlug) return <OrganizationGate />; return <div className="space-y-5"><CustomerDirectoryPanel organizationSlug={organizationSlug} /><CustomerImportPanel organizationSlug={organizationSlug} /></div>; }

function OperationalSupportPanel({ organizationSlug }: { organizationSlug: string }) { if (!organizationSlug) return <OrganizationGate />; return <div className="space-y-5"><SupportTicketDirectoryPanel organizationSlug={organizationSlug} /><SupportOperationsPanel organizationSlug={organizationSlug} /></div>; }

function OperationalSessionsPanel({ organizationSlug }: { organizationSlug: string }) { if (!organizationSlug) return <OrganizationGate />; return <SessionControlPanel organizationSlug={organizationSlug} />; }

function OperationalVouchersPanelLegacy({ organizationSlug }: { organizationSlug: string }) {
  const utils = trpc.useUtils(); const [name, setName] = useState(""); const [type, setType] = useState<"voucher" | "subscription" | "pppoe">("voucher"); const [price, setPrice] = useState("0");
  const plansQuery = trpc.workspace.servicePlans.list.useQuery({ organizationSlug }, { enabled: Boolean(organizationSlug), retry: false });
  const vouchersQuery = trpc.workspace.vouchers.list.useQuery({ organizationSlug, limit: 25, offset: 0 }, { enabled: Boolean(organizationSlug), retry: false });
  const createPlan = trpc.workspace.servicePlans.create.useMutation({ onSuccess: async () => { setName(""); setPrice("0"); toast.success("تم حفظ الباقة كمسودة قابلة للمراجعة."); await utils.workspace.servicePlans.list.invalidate(); }, onError: error => toast.error(error.message) });
  if (!organizationSlug) return <OrganizationGate />;
  return <div className="space-y-5"><div className="grid gap-5 xl:grid-cols-[.75fr_1.25fr]"><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(23,35,61,.035)]"><p className="text-xs font-bold text-violet-600">إنشاء باقة</p><p className="mt-2 text-xs leading-6 text-slate-500">تبدأ الباقة كمسودة؛ ربطها بملف سرعة وسياسة RADIUS خطوة خادمية لاحقة.</p><div className="mt-4 space-y-3"><input value={name} onChange={event => setName(event.target.value)} placeholder="اسم الباقة" className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-violet-400" /><div className="grid grid-cols-2 gap-3"><select value={type} onChange={event => setType(event.target.value as "voucher" | "subscription" | "pppoe")} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-violet-400"><option value="voucher">بطاقة</option><option value="subscription">اشتراك</option><option value="pppoe">PPPoE</option></select><input value={price} onChange={event => setPrice(event.target.value)} placeholder="0.00" dir="ltr" inputMode="decimal" className="h-10 rounded-xl border border-slate-200 px-3 text-left text-xs outline-none focus:border-violet-400" /></div><button disabled={createPlan.isPending} onClick={() => { if (!name.trim() || !/^\d{1,10}(?:\.\d{1,2})?$/.test(price)) { toast.error("أدخل اسم الباقة وسعرًا صحيحًا."); return; } createPlan.mutate({ organizationSlug, name: name.trim(), type, price, simultaneousSessions: 1 }); }} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-violet-600 text-xs font-bold text-white disabled:opacity-60"><Plus className="h-4 w-4" />{createPlan.isPending ? "جارٍ الحفظ…" : "حفظ مسودة الباقة"}</button></div></section><section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(23,35,61,.035)]"><div className="border-b border-slate-100 px-5 py-4"><h2 className="text-sm font-bold text-slate-900">الباقات</h2><p className="mt-1 text-xs text-slate-500">سياسة الخدمة تبقى ضمن سياق المؤسسة الحالي.</p></div>{plansQuery.data?.length ? <div className="overflow-x-auto"><table className="min-w-[620px] w-full text-right"><thead className="bg-slate-50 text-[11px] text-slate-500"><tr><th className="px-5 py-3">الباقة</th><th>النوع</th><th>السعر</th><th className="px-5">الحالة</th></tr></thead><tbody>{plansQuery.data.map(plan => <tr key={plan.id} className="border-t border-slate-100 text-xs"><td className="px-5 py-4 font-bold text-slate-800">{plan.name}</td><td className="text-slate-600">{plan.type}</td><td dir="ltr" className="text-left text-slate-600">{plan.price}</td><td className="px-5"><StatusPill label={plan.status} tone={plan.status === "active" ? "success" : "neutral"} /></td></tr>)}</tbody></table></div> : <DataFeedback loading={plansQuery.isLoading} error={Boolean(plansQuery.error)} empty message="لا توجد باقات بعد؛ أنشئ مسودة لخدمة بطاقات أو اشتراك أو PPPoE." />}</section></div><section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(23,35,61,.035)]"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4"><div><h2 className="text-sm font-bold text-slate-900">البطاقات</h2><p className="mt-1 text-xs text-slate-500">إصدار الدفعات والطباعة الآمنة سيُنفّذان بعد وضع سياسة تشفير، كشف مرة واحدة، وصلاحية مخصصة.</p></div><StatusPill label="بانتظار الإصدار" tone="warning" /></div>{vouchersQuery.data?.length ? <div className="overflow-x-auto"><table className="min-w-[620px] w-full text-right"><thead className="bg-slate-50 text-[11px] text-slate-500"><tr><th className="px-5 py-3">التسلسل</th><th>الباقة</th><th>الحالة</th><th className="px-5">الانتهاء</th></tr></thead><tbody>{vouchersQuery.data.map(voucher => <tr key={voucher.id} className="border-t border-slate-100 text-xs"><td dir="ltr" className="px-5 py-4 font-mono text-slate-700">{voucher.serial}</td><td className="font-bold text-slate-800">{voucher.planName}</td><td><StatusPill label={voucher.status} tone={voucher.status === "active" ? "success" : "neutral"} /></td><td className="px-5 text-slate-500">{formatWhen(voucher.expiresAt)}</td></tr>)}</tbody></table></div> : <DataFeedback loading={vouchersQuery.isLoading} error={Boolean(vouchersQuery.error)} empty message="لا توجد بطاقات بعد. لا يُنشئ Netora أرقامًا سرية أو بطاقات تمثيلية." />}</section></div>;
}

function FinancePanel() { return <div className="grid gap-5 xl:grid-cols-[.85fr_1.15fr]"><section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_30px_rgba(23,35,61,.035)]"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold text-slate-500">مبادئ مالية</p><h3 className="mt-1 text-lg font-bold text-slate-900">لا رصيد بلا أثر</h3></div><BookOpenCheck className="h-5 w-5 text-violet-600" /></div><div className="mt-5 space-y-3">{[["الفاتورة", "وثيقة مصدرية صالحة للإصدار"], ["الدفعة", "تأكيد بمرجع وطريقة قبض"], ["القيد", "جانب مدين ودائن متوازن"], ["التقرير", "مبني من قيود وحالات مؤكدة"]].map(([a,b]) => <div key={a} className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold text-slate-700">{a}</p><p className="mt-1 text-[11px] text-slate-500">{b}</p></div>)}</div></section><EmptyTable title="دفتر القيود" body="تظهر القيود بعد إصدار عمليات مالية مؤكدة؛ لا ينشئ النظام أرصدة شكلية أو تعديلات غير موثقة." columns={["رقم القيد", "البيان", "مدين", "دائن", "التاريخ"]} action="قيد جديد" /></div>; }

function AuditPanel() { return <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_30px_rgba(23,35,61,.035)]"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold text-violet-600">سجل محمي</p><h2 className="mt-1 text-lg font-bold text-slate-900">قواعد التدقيق التي ستطبق تلقائيًا</h2></div><StatusPill label="جاهز للربط" tone="success" /></div><div className="mt-5 grid gap-3 md:grid-cols-2">{[["إضافة أو تعديل راوتر", "الفاعل، المؤسسة، مورد الشبكة، النتيجة، request ID"], ["تغيير باقة أو سرعة", "الإصدار السابق والجديد من سياسة الخدمة"], ["قطع جلسة أو CoA", "سبب العملية، job ID، نتيجة NAS منقحة"], ["ملف أو نسخة احتياطية", "صاحب الإجراء، نوع الملف، وقت الوصول، دون محتوى أو مفاتيح"]].map(([title, content]) => <article key={title} className="rounded-xl border border-slate-100 p-4"><h3 className="text-sm font-bold text-slate-800">{title}</h3><p className="mt-2 text-xs leading-6 text-slate-500">{content}</p></article>)}</div></section>; }

function IntegrationGrid() { const integrations = [["MikroTik", "API-SSL / REST HTTPS", "لم يُربط", Router, "warning"], ["FreeRADIUS", "Authentication · Accounting · CoA", "لم يُهيأ", RadioTower, "warning"], ["الرسائل", "قوالب وتسليمات مؤرشفة", "غير مهيأ", MessageSquareText, "neutral"], ["التخزين", "ملفات محمية بروابط مؤقتة", "جاهز", FileArchive, "success"]] as const; return <div className="grid gap-4 md:grid-cols-2">{integrations.map(([name, detail, state, Icon, tone]) => <article key={name} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_30px_rgba(23,35,61,.035)]"><div className="flex items-start justify-between"><span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-700"><Icon className="h-5 w-5" /></span><StatusPill label={state} tone={tone} /></div><h3 className="mt-5 text-sm font-bold text-slate-800">{name}</h3><p className="mt-2 text-xs leading-6 text-slate-500">{detail}</p><button onClick={() => toast.info(`إعداد ${name} يتم من الخادم وبصلاحية مالك المؤسسة فقط.`)} className="mt-5 inline-flex items-center gap-1.5 text-xs font-bold text-violet-600">إدارة آمنة <ArrowUpLeft className="h-3.5 w-3.5" /></button></article>)}</div>; }

function SettingsPanel({ organizationSlug }: { organizationSlug: string }) { return <div className="space-y-5"><TwoFactorSettingsPanel /><TenantIntegrationPanel organizationSlug={organizationSlug} /><IntegrationGrid /><TenantFilesPanel organizationSlug={organizationSlug} /></div>; }

function printOneTimeVoucherCodes(reference: string, codes: string[]) { const popup = window.open("", "_blank", "noopener,noreferrer"); if (!popup) { toast.error("تعذر فتح معاينة الطباعة؛ اسمح بالنوافذ المنبثقة ثم أعد المحاولة."); return false; } const safeCodes = codes.map(code => `<li>${code}</li>`).join(""); popup.document.write(`<!doctype html><html dir="rtl"><head><meta charset="utf-8"/><title>${reference}</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#17213a}h1{font-size:18px}ol{direction:ltr;font-family:monospace;columns:2;font-size:14px;line-height:2}</style></head><body><h1>بطاقات Netora · ${reference}</h1><p>احتفظ بهذه الصفحة في بيئة آمنة. لن تُستعاد الرموز من السجل.</p><ol>${safeCodes}</ol></body></html>`); popup.document.close(); popup.focus(); popup.print(); return true; }

function OperationalVouchersPanel({ organizationSlug }: { organizationSlug: string }) {
  const utils = trpc.useUtils();
  const [planId, setPlanId] = useState("");
  const [quantity, setQuantity] = useState("10");
  const [oneTimeIssue, setOneTimeIssue] = useState<{ batchId: number; reference: string; codes: string[] } | null>(null); const [batchSearch, setBatchSearch] = useState(""); const [batchStatus, setBatchStatus] = useState<"all" | "draft" | "generated" | "printed" | "cancelled">("all");
  const plansQuery = trpc.workspace.servicePlans.list.useQuery({ organizationSlug }, { enabled: Boolean(organizationSlug), retry: false });
  const batchListInput = useMemo(() => ({ organizationSlug, limit: 25, offset: 0, search: batchSearch.trim() || undefined, status: batchStatus === "all" ? undefined : batchStatus }), [batchSearch, batchStatus, organizationSlug]);
  const batchesQuery = trpc.workspace.vouchers.listBatches.useQuery(batchListInput, { enabled: Boolean(organizationSlug), retry: false });
  const activatePlan = trpc.workspace.servicePlans.activate.useMutation({ onSuccess: async () => { toast.success("تم تفعيل الباقة لإصدار البطاقات."); await utils.workspace.servicePlans.list.invalidate(); }, onError: error => toast.error(error.message) });
  const issueBatch = trpc.workspace.vouchers.issueBatch.useMutation({ onSuccess: async result => { setOneTimeIssue({ batchId: result.batchId, reference: result.reference, codes: result.codes }); toast.success("تم إصدار الدفعة. احفظ الرموز الآن؛ لن تظهر لاحقًا."); await Promise.all([utils.workspace.vouchers.list.invalidate(), utils.workspace.vouchers.listBatches.invalidate()]); }, onError: error => toast.error(error.message) });
  const markPrinted = trpc.workspace.vouchers.markBatchPrinted.useMutation({ onSuccess: async () => { toast.success("تم تسجيل الطباعة في سجل التدقيق."); await utils.workspace.vouchers.listBatches.invalidate(); }, onError: error => toast.error(error.message) });
  const activePlans = plansQuery.data?.filter(plan => plan.status === "active") ?? [];
  if (!organizationSlug) return <OrganizationGate />;
  return <div className="space-y-5"><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(23,35,61,.035)]"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold text-violet-600">إصدار دفعة محمية</p><h2 className="mt-1 text-base font-bold text-slate-900">البطاقات والباقات</h2><p className="mt-2 max-w-3xl text-xs leading-6 text-slate-500">لا يقبل الإصدار إلا باقة مفعلة ضمن المؤسسة. تُحفظ تجزئة الرمز فقط، وتعود القيم الصريحة في ردّ واحد ثم لا تظهر في القوائم أو السجل.</p></div><StatusPill label="كشف مرة واحدة" tone="warning" /></div><div className="mt-5 grid gap-3 md:grid-cols-[1fr_130px_auto]"><select value={planId} onChange={event => setPlanId(event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-violet-400"><option value="">اختر باقة مفعلة</option>{activePlans.map(plan => <option key={plan.id} value={plan.id}>{plan.name} · {plan.type}</option>)}</select><input value={quantity} onChange={event => setQuantity(event.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="العدد" className="h-10 rounded-xl border border-slate-200 px-3 text-center text-xs outline-none focus:border-violet-400" /><button disabled={issueBatch.isPending || !activePlans.length} onClick={() => { const count = Number(quantity); if (!Number.isInteger(Number(planId)) || count < 1 || count > 250) { toast.error("اختر باقة وحدد عددًا بين 1 و250."); return; } issueBatch.mutate({ organizationSlug, servicePlanId: Number(planId), quantity: count }); }} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"><CreditCard className="h-4 w-4" />{issueBatch.isPending ? "جارٍ الإصدار…" : "إصدار الدفعة"}</button></div>{!plansQuery.isLoading && !activePlans.length && <p className="mt-3 text-xs text-amber-700">لا توجد باقة مفعلة. فعّل مسودة باقة من الجدول أدناه قبل الإصدار.</p>}</section>{oneTimeIssue && <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold text-amber-800">الرموز صالحة للعرض لمرة واحدة</p><h3 className="mt-1 text-sm font-bold text-amber-950">{oneTimeIssue.reference}</h3></div><div className="flex gap-2"><button onClick={async () => { await navigator.clipboard.writeText(oneTimeIssue.codes.join("\n")); toast.success("تم نسخ الرموز إلى الحافظة."); }} className="rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-bold text-amber-900">نسخ الرموز</button><button onClick={() => { if (printOneTimeVoucherCodes(oneTimeIssue.reference, oneTimeIssue.codes)) { markPrinted.mutate({ organizationSlug, batchId: oneTimeIssue.batchId }); } }} className="rounded-xl bg-amber-800 px-3 py-2 text-xs font-bold text-white">طباعة الآن</button></div></div><textarea readOnly value={oneTimeIssue.codes.join("\n")} dir="ltr" className="mt-4 h-28 w-full resize-none rounded-xl border border-amber-200 bg-white p-3 font-mono text-xs text-slate-700 outline-none" /><button onClick={() => setOneTimeIssue(null)} className="mt-3 text-xs font-bold text-amber-900">إخفاء الرموز نهائيًا من هذه الجلسة</button></section>}<div className="grid gap-5 xl:grid-cols-2"><section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(23,35,61,.035)]"><div className="border-b border-slate-100 px-5 py-4"><h2 className="text-sm font-bold text-slate-900">باقات الخدمة</h2><p className="mt-1 text-xs text-slate-500">لا يمكن إصدار بطاقات لمسودة أو باقة مؤرشفة.</p></div>{plansQuery.data?.length ? <div className="overflow-x-auto"><table className="min-w-[560px] w-full text-right"><thead className="bg-slate-50 text-[11px] text-slate-500"><tr><th className="px-5 py-3">الباقة</th><th>النوع</th><th>الحالة</th><th className="px-5">إجراء</th></tr></thead><tbody>{plansQuery.data.map(plan => <tr key={plan.id} className="border-t border-slate-100 text-xs"><td className="px-5 py-4 font-bold text-slate-800">{plan.name}</td><td className="text-slate-600">{plan.type}</td><td><StatusPill label={plan.status} tone={plan.status === "active" ? "success" : "neutral"} /></td><td className="px-5">{plan.status === "draft" ? <button disabled={activatePlan.isPending} onClick={() => activatePlan.mutate({ organizationSlug, servicePlanId: plan.id })} className="text-xs font-bold text-violet-700 disabled:opacity-50">تفعيل</button> : "—"}</td></tr>)}</tbody></table></div> : <DataFeedback loading={plansQuery.isLoading} error={Boolean(plansQuery.error)} empty message="أنشئ باقة أولًا من شاشة البطاقات والباقات الحالية." />}</section><section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(23,35,61,.035)]"><div className="border-b border-slate-100 px-5 py-4"><h2 className="text-sm font-bold text-slate-900">دفعات البطاقات</h2><p className="mt-1 text-xs text-slate-500">يعرض المرجع والكمية والحالة فقط، دون أي قيمة سرية.</p><div className="mt-3 flex flex-wrap gap-2"><input value={batchSearch} onChange={event => setBatchSearch(event.target.value)} placeholder="البحث بالمرجع" dir="ltr" className="h-9 min-w-[160px] flex-1 rounded-xl border border-slate-200 px-3 text-left text-xs outline-none focus:border-violet-400" /><select value={batchStatus} onChange={event => setBatchStatus(event.target.value as "all" | "draft" | "generated" | "printed" | "cancelled")} className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none"><option value="all">كل الحالات</option><option value="generated">مُصدرة</option><option value="printed">مطبوعة</option><option value="cancelled">ملغاة</option></select></div></div>{batchesQuery.data?.length ? <div className="overflow-x-auto"><table className="min-w-[590px] w-full text-right"><thead className="bg-slate-50 text-[11px] text-slate-500"><tr><th className="px-5 py-3">المرجع</th><th>الباقة</th><th>العدد</th><th>الحالة</th><th className="px-5">طباعة</th></tr></thead><tbody>{batchesQuery.data.map(batch => <tr key={batch.id} className="border-t border-slate-100 text-xs"><td dir="ltr" className="px-5 py-4 font-mono text-[10px] text-slate-700">{batch.reference}</td><td className="font-bold text-slate-800">{batch.planName}</td><td className="text-slate-600">{batch.quantity}</td><td><StatusPill label={batch.status} tone={batch.status === "printed" ? "success" : "neutral"} /></td><td className="px-5">{batch.status === "generated" ? <button disabled={markPrinted.isPending} onClick={() => markPrinted.mutate({ organizationSlug, batchId: batch.id })} className="text-xs font-bold text-violet-700 disabled:opacity-50">تسجيل الطباعة</button> : "—"}</td></tr>)}</tbody></table></div> : <DataFeedback loading={batchesQuery.isLoading} error={Boolean(batchesQuery.error)} empty message="لم يتم إصدار أي دفعة تطابق البحث والمرشح الحاليين." />}</section></div></div>;
}

export default function Home() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const previewQuery = trpc.netora.overview.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const membershipsQuery = trpc.tenant.listMine.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const [workspace, setWorkspace] = useState<Workspace>("tenant");
  const [active, setActive] = useState<ModuleKey>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedOrganizationSlug, setSelectedOrganizationSlug] = useState("");
  useEffect(() => {
    if (!selectedOrganizationSlug && membershipsQuery.data?.[0]) setSelectedOrganizationSlug(membershipsQuery.data[0].organizationSlug);
  }, [membershipsQuery.data, selectedOrganizationSlug]);
  const tenantOverviewQuery = trpc.tenant.overview.useQuery({ organizationSlug: selectedOrganizationSlug || "pending-context" }, {
    enabled: isAuthenticated && Boolean(selectedOrganizationSlug),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const navigation = workspace === "tenant" ? tenantNavigation : platformNavigation;
  const activeTitle = useMemo(() => moduleDetails[active].title, [active]);
  const switchWorkspace = (mode: Workspace) => { setWorkspace(mode); setActive("overview"); setSidebarOpen(false); };
  return <div className="netora-grid min-h-screen bg-[#f5f7fb] text-slate-900">
    <aside className={`netora-scrollbar fixed inset-y-0 right-0 z-50 flex w-[276px] flex-col overflow-y-auto border-l border-slate-200/80 bg-white px-3 pb-4 pt-5 shadow-[0_12px_30px_rgba(26,34,60,.06)] transition-transform duration-200 lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "translate-x-full"}`}>
      <div className="flex items-center justify-between px-2"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-[#6e5eff] to-[#4432d6] text-base font-extrabold text-white shadow-[0_10px_20px_rgba(86,70,234,.25)]">ن</span><div><p className="text-base font-extrabold tracking-tight text-slate-900">Netora</p><p className="mt-0.5 text-[10px] font-medium tracking-wide text-slate-400">NETWORK OPERATIONS CLOUD</p></div></div><button onClick={() => setSidebarOpen(false)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 lg:hidden"><X className="h-4 w-4" /></button></div>
      <div className="mt-6 rounded-2xl border border-violet-100 bg-violet-50/70 p-2"><div className="grid grid-cols-2 rounded-xl bg-white p-1 shadow-sm"><button onClick={() => switchWorkspace("tenant")} className={`rounded-lg px-2 py-2 text-[11px] font-bold transition ${workspace === "tenant" ? "bg-violet-600 text-white" : "text-slate-500 hover:bg-violet-50"}`}>مساحة المستأجر</button><button onClick={() => switchWorkspace("platform")} className={`rounded-lg px-2 py-2 text-[11px] font-bold transition ${workspace === "platform" ? "bg-violet-600 text-white" : "text-slate-500 hover:bg-violet-50"}`}>إدارة المنصة</button></div></div>
      <nav className="mt-5 flex-1 space-y-5">{navigation.map(group => <div key={group.title}><p className="px-3 text-[10px] font-bold tracking-[.08em] text-slate-400">{group.title}</p><div className="mt-2 space-y-1">{group.items.map(item => { const Icon = item.icon; const selected = item.key === active; return <button key={item.key} onClick={() => { setActive(item.key); setSidebarOpen(false); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-right text-xs font-semibold transition ${selected ? "bg-violet-50 text-violet-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}><Icon className={`h-4 w-4 ${selected ? "text-violet-600" : "text-slate-400"}`} /><span className="flex-1">{item.label}</span>{item.badge && <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">{item.badge}</span>}</button>; })}</div></div>)}</nav>
      <div className="mt-4 border-t border-slate-100 pt-4"><div className="rounded-2xl bg-[#121b37] p-3 text-white"><div className="flex items-center gap-2"><LockKeyhole className="h-4 w-4 text-violet-300" /><p className="text-xs font-bold">العزل الخادمي مفعّل</p></div><p className="mt-2 text-[10px] leading-5 text-slate-300">لا تُعرض أسرار التكاملات أو بيانات مؤسسة أخرى في الواجهة.</p></div><button onClick={() => { if (!user) { startLogin(); return; } toast.info("إدارة الجلسة مرتبطة بحساب Netora المصادق عليه."); }} className="mt-4 flex w-full items-center gap-3 rounded-xl px-2 py-2 text-right"><span className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">{user?.name?.slice(0, 1) ?? "ن"}</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold text-slate-700">{user?.name ?? "تسجيل الدخول"}</span><span className="mt-0.5 block truncate text-[10px] text-slate-400">{authLoading ? "جارٍ التحقق…" : user ? "جلسة مصادق عليها" : "وضع المعاينة"}</span></span><ChevronDown className="h-4 w-4 text-slate-400" /></button></div>
    </aside>
    {sidebarOpen && <button aria-label="إغلاق القائمة" onClick={() => setSidebarOpen(false)} className="fixed inset-0 z-40 bg-slate-950/20 backdrop-blur-sm lg:hidden" />}
    <main className="min-h-screen lg:mr-[276px]"><header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-slate-200/70 bg-[#f5f7fb]/90 px-4 backdrop-blur-xl sm:px-6"><div className="flex items-center gap-3"><button onClick={() => setSidebarOpen(true)} className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 lg:hidden"><PanelRight className="h-4 w-4" /></button><div><p className="text-[11px] font-semibold text-slate-400">{workspace === "tenant" ? "مساحة المستأجر" : "الإدارة المركزية"}</p><h2 className="mt-0.5 text-sm font-bold text-slate-800">{activeTitle}</h2></div></div><div className="flex items-center gap-2"><button onClick={() => setSearchOpen(true)} className="hidden h-9 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-400 hover:border-violet-200 sm:flex"><Search className="h-4 w-4" /><span>بحث سريع</span><kbd className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">⌘ K</kbd></button><button onClick={() => toast.info("لا توجد تنبيهات تشغيلية قبل ربط المصادر.")} className="relative grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"><Bell className="h-4 w-4" /><span className="absolute left-2 top-2 h-1.5 w-1.5 rounded-full bg-violet-500" /></button><button onClick={() => toast.message("حالة العمل: وضع معاينة آمن")} className="hidden items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm ring-1 ring-slate-200 sm:flex"><Gauge className="h-4 w-4 text-violet-600" />جاهزية النظام</button></div></header>
      <div className="mx-auto max-w-[1560px] px-4 py-6 sm:px-6 lg:px-8">{active === "overview" ? <div className="space-y-5"><TenantContextCard isAuthenticated={isAuthenticated} isLoading={membershipsQuery.isLoading} error={Boolean(membershipsQuery.error)} memberships={membershipsQuery.data} selectedSlug={selectedOrganizationSlug} onSelect={setSelectedOrganizationSlug} />{workspace === "tenant" && <TenantPlanUsageCard organizationSlug={selectedOrganizationSlug} />}<Overview workspace={workspace} preview={previewQuery.data} tenant={tenantOverviewQuery.data} isLoading={authLoading || previewQuery.isLoading || tenantOverviewQuery.isLoading} error={(Boolean(previewQuery.error) || Boolean(tenantOverviewQuery.error)) && isAuthenticated} /></div> : <ModuleWorkspace active={active} workspace={workspace} organizationSlug={selectedOrganizationSlug} isPlatformAdmin={user?.role === "admin"} />}</div>
    </main>
    {searchOpen && <div className="fixed inset-0 z-[60] grid place-items-start bg-slate-950/25 px-4 pt-24 backdrop-blur-sm" onClick={() => setSearchOpen(false)}><div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl" onClick={event => event.stopPropagation()}><div className="flex items-center gap-3 border-b border-slate-100 px-2 pb-3"><Command className="h-4 w-4 text-violet-600" /><input autoFocus placeholder="ابحث عن وحدة أو إجراء…" className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-slate-400" /><button onClick={() => setSearchOpen(false)} className="rounded-md bg-slate-100 px-2 py-1 text-[10px] text-slate-500">Esc</button></div><div className="p-2"><p className="px-2 py-2 text-[10px] font-bold text-slate-400">إجراءات سريعة</p>{["إضافة راوتر", "إنشاء دفعة بطاقات", "إضافة عميل", "فتح تذكرة"].map(action => <button key={action} onClick={() => { setSearchOpen(false); toast.info(`${action}: تتطلب صلاحية وتهيئة بيانات المؤسسة.`); }} className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-right text-xs font-semibold text-slate-700 hover:bg-violet-50 hover:text-violet-700"><Plus className="h-4 w-4" />{action}</button>)}</div></div></div>}
  </div>;
}
