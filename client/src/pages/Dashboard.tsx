import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { TenantPlanUsageCard } from "@/components/TenantPlanUsageCard";
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
  Clock,
  TableProperties,
  LayoutTemplate,
  Smartphone,
  Key
} from "lucide-react";

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

type Workspace = "tenant" | "platform";
type ModuleKey = "overview" | "reports" | "export_builder" | "advanced_reports" | "customers" | "import_customers" | "roles" | "sessions" | "billing" | "financial" | "accounting" | "plans" | "cards" | "card_design" | "import_cards" | "mac_security" | "hotspot_pages" | "support" | "support_templates" | "chat" | "network" | "routers" | "router_search" | "monitor" | "integrations" | "api_tokens" | "sms" | "sms_templates" | "competitions" | "points" | "files" | "audit" | "dynamic_settings" | "two_factor" | "backup" | "backup_schedule" | "platform_organizations" | "platform_plans" | "platform_subscriptions" | "platform_support";

const tenantNavigation: { title: string; items: { key: ModuleKey; label: string; icon: LucideIcon; badge?: string }[] }[] = [
  { title: "المتابعة والتقارير", items: [{ key: "overview", label: "نظرة عامة", icon: LayoutDashboard }, { key: "reports", label: "التقارير الجاهزة", icon: FileBarChart2 }, { key: "export_builder", label: "تصدير مخصص", icon: TableProperties }, { key: "advanced_reports", label: "منشئ التقارير المتقدم", icon: FileStack }] },
  { title: "إدارة التشغيل", items: [{ key: "network", label: "المواقع والراوترات", icon: Network }, { key: "routers", label: "تهيئة راوتر جديد", icon: Router }, { key: "router_search", label: "بحث في الراوترات", icon: Search }, { key: "monitor", label: "مراقبة الخوادم", icon: Activity }, { key: "sessions", label: "الجلسات النشطة", icon: Activity }, { key: "mac_security", label: "حماية MAC", icon: ShieldCheck }, { key: "hotspot_pages", label: "صفحات الهوتسبوت", icon: LayoutTemplate }] },
  { title: "البطاقات والمشتركين", items: [{ key: "plans", label: "باقات الخدمة", icon: SlidersHorizontal }, { key: "cards", label: "إدارة البطاقات", icon: WalletCards }, { key: "card_design", label: "استوديو التصميم", icon: Palette }, { key: "import_cards", label: "استيراد البطاقات", icon: ArrowUpLeft }, { key: "customers", label: "دليل العملاء", icon: UsersRound }, { key: "import_customers", label: "استيراد العملاء", icon: ArrowUpLeft }] },
  { title: "المحاسبة والمالية", items: [{ key: "billing", label: "فواتير المشتركين", icon: ReceiptText }, { key: "accounting", label: "النظام المحاسبي", icon: CircleDollarSign }, { key: "financial", label: "القيود والدفاتر", icon: BookOpenCheck }] },
  { title: "التسويق والولاء", items: [{ key: "points", label: "النقاط والمكافآت", icon: Star }, { key: "competitions", label: "المسابقات والجوائز", icon: Trophy }] },
  { title: "الرسائل والدعم", items: [{ key: "support", label: "تذاكر الدعم", icon: Headphones, badge: "٣ جديدة" }, { key: "chat", label: "المحادثة المباشرة", icon: MessageCircle }, { key: "support_templates", label: "قوالب الدعم", icon: MessageSquareText }, { key: "sms", label: "رسائل SMS", icon: Smartphone }, { key: "sms_templates", label: "قوالب SMS", icon: MessageSquareText }] },
  { title: "الملفات والنظام", items: [{ key: "files", label: "الملفات والتخزين", icon: FileArchive }, { key: "roles", label: "الأدوار والصلاحيات", icon: ShieldCheck }, { key: "two_factor", label: "المصادقة الثنائية", icon: LockKeyhole }, { key: "audit", label: "سجل النظام", icon: History }, { key: "dynamic_settings", label: "إعدادات الوحدات", icon: Settings2 }, { key: "backup", label: "النسخ الاحتياطي", icon: DatabaseBackup }, { key: "backup_schedule", label: "جدولة النسخ", icon: Clock }, { key: "integrations", label: "التكاملات والأسرار", icon: FileKey2 }, { key: "api_tokens", label: "مفاتيح API", icon: Key }] }
];
const platformNavigation: { title: string; items: { key: ModuleKey; label: string; icon: LucideIcon; badge?: string }[] }[] = [
  { title: "نظرة عامة", items: [{ key: "overview", label: "لوحة التحكم", icon: LayoutDashboard }] },
  { title: "الإدارة التشغيلية", items: [{ key: "platform_organizations", label: "مؤسسات المنصة", icon: Boxes }, { key: "platform_plans", label: "خطط الاشتراك", icon: BadgeDollarSign }, { key: "platform_subscriptions", label: "الاشتراكات النشطة", icon: CheckCircle2 }, { key: "platform_support", label: "تذاكر المنصة", icon: CircleAlert, badge: "جديد" }] }
];

const moduleDetails: Record<ModuleKey, { title: string; icon: LucideIcon; desc: string }> = {
  overview: { title: "نظرة عامة", icon: Activity, desc: "مؤشرات وحالة الشبكة والمؤسسة." },
  reports: { title: "التقارير الجاهزة", icon: FileBarChart2, desc: "تقارير مالية وتشغيلية معتمدة." },
  export_builder: { title: "تصدير مخصص", icon: TableProperties, desc: "تصدير بيانات مجدولة." },
  advanced_reports: { title: "منشئ التقارير المتقدم", icon: FileStack, desc: "بناء تقارير مخصصة وجدولتها." },
  customers: { title: "دليل العملاء", icon: UsersRound, desc: "إدارة المشتركين وحالتهم." },
  import_customers: { title: "استيراد العملاء", icon: ArrowUpLeft, desc: "استيراد مشتركين من ملفات الخارجية." },
  roles: { title: "الأدوار والصلاحيات", icon: ShieldCheck, desc: "تخصيص الصلاحيات للمستخدمين." },
  sessions: { title: "الجلسات النشطة", icon: Cable, desc: "مراقبة وإدارة اتصالات المشتركين." },
  billing: { title: "فواتير المشتركين", icon: ReceiptText, desc: "الفواتير الدورية للمشتركين." },
  financial: { title: "القيود والدفاتر", icon: BookOpenCheck, desc: "سجل مالي مفصل للعمليات." },
  accounting: { title: "النظام المحاسبي", icon: CircleDollarSign, desc: "إدارة الحسابات، الصناديق والمستودعات." },
  plans: { title: "باقات الخدمة", icon: SlidersHorizontal, desc: "إعداد سرعات وحصص المشتركين." },
  cards: { title: "إدارة البطاقات", icon: WalletCards, desc: "توليد وإدارة قسائم الاشتراك." },
  card_design: { title: "استوديو التصميم", icon: Palette, desc: "تصميم وطباعة قسائم الاشتراك." },
  import_cards: { title: "استيراد البطاقات", icon: ArrowUpLeft, desc: "استيراد الكروت من مصادر خارجية." },
  mac_security: { title: "حماية MAC", icon: ShieldCheck, desc: "إدارة قواعد الأمان لأجهزة الراوتر." },
  hotspot_pages: { title: "صفحات الهوتسبوت", icon: LayoutTemplate, desc: "تصميم وبناء صفحات تسجيل الدخول." },
  support: { title: "تذاكر الدعم", icon: Headphones, desc: "متابعة شكاوى وطلبات المشتركين." },
  support_templates: { title: "قوالب الدعم", icon: MessageSquareText, desc: "قوالب الردود الجاهزة للدعم الفني." },
  chat: { title: "المحادثة المباشرة", icon: MessageCircle, desc: "دعم فني مباشر للمشتركين." },
  network: { title: "المواقع والراوترات", icon: Network, desc: "إدارة البنية التحتية والمقاسم." },
  routers: { title: "تهيئة راوتر جديد", icon: Router, desc: "إضافة أجهزة جديدة وتكوينها." },
  router_search: { title: "بحث في الراوترات", icon: Search, desc: "البحث عن بيانات راوتر معين." },
  monitor: { title: "مراقبة الخوادم", icon: Activity, desc: "مراقبة أداء وحالة الخوادم." },
  integrations: { title: "التكاملات والأسرار", icon: FileKey2, desc: "ربط المنصة بخدمات خارجية." },
  api_tokens: { title: "مفاتيح API", icon: Key, desc: "إدارة رموز الوصول للواجهة البرمجية." },
  sms: { title: "رسائل SMS", icon: Smartphone, desc: "إعدادات ورسائل خدمة SMS." },
  sms_templates: { title: "قوالب SMS", icon: MessageSquareText, desc: "نماذج جاهزة لرسائل SMS." },
  competitions: { title: "المسابقات والجوائز", icon: Trophy, desc: "إدارة مسابقات المشتركين." },
  points: { title: "النقاط والمكافآت", icon: Star, desc: "برامج الولاء ونقاط المشتركين." },
  files: { title: "الملفات والتخزين", icon: FileArchive, desc: "إدارة الملفات المرفوعة والنسخ." },
  audit: { title: "سجل النظام", icon: History, desc: "تدقيق حركات المستخدمين الدقيقة." },
  dynamic_settings: { title: "إعدادات الوحدات", icon: Settings2, desc: "تخصيص سلوك النظام." },
  two_factor: { title: "المصادقة الثنائية", icon: LockKeyhole, desc: "إعدادات الأمان المتقدم للمستخدم." },
  backup: { title: "النسخ الاحتياطي", icon: DatabaseBackup, desc: "إنشاء واستعادة نسخ قواعد البيانات." },
  backup_schedule: { title: "جدولة النسخ", icon: Clock, desc: "إعداد أوقات النسخ الاحتياطي الآلي." },
  platform_organizations: { title: "مؤسسات المنصة", icon: Boxes, desc: "إدارة شاملة للمشتركين في المنصة." },
  platform_plans: { title: "خطط الاشتراك", icon: BadgeDollarSign, desc: "تعريف وتعديل باقات المنصة." },
  platform_subscriptions: { title: "الاشتراكات النشطة", icon: CheckCircle2, desc: "متابعة اشتراكات المؤسسات وتجديدها." },
  platform_support: { title: "تذاكر المنصة", icon: CircleAlert, desc: "دعم فني لمالكي المؤسسات." },
};

function Overview({ workspace, preview, tenant, isLoading, error }: { workspace: Workspace; preview: any; tenant: any; isLoading: boolean; error: boolean }) {
  if (error) return <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center text-red-600"><CircleAlert className="mx-auto mb-3 h-10 w-10 text-red-400" /><h3 className="text-sm font-bold">تعذر تحميل البيانات</h3><p className="mt-1 text-xs text-red-500">حدث خطأ أثناء الاتصال بالخادم، قد لا تملك صلاحية لهذه المساحة.</p></div>;
  if (isLoading) return <div className="grid min-h-[400px] place-items-center rounded-2xl border border-slate-100 bg-white"><div className="flex flex-col items-center gap-3"><LoaderCircle className="h-8 w-8 animate-spin text-violet-600" /><p className="text-xs font-semibold text-slate-500">جلب مؤشرات المساحة…</p></div></div>;
  if (workspace === "tenant") {
    const stats = tenant || { activeSessions: 0, activeCustomers: 0, offlineRouters: 0, pendingTickets: 0, storageUsedBytes: 0, lastSyncAt: new Date().toISOString() };
    return <div className="space-y-5"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><StatCard title="الجلسات النشطة" value={stats.activeSessions.toLocaleString()} icon={Cable} color="text-emerald-600" bg="bg-emerald-50" border="border-emerald-100" trend="+12% من الأمس" /><StatCard title="العملاء المتصلين" value={stats.activeCustomers.toLocaleString()} icon={UsersRound} color="text-blue-600" bg="bg-blue-50" border="border-blue-100" /><StatCard title="تذاكر مفتوحة" value={stats.pendingTickets.toLocaleString()} icon={Headphones} color="text-amber-600" bg="bg-amber-50" border="border-amber-100" /><StatCard title="مقاسم مفصولة" value={stats.offlineRouters.toLocaleString()} icon={RadioTower} color={stats.offlineRouters > 0 ? "text-red-600" : "text-slate-600"} bg={stats.offlineRouters > 0 ? "bg-red-50" : "bg-slate-50"} border={stats.offlineRouters > 0 ? "border-red-100" : "border-slate-100"} /></div><div className="grid gap-5 lg:grid-cols-3"><div className="col-span-2 rounded-2xl border border-slate-100 bg-white p-5"><div className="flex items-center justify-between"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-violet-50 text-violet-600"><Activity className="h-5 w-5" /></div><div><h3 className="text-sm font-bold text-slate-900">استهلاك البيانات المباشر</h3><p className="mt-0.5 text-xs text-slate-500">حركة المرور للجلسات النشطة عبر كل الراوترات</p></div></div><button className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"><RefreshCw className="h-3 w-3" />تحديث</button></div><div className="mt-8 flex h-[280px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50"><div className="text-center"><CloudCog className="mx-auto mb-3 h-8 w-8 text-slate-300" /><p className="text-sm font-semibold text-slate-500">تجميع البيانات المباشرة</p><p className="mt-1 text-[11px] text-slate-400">سيتم رسم حركة المرور هنا بعد استلام دفعات RADIUS Interim-Update</p></div></div></div><div className="rounded-2xl border border-slate-100 bg-white p-5"><h3 className="text-sm font-bold text-slate-900">آخر التنبيهات</h3><div className="mt-4 space-y-3"><div className="rounded-xl border border-amber-100 bg-amber-50 p-3"><p className="text-xs font-bold text-amber-800">راوتر Core-Site-1 مفصول</p><p className="mt-1 text-[10px] text-amber-600">فشل التحقق من الاتصال عبر API منذ ٥ دقائق.</p></div><div className="rounded-xl border border-slate-100 p-3"><p className="text-xs font-bold text-slate-700">تحديث أسعار الباقات</p><p className="mt-1 text-[10px] text-slate-500">تم تعديل باقة "فايبر ٥٠ ميجا" بواسطة أحمد.</p></div><div className="rounded-xl border border-slate-100 p-3"><p className="text-xs font-bold text-slate-700">نسخة احتياطية ناجحة</p><p className="mt-1 text-[10px] text-slate-500">تم حفظ نسخة من قواعد البيانات بنجاح فجر اليوم.</p></div></div></div></div></div>;
  }
  const stats = preview || { totalOrganizations: 0, activeOrganizations: 0, totalPlatformRevenue: 0, activePlatformTickets: 0 };
  return <div className="space-y-5"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><StatCard title="المؤسسات المسجلة" value={stats.totalOrganizations.toLocaleString()} icon={Boxes} color="text-violet-600" bg="bg-violet-50" border="border-violet-100" /><StatCard title="الاشتراكات النشطة" value={stats.activeOrganizations.toLocaleString()} icon={CheckCircle2} color="text-emerald-600" bg="bg-emerald-50" border="border-emerald-100" /><StatCard title="العوائد الشهرية" value={`$${stats.totalPlatformRevenue.toLocaleString()}`} icon={BadgeDollarSign} color="text-blue-600" bg="bg-blue-50" border="border-blue-100" /><StatCard title="تذاكر المنصة" value={stats.activePlatformTickets.toLocaleString()} icon={CircleAlert} color="text-amber-600" bg="bg-amber-50" border="border-amber-100" /></div><div className="rounded-2xl border border-slate-100 bg-white p-5"><h3 className="text-sm font-bold text-slate-900">سجل عمليات المنصة (الحديثة)</h3><div className="mt-4 flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50"><div className="text-center"><ShieldCheck className="mx-auto mb-3 h-8 w-8 text-slate-300" /><p className="text-sm font-semibold text-slate-500">واجهة المراقبة المركزية</p><p className="mt-1 text-[11px] text-slate-400">تُظهر نمو وإحصائيات المؤسسات على مستوى الخادم.</p></div></div></div></div>;
}

function StatCard({ title, value, icon: Icon, color, bg, border, trend }: { title: string; value: string; icon: LucideIcon; color: string; bg: string; border: string; trend?: string }) {
  return <div className={`relative overflow-hidden rounded-2xl border bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,.02)] transition-all hover:shadow-md ${border}`}><div className="flex items-center justify-between"><p className="text-xs font-bold text-slate-500">{title}</p><div className={`grid h-8 w-8 place-items-center rounded-lg ${bg} ${color}`}><Icon className="h-4 w-4" /></div></div><div className="mt-3"><p className={`text-2xl font-black tracking-tight ${color.replace("text-", "text-slate-900")}`}>{value}</p>{trend && <p className="mt-1 text-[10px] font-semibold text-emerald-600">{trend}</p>}</div></div>;
}

function ModuleWorkspace({ active, workspace, organizationSlug, isPlatformAdmin }: { active: ModuleKey; workspace: Workspace; organizationSlug: string; isPlatformAdmin: boolean }) {
  const mod = moduleDetails[active];
  return <div className="space-y-4"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm"><mod.icon className="h-5 w-5" /></div><div><h2 className="text-lg font-extrabold text-slate-900">{mod.title}</h2><p className="mt-0.5 text-xs text-slate-500">{mod.desc}</p></div></div><div className="min-h-[500px] rounded-2xl border border-slate-200/60 bg-white p-1 shadow-sm"><div className="h-full rounded-xl bg-[#fafbfc]"><Suspense fallback={<div className="grid h-full min-h-[400px] place-items-center"><LoaderCircle className="h-6 w-6 animate-spin text-violet-600" /></div>}>{workspace === "platform" ? (active === "platform_organizations" ? <PlatformOrganizationsPanel /> : active === "platform_plans" ? <PlatformPlansPanel /> : active === "platform_subscriptions" ? <PlatformSubscriptionsPanel /> : active === "platform_support" ? <PlatformSupportTicketsPanel /> : <div className="p-6 text-center text-slate-500">وحدة منصة قيد التطوير: {active}</div>) : (active === "reports" ? <TenantReportsPanel organizationSlug={organizationSlug} /> : active === "customers" ? <CustomerDirectoryPanel organizationSlug={organizationSlug} /> : active === "import_customers" ? <CustomerImportPanel organizationSlug={organizationSlug} /> : active === "network" ? <NetworkResourcesPanel organizationSlug={organizationSlug} /> : active === "routers" ? <RouterProvisionPanel organizationSlug={organizationSlug} /> : active === "router_search" ? <RouterSearchPanel organizationSlug={organizationSlug} /> : active === "monitor" ? <MonitorPanel organizationSlug={organizationSlug} /> : active === "sessions" ? <SessionControlPanel organizationSlug={organizationSlug} /> : active === "billing" ? <OperationalBillingPanel organizationSlug={organizationSlug} /> : active === "financial" ? <FinancialLedgerPanel organizationSlug={organizationSlug} /> : active === "accounting" ? <AccountingPanel organizationSlug={organizationSlug} /> : active === "plans" ? <ServicePlanPolicyPanel organizationSlug={organizationSlug} /> : active === "cards" ? <CardsPanel organizationSlug={organizationSlug} /> : active === "card_design" ? <CardDesignPanel organizationSlug={organizationSlug} /> : active === "roles" ? <RolesPanel organizationSlug={organizationSlug} /> : active === "import_cards" ? <CardsImportPanel organizationSlug={organizationSlug} /> : active === "export_builder" ? <ReportBuilderPanel organizationSlug={organizationSlug} /> : active === "advanced_reports" ? <AdvancedReportBuilderPanel organizationSlug={organizationSlug} /> : active === "backup" ? <BackupPanel organizationSlug={organizationSlug} /> : active === "backup_schedule" ? <BackupSchedulingPanel organizationSlug={organizationSlug} /> : active === "api_tokens" ? <ApiTokensPanel organizationSlug={organizationSlug} /> : active === "mac_security" ? <MacSecurityPanel organizationSlug={organizationSlug} /> : active === "hotspot_pages" ? <HotspotLoginBuilderPanel organizationSlug={organizationSlug} /> : active === "dynamic_settings" ? <DynamicSettingsPanel organizationSlug={organizationSlug} /> : active === "points" ? <PointsPanel organizationSlug={organizationSlug} /> : active === "sms" ? <SmsPanel organizationSlug={organizationSlug} /> : active === "sms_templates" ? <SmsTemplatesPanel organizationSlug={organizationSlug} /> : active === "two_factor" ? <TwoFactorSettingsPanel /> : active === "competitions" ? <CompetitionsPanel organizationSlug={organizationSlug} /> : active === "chat" ? <ChatPanel organizationSlug={organizationSlug} /> : active === "support" ? <SupportTicketDirectoryPanel organizationSlug={organizationSlug} /> : active === "support_templates" ? <SupportTemplatesPanel organizationSlug={organizationSlug} /> : active === "integrations" ? <TenantIntegrationPanel organizationSlug={organizationSlug} /> : active === "files" ? <TenantFilesPanel organizationSlug={organizationSlug} /> : active === "audit" ? <TenantAuditLogPanel organizationSlug={organizationSlug} /> : <div className="p-8 text-center text-slate-500">الوحدة غير متوفرة بعد أو لم يتم ربطها.</div>)}</Suspense></div></div></div>;
}

function TenantContextCard({ isAuthenticated, isLoading, error, memberships, selectedSlug, onSelect }: { isAuthenticated: boolean; isLoading: boolean; error: boolean; memberships: any[]; selectedSlug: string; onSelect: (slug: string) => void }) {
  if (!isAuthenticated) return null;
  if (error) return <div className="rounded-xl bg-red-50 p-4 text-xs text-red-600">تعذر تحميل سياق المؤسسة.</div>;
  if (isLoading) return <div className="h-16 animate-pulse rounded-2xl bg-slate-100"></div>;
  if (!memberships || memberships.length === 0) return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-800"><div className="flex items-center gap-3"><CircleAlert className="h-5 w-5" /><div><h3 className="text-sm font-bold">لا توجد مؤسسة نشطة</h3><p className="mt-1 text-xs text-amber-700">حسابك غير مرتبط بأي مساحة عمل. تواصل مع مالك المنصة لإضافتك أو إنشاء مساحة جديدة.</p></div></div></div>;
  return <div className="flex flex-col gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"><div><h3 className="text-sm font-bold text-slate-900">سياق العمل الحالي</h3><p className="mt-1 text-xs text-slate-500">أنت تتصفح وتدير بيانات هذه المؤسسة حالياً.</p></div><div className="flex items-center gap-3"><span className="text-xs font-semibold text-slate-400">تغيير المؤسسة:</span><select value={selectedSlug} onChange={e => onSelect(e.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 py-2 pl-8 pr-4 text-sm font-bold text-slate-800 outline-none hover:border-violet-300 focus:border-violet-500 focus:ring-2 focus:ring-violet-200">{memberships.map(m => <option key={m.organizationSlug} value={m.organizationSlug}>{m.organizationName} — ({m.role})</option>)}</select></div></div>;
}

export default function Dashboard() {
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
  const workspace: Workspace = "tenant";
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
  const navigation = tenantNavigation;
  const activeTitle = useMemo(() => moduleDetails[active].title, [active]);

  return <div className="netora-grid min-h-screen bg-[#f5f7fb] text-slate-900">
    <aside className={`netora-scrollbar fixed inset-y-0 right-0 z-50 flex w-[276px] flex-col overflow-y-auto border-l border-slate-200/80 bg-white px-3 pb-4 pt-5 shadow-[0_12px_30px_rgba(26,34,60,.06)] transition-transform duration-200 lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "translate-x-full"}`}>
      <div className="flex items-center justify-between px-2"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-[#6e5eff] to-[#4432d6] text-base font-extrabold text-white shadow-[0_10px_20px_rgba(86,70,234,.25)]">ن</span><div><p className="text-base font-extrabold tracking-tight text-slate-900">Netora</p><p className="mt-0.5 text-[10px] font-medium tracking-wide text-slate-400">NETWORK OPERATIONS CLOUD</p></div></div><button onClick={() => setSidebarOpen(false)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 lg:hidden"><X className="h-4 w-4" /></button></div>
      <nav className="mt-5 flex-1 space-y-5">{navigation.map(group => <div key={group.title}><p className="px-3 text-[10px] font-bold tracking-[.08em] text-slate-400">{group.title}</p><div className="mt-2 space-y-1">{group.items.map(item => { const Icon = item.icon; const selected = item.key === active; return <button key={item.key} onClick={() => { setActive(item.key); setSidebarOpen(false); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-right text-xs font-semibold transition ${selected ? "bg-violet-50 text-violet-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}><Icon className={`h-4 w-4 ${selected ? "text-violet-600" : "text-slate-400"}`} /><span className="flex-1">{item.label}</span>{item.badge && <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">{item.badge}</span>}</button>; })}</div></div>)}</nav>
      <div className="mt-4 border-t border-slate-100 pt-4"><div className="rounded-2xl bg-[#121b37] p-3 text-white"><div className="flex items-center gap-2"><LockKeyhole className="h-4 w-4 text-violet-300" /><p className="text-xs font-bold">العزل الخادمي مفعّل</p></div><p className="mt-2 text-[10px] leading-5 text-slate-300">لا تُعرض أسرار التكاملات أو بيانات مؤسسة أخرى في الواجهة.</p></div><button onClick={() => { if (!user) { startLogin(); return; } toast.info("إدارة الجلسة مرتبطة بحساب Netora المصادق عليه."); }} className="mt-4 flex w-full items-center gap-3 rounded-xl px-2 py-2 text-right"><span className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">{user?.name?.slice(0, 1) ?? "ن"}</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold text-slate-700">{user?.name ?? "تسجيل الدخول"}</span><span className="mt-0.5 block truncate text-[10px] text-slate-400">{authLoading ? "جارٍ التحقق…" : user ? "جلسة مصادق عليها" : "وضع المعاينة"}</span></span><ChevronDown className="h-4 w-4 text-slate-400" /></button></div>
    </aside>
    {sidebarOpen && <button aria-label="إغلاق القائمة" onClick={() => setSidebarOpen(false)} className="fixed inset-0 z-40 bg-slate-950/20 backdrop-blur-sm lg:hidden" />}
    <main className="min-h-screen lg:mr-[276px]"><header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-slate-200/70 bg-[#f5f7fb]/90 px-4 backdrop-blur-xl sm:px-6"><div className="flex items-center gap-3"><button onClick={() => setSidebarOpen(true)} className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 lg:hidden"><PanelRight className="h-4 w-4" /></button><div><p className="text-[11px] font-semibold text-slate-400">مساحة المستأجر</p><h2 className="mt-0.5 text-sm font-bold text-slate-800">{activeTitle}</h2></div></div><div className="flex items-center gap-2"><button onClick={() => setSearchOpen(true)} className="hidden h-9 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-400 hover:border-violet-200 sm:flex"><Search className="h-4 w-4" /><span>بحث سريع</span><kbd className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">⌘ K</kbd></button><button onClick={() => toast.info("لا توجد تنبيهات تشغيلية قبل ربط المصادر.")} className="relative grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"><Bell className="h-4 w-4" /><span className="absolute left-2 top-2 h-1.5 w-1.5 rounded-full bg-violet-500" /></button><button onClick={() => toast.message("حالة العمل: وضع معاينة آمن")} className="hidden items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm ring-1 ring-slate-200 sm:flex"><Gauge className="h-4 w-4 text-violet-600" />جاهزية النظام</button></div></header>
      <div className="mx-auto max-w-[1560px] px-4 py-6 sm:px-6 lg:px-8">{active === "overview" ? <div className="space-y-5"><TenantContextCard isAuthenticated={isAuthenticated} isLoading={membershipsQuery.isLoading} error={Boolean(membershipsQuery.error)} memberships={membershipsQuery.data || []} selectedSlug={selectedOrganizationSlug} onSelect={setSelectedOrganizationSlug} /><TenantPlanUsageCard organizationSlug={selectedOrganizationSlug} /><Overview workspace={workspace} preview={previewQuery.data} tenant={tenantOverviewQuery.data} isLoading={authLoading || previewQuery.isLoading || tenantOverviewQuery.isLoading} error={(Boolean(previewQuery.error) || Boolean(tenantOverviewQuery.error)) && isAuthenticated} /></div> : <ModuleWorkspace active={active} workspace={workspace} organizationSlug={selectedOrganizationSlug} isPlatformAdmin={user?.role === "admin"} />}</div>
    </main>
    {searchOpen && <div className="fixed inset-0 z-[60] grid place-items-start bg-slate-950/25 px-4 pt-24 backdrop-blur-sm" onClick={() => setSearchOpen(false)}><div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl" onClick={event => event.stopPropagation()}><div className="flex items-center gap-3 border-b border-slate-100 px-2 pb-3"><Command className="h-4 w-4 text-violet-600" /><input autoFocus placeholder="ابحث عن وحدة أو إجراء…" className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-slate-400" /><button onClick={() => setSearchOpen(false)} className="rounded-md bg-slate-100 px-2 py-1 text-[10px] text-slate-500">Esc</button></div><div className="p-2"><p className="px-2 py-2 text-[10px] font-bold text-slate-400">إجراءات سريعة</p>{["إضافة راوتر", "إنشاء دفعة بطاقات", "إضافة عميل", "فتح تذكرة"].map(action => <button key={action} onClick={() => { setSearchOpen(false); toast.info(`${action}: تتطلب صلاحية وتهيئة بيانات المؤسسة.`); }} className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-right text-xs font-semibold text-slate-700 hover:bg-violet-50 hover:text-violet-700"><Plus className="h-4 w-4" />{action}</button>)}</div></div></div>}
  </div>;
}
