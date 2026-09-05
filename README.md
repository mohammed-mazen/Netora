# Netora — منصة إدارة مزودي الإنترنت (ISP) متعددة المستأجرين

## نظرة عامة على المشروع
- **الاسم**: Netora
- **الهدف**: منصة SaaS متعددة المستأجرين (Multi-tenant) لإدارة مزودي خدمة الإنترنت المحليين (ISP/WISP) — إدارة العملاء، الراوترات (MikroTik)، جلسات RADIUS، الفوترة، القسائم (Vouchers)، والدعم الفني، لكل مؤسسة (tenant) بشكل معزول تمامًا.
- **الحالة**: ✅ **جاهز تقنيًا للنشر على VPS مستقل** — تم استبدال كل الاعتماديات الاحتكارية (Manus/Genspark OAuth + Forge Storage) بحلول مستقلة، وتم بناء واختبار كل الوظائف الأساسية (auth، secrets vault، MikroTik client، RADIUS accounting، background worker).

## المزايا المكتملة (تحديث 2026-08-29 — 11 وحدة جديدة لموازاة apluswifi.com)
تمت إضافة 11 وحدة جديدة كاملة (خلفية tRPC + جدول/جداول قاعدة بيانات + لوحة واجهة React مربوطة في التنقّل) لموازاة مزايا apluswifi.com/demo.apluswifi.com:

| الوحدة | الوصف | إجراءات tRPC (`workspace.<module>.*` إلا ما هو مذكور) |
|---|---|---|
| **المحاسبة** (`accounting`) | دليل حسابات، صناديق نقدية، مخازن، تحويلات مخزنية، سندات قبض/دفع | `chartAccounts.list/create`, `cashBoxes.list/create`, `warehouses.list/create`, `stockTransfers.list/create/updateStatus`, `cashVouchers.list/create` |
| **فئات ومجموعات البطاقات** (`cards`) | فئات القسائم بالسعر/الباقة، مجموعات القسائم (حد المستخدمين، طول الكود، رصيد الوقت/التحميل، الربط بأول MAC) | `categories.list/create`, `groups.list/create` |
| **استوديو تصميم البطاقات** (`cardDesign`) | تصميم قسيمة قابل للتخصيص (أبعاد، لون الحدود، صورة خلفية، الشعار المائي، الباركود/QR)، طابور طباعة | `designs.list/save`, `printJobs.list/queue` |
| **الأدوار المخصّصة** (`roles`) | صلاحيات دقيقة (Fine-grained RBAC) فوق مصفوفة الأدوار الأساسية الستّة — إنشاء دور مخصّص، تعيينه لعضو | `roles.list/create/updatePermissions/delete`, `roles.members.list/assignRole` |
| **مُنشئ التقارير المخصّصة** (`reportBuilder`) | تعريف تقارير (مجموعة بيانات + أعمدة + مرشحات)، جدولة تلقائية، تصدير | `definitions.list/create`, `schedules.list/create`, `exports.list/generate` |
| **النسخ الاحتياطي** (`backup`) | إنشاء ومتابعة مهام نسخ احتياطي | `backup.list/create` |
| **مراقبة الخادم** (`monitor`) | إعدادات تنبيهات Telegram (إعادة تشغيل/إيقاف، تنبيه بطارية UPS بنسب تحذير/حرجة)، عيّنات دورية (CPU/RAM/قرص/بطارية/حالة الخدمة) | `settings.get/save`, `samples.list/record` |
| **النقاط والولاء** (`points`) | إعدادات نظام النقاط، مستويات مزايا (Tiers)، أرصدة العملاء، دفتر حركات (كسب/صرف) | `settings.get/save`, `tiers.list/create`, `balances.get`, `ledger.list/post` |
| **بوابة الرسائل النصية** (`sms`) | إعداد مزوّد SMS (نوع الخادم، عدد شرائح SIM، الشريحة الافتراضية، نوع الإرسال، القيمة السرية)، طابور رسائل | `settings.get/save`, `messages.list/queue` |
| **المسابقات** (`competitions`) | مسابقات بنقاط متدرجة (سهل/متوسط/صعب)، بنك أسئلة، إرسال إجابات العملاء | `list/create/updateStatus`, `questions.list/create`, `entries.submit` |
| **الدعم المباشر (Live Chat)** (`chat`) | محادثات دعم مباشرة، رسائل بين العميل/الوكيل | `threads.list/create/updateStatus`, `messages.list/post` |

جميع الإجراءات أعلاه تتطلب `organizationSlug` ضمن مدخلاتها (نمط `tenantPermissionProcedure`)، ومربوطة بلوحات React مقابلة (`client/src/components/{Accounting,Cards,CardDesign,Roles,ReportBuilder,Backup,Monitor,Points,Sms,Competitions,Chat}Panel.tsx`)، تُحمَّل عبر `lazy()` وتظهر كحزم (chunks) منفصلة في البناء الإنتاجي، ومربوطة بالكامل في تنقّل لوحة المؤسسة (`client/src/pages/Home.tsx`) ضمن 8 مجموعات: المتابعة، التشغيل، البطاقات والتصميم، المحاسبة، التسويق والولاء، المال والدعم، الاتصالات، الإدارة والنظام.

**قاعدة البيانات**: أُضيفت 26+ جدولًا جديدًا عبر migration واحدة (`drizzle/0004_spotty_the_hand.sql`) — `backup_jobs`, `card_designs`, `cash_boxes`, `cash_vouchers`, `chart_accounts`, `chat_messages`, `chat_threads`, `competition_entries`, `competition_questions`, `competitions`, `custom_roles`, `customer_point_balances`, `monitor_samples`, `monitor_settings`, `point_ledger_entries`, `points_benefit_tiers`, `points_settings`, `print_jobs`, `report_definitions`, `report_exports`, `report_schedules`, `role_permissions`, `sms_messages`, `sms_settings`, `stock_transfers`, `voucher_categories`, `voucher_category_prices`, `voucher_groups`, `warehouses`. تم تطبيقها والتحقق منها (60 جدولًا إجماليًا).

**الحالة**: ✅ `tsc --noEmit` نظيف تمامًا، `npm run build` ناجح (كل الحزم الـ11 الجديدة مقسّمة كملفات مستقلة)، ومجموعة الاختبارات الكاملة **14/14 ملف، 60/60 اختبار ناجح** (بعد إصلاح ترتيب FIFO في طابور المهام الخلفية وعزل بيانات الاختبار — راجع "آخر تحديث" أدناه).

## المزايا المكتملة (الأساسية)
- **مصادقة مستقلة بالكامل**: تسجيل/دخول/خروج بالبريد وكلمة المرور (bcrypt 12 rounds + JWT جلسات عبر `jose`/HS256)، بدون أي اعتماد على مزود OAuth خارجي.
- **تخزين ملفات مستقل**: تكامل S3-compatible (`@aws-sdk/client-s3` + presigned URLs) بدل Forge API.
- **خزنة أسرار مشفّرة (Secrets Vault)**: AES-256-GCM لتخزين كلمات مرور الراوترات (`router_credentials`، فريد لكل راوتر) وأسرار التكاملات على مستوى المؤسسة (`integration_secrets`، فريد لكل مؤسسة+نوع: radius/mikrotik/sms/payment). المفتاح الرئيسي فقط في متغير البيئة `SECRET_ENCRYPTION_KEY`، لا يُخزَّن أبدًا في القاعدة.
- **عميل MikroTik RouterOS حقيقي** (`server/mikrotik.ts`): يستخدم REST-HTTPS (RouterOS v7+) عبر Basic Auth — فحص صحة الراوتر (`/system/identity` + `/system/resource`) وفصل جلسات Hotspot/PPPoE النشطة (`/ip/hotspot/active`, `/ppp/active`).
- **عامل خلفية (Background Worker) حقيقي** (`server/worker/backgroundJobWorker.ts`): يعالج قائمة `background_jobs` كل 5 ثوانٍ، وينفّذ فعليًا: فحص صحة الراوتر، قراءة الهوية، فصل جلسة عبر RADIUS، مع نظام إعادة محاولة (حتى 5 محاولات بتأخير تصاعدي).
- **معالجة RADIUS Accounting حقيقية** (`server/radiusAccounting.ts`, نقطة النهاية `POST /api/radius/accounting`): تعالج أحداث Start/Interim-Update/Stop فعليًا، تربط الحدث بالمؤسسة عبر NAS-Identifier، تتحقق من السر المشترك، وتحدّث جدول `network_sessions`.
- **واجهة تزويد الراوترات**: نموذج لإضافة راوتر جديد مع اسم المستخدم/كلمة المرور الاختيارية (تُشفَّر وتُخزَّن فورًا).
- **بنية RBAC ومتعدد المستأجرين**: عزل كامل لكل مؤسسة عبر `tenantProcedure`/`tenantPermissionProcedure`، مع مصفوفة صلاحيات في `server/access.ts`.
- **أدوات نشر VPS جاهزة**: `.env.example`، `ecosystem.config.cjs` (PM2)، `Dockerfile` (بناء متعدد المراحل).
- **عزل NAS-Identifier فريد على مستوى المنصة بالكامل**: تم إصلاح ثغرة تسريب بيانات بين المؤسسات — `router_nas_unique` الآن قيد فريد عالمي (وليس لكل مؤسسة) لأن حزم RADIUS accounting لا تحمل أي سياق مستأجر ويُعتمد فيها على NAS-Identifier وحده لتحديد المؤسسة (`getRouterByNasIdentifier`). راجع migration `drizzle/0002_sleepy_mac_gargan.sql` والتعليقات في `drizzle/schema.ts` و`server/db.ts`.
- **تجاوز شهادات TLS الذاتية لراوترات MikroTik**: `server/mikrotik.ts` يستخدم الآن `undici.Agent` مع `rejectUnauthorized: false` كـ `dispatcher` مخصص لكل طلب `fetch`، لأن راوترات RouterOS الفعلية تُقدَّم دائمًا تقريبًا بشهادة ذاتية التوقيع من المصنع. موثّق كتنازل أمني متعمّد (حركة إدارة الراوترات مفترض أن تكون عبر شبكة محلية/VPN، وليست عبر الإنترنت المفتوح) — راجع التعليق التفصيلي في أعلى الملف. تم التحقق فعليًا عبر خادم HTTPS محلي بشهادة ذاتية التوقيع حقيقية في `server/mikrotik.test.ts`.
- **Rate Limiting**: تم تفعيله عبر `express-rate-limit` — حد صارم (20/15 دقيقة لكل IP) على `auth.login`/`auth.register` (بما يشمل استدعاءات tRPC batch)، حد عام أخف (300/دقيقة) على كل `/api/trpc`، وحد مخصص (1200/دقيقة) على `/api/radius/accounting`. `trust proxy` مُفعّل (قابل للتهيئة عبر `TRUST_PROXY_HOPS`) حتى يعمل التحديد على IP العميل الحقيقي خلف بروكسي عكسي (nginx/Caddy).
- **رؤوس أمان HTTP**: تم تفعيل `helmet` (مع تعطيل CSP الافتراضي لأن الواجهة تحمّل خطوطًا/سكربتات من CDN خارجية — TLS/HSTS متروكان للبروكسي العكسي).
- **حدود حجم body لكل مسار على حدة**: بدلًا من حد عام 50MB لكل الطلبات، أصبح `/api/radius/accounting` محدودًا بـ 256KB، و`/api/trpc` بـ 10MB (يكفي لأكبر حمولة مشروعة وهي رفع ملف base64 بحد أقصى ~7MB في `workspace.files.upload`).
- **تقسيم حزمة الواجهة الأمامية (code splitting)**: إضافة `manualChunks` في `vite.config.ts` لفصل المكتبات الكبيرة (`react`/`react-dom`, Radix UI, `recharts`, `framer-motion`, طبقة tRPC/react-query) إلى ملفات vendor منفصلة قابلة للتخزين المؤقت (caching) بشكل مستقل عن كود التطبيق. خفّض حجم الحزمة الرئيسية من 506KB إلى ~352KB بعد الضغط (gzip: 148KB → 102KB).
- **مجموعة اختبارات شاملة تعمل على قاعدة بيانات حقيقية** (14 ملف اختبار، 58 اختبارًا، كلها ناجحة):
  - `server/auth.flow.test.ts` (5) — تسجيل/دخول/خروج/جلسة.
  - `server/secrets.test.ts` (8) — تشفير/فك تشفير أسرار التكاملات وبيانات اعتماد الراوترات.
  - `server/mikrotik.test.ts` (7) — سلوك عميل MikroTik ضد راوترات بلا اعتماد / غير قابلة للوصول / وضع agent غير المطبَّق، + اختبارَي TLS جديدين ضد خادم HTTPS محلي حقيقي بشهادة ذاتية التوقيع.
  - `server/radiusAccounting.test.ts` (6) — دورة حياة كاملة (Start→Interim→Stop)، التحقق من السر المشترك، حالات NAS غير معروف.
  - `server/worker/backgroundJobWorker.test.ts` (9) — دورة claim/execute الكاملة، إعادة المحاولة، الفشل النهائي بعد استنفاد المحاولات.
  - + ملفات الاختبار الموجودة مسبقًا (tenant/platform/access/customerImport/fileService/integrationContracts/netora/financial/auth.logout).

## نقاط الدخول الوظيفية (Entry URIs)
### REST (خارج tRPC)
| المسار | الطريقة | الوصف |
|---|---|---|
| `/api/radius/accounting` | POST | استقبال أحداث RADIUS accounting من FreeRADIUS (JSON، ترويسة `X-Radius-Shared-Secret`) |
| `/api/storage/*` | متعدد | وكيل التخزين S3 (presigned URLs) |

### tRPC (`/api/trpc/*`)
- **auth**: `register`, `login`, `logout`, `me`
- **tenant**: عمليات عضوية/سياق المؤسسة
- **workspace**: (كل الإجراءات تتطلب `organizationSlug` ضمن سياق المستأجر)
  - `network.listRouters`, `network.createRouter` (يقبل الآن `username`/`password` اختياريين لبيانات اعتماد الراوتر)
  - `network.listSites`, `network.createSite`, `network.listSpeedProfiles`, `network.createSpeedProfile`
  - `customers.list`, `customers.create`, `customers.updateStatus`, `customers.assignServicePlan`, `customers.importCsv`
  - `servicePlans.list`, `servicePlans.create`, `servicePlans.activate`
  - `vouchers.list`, `vouchers.listBatches`, `vouchers.issueBatch`, `vouchers.markBatchPrinted`
  - `sessions.list`, `sessions.queueDisconnect`
  - `support.list`, `support.create`, `support.updateStatus`, `support.listMessages`
  - `integrations.saveDraft`, `integrations.queueHealthCheck` (ينشئ `background_jobs` تُلتقط بواسطة العامل)
- **accounting**: `chartAccounts.list/create`, `cashBoxes.list/create`, `warehouses.list/create`, `stockTransfers.list/create/updateStatus`, `cashVouchers.list/create`
- **cards**: `categories.list/create`, `groups.list/create`
- **cardDesign** (راوتر `cards` أيضًا — استوديو التصميم والطباعة): `designs.list/save`, `printJobs.list/queue`
- **roles**: `roles.list/create/updatePermissions/delete`, `roles.members.list/assignRole`
- **reportBuilder**: `definitions.list/create`, `schedules.list/create`, `exports.list/generate`
- **backup**: `backup.list/create`
- **monitor**: `settings.get/save`, `samples.list/record`
- **points**: `settings.get/save`, `tiers.list/create`, `balances.get`, `ledger.list/post`
- **sms**: `settings.get/save`, `messages.list/queue`
- **competitions**: `list/create/updateStatus`, `questions.list/create`, `entries.submit`
- **chat**: `threads.list/create/updateStatus`, `messages.list/post`
- **platform**: لوحة تحكم مشغّل المنصة (عرض المؤسسات دون بيانات العملاء/الأسرار)

## البيانات والبنية التخزينية
- **قاعدة البيانات**: MySQL/MariaDB عبر Drizzle ORM (`drizzle/schema.ts`)، مع migrations في `drizzle/`.
- **الجداول الأساسية**: `users`, `organizations`, `organization_members`, `routers`, `router_credentials`، `integration_secrets`, `integration_configs`, `background_jobs`, `network_sessions`, `customers`, `service_plans`, `vouchers`, `support_tickets`, `invoices`.
- **جداول الوحدات الـ11 الجديدة** (migration `0004`): `chart_accounts`, `cash_boxes`, `warehouses`, `stock_transfers`, `cash_vouchers` (محاسبة)؛ `voucher_categories`, `voucher_category_prices`, `voucher_groups` (فئات/مجموعات البطاقات)؛ `card_designs`, `print_jobs` (استوديو التصميم)؛ `custom_roles`, `role_permissions` (الأدوار المخصّصة)؛ `report_definitions`, `report_schedules`, `report_exports` (مُنشئ التقارير)؛ `backup_jobs` (النسخ الاحتياطي)؛ `monitor_settings`, `monitor_samples` (مراقبة الخادم)؛ `points_settings`, `points_benefit_tiers`, `customer_point_balances`, `point_ledger_entries` (النقاط والولاء)؛ `sms_settings`, `sms_messages` (بوابة SMS)؛ `competitions`, `competition_questions`, `competition_entries` (المسابقات)؛ `chat_threads`, `chat_messages` (الدعم المباشر). **60 جدولًا إجماليًا** بعد التطبيق.
- **التخزين الموضوعي**: S3-compatible (AWS S3 / Cloudflare R2 / MinIO) عبر `@aws-sdk/client-s3`.
- **خزنة الأسرار**: AES-256-GCM، مفتاح 32-بايت (hex-64 أو base64) في `SECRET_ENCRYPTION_KEY`.
- **تدفق البيانات لـ RADIUS**: `FreeRADIUS → (rlm_rest/linelog/exec module) → POST /api/radius/accounting → network_sessions`. تحليل حزم RADIUS UDP الخام غير مطبَّق عمدًا في Node — راجع التعليقات في `server/radiusAccounting.ts`.

## دليل الاستخدام المختصر
1. مالك المنصة يسجّل حسابًا وينشئ مؤسسة (tenant).
2. داخل لوحة المؤسسة: إضافة راوتر MikroTik (عنوان الإدارة + اسم مستخدم/كلمة مرور RouterOS API + NAS-Identifier فريد على مستوى المنصة بالكامل).
3. تفعيل تكامل RADIUS: حفظ مسودة التكامل ثم تعيين السر المشترك (سيُستخدم للتحقق من طلبات `/api/radius/accounting`).
4. إعداد FreeRADIUS على الشبكة ليرسل أحداث Accounting إلى نقطة النهاية أعلاه (راجع قسم "إعداد FreeRADIUS" أدناه).
5. العامل الخلفي (Background Worker) يفحص صحة الراوترات تلقائيًا كل بضع ثوانٍ ويعالج طلبات فصل الجلسات.

### إعداد FreeRADIUS (ملخص)
في `clients.conf` سجّل كل راوتر NAS بعنوانه وسره الخاص بـ RADIUS (بروتوكول RADIUS التقليدي، منفصل عن `X-Radius-Shared-Secret` المستخدم في استدعاء HTTP). استخدم وحدة `linelog` أو `rlm_rest` أو سكربت `exec` بسيط لتحويل كل Accounting-Request إلى طلب `POST` بصيغة JSON نحو `/api/radius/accounting` مع الحقول: `nasIdentifier`, `acctStatusType`, `acctUniqueId`, `username`, `protocol`, `acctInputOctets`, `acctOutputOctets`. أضف ترويسة `X-Radius-Shared-Secret` بقيمة السر الذي حفظته في تكامل RADIUS بالمنصة.

## الميزات غير المكتملة / خارج النطاق الحالي (موثّقة عمدًا)
- **إشعارات Telegram الفعلية لمراقبة الخادم**: جدول `monitor_settings` يخزّن `telegramChatId` وإعدادات التنبيه (إعادة تشغيل/إيقاف/بطارية)، وجدول `monitor_samples` يخزّن العيّنات، لكن **إرسال رسالة Telegram فعلية عبر Bot API عند تجاوز عتبة** غير مطبَّق بعد — هذا يتطلب مهمة `background_jobs` جديدة (`monitor_alert_dispatch`) تقرأ آخر عيّنة وتقارنها بالعتبات وتستدعي Telegram Bot API. البنية التحتية (الجدول + الإعدادات + لوحة الواجهة) جاهزة، لكن حلقة "افحص → قارن → أرسل" الفعلية غير مربوطة بالعامل الخلفي.
- **إرسال SMS فعلي عبر مزوّد خارجي**: `sms.messages.queue` يُدرج الرسالة في `sms_messages` بحالة `queued` فقط — الاتصال الفعلي بمزوّد SMS (Twilio/مزوّد محلي) عبر REST API غير مطبَّق؛ يحتاج معالجًا مشابهًا لعامل `background_jobs` الحالي.
- **حساب/ترحيل نقاط الولاء تلقائيًا**: `points.ledger.post` يسجّل حركة يدوية فقط — لا يوجد ربط تلقائي مع الفوترة/الاستخدام لمنح نقاط تلقائيًا عند الدفع أو الاستهلاك.
- **تصدير تقارير حقيقي (PDF/Excel)**: `reportBuilder.exports.generate` يسجّل طلب التصدير في `report_exports` فقط — توليد ملف PDF/XLSX فعلي وتخزينه (عبر S3 الموجود مسبقًا) غير مطبَّق بعد.
- **رفع/تنزيل ملف النسخة الاحتياطية الفعلي**: `backup.create` يسجّل مهمة نسخ احتياطي فقط — تنفيذ `mysqldump` فعلي وتخزين الناتج على S3 غير مطبَّق (Cloudflare Workers/serverless لا يدعم `child_process`، لكن هذا مشروع VPS/Node.js كامل فلا قيد تقني هنا، فقط لم يُبنَ المنطق الفعلي بعد).
- **`connectionMode: "agent"`**: وضع اتصال يتطلب وكيلًا محليًا (Local Agent) للراوترات غير القابلة للوصول المباشر — غير مطبَّق بعد.
- **بروتوكول MikroTik API-SSL الثنائي**: تم اختيار REST-HTTPS (RouterOS v7+) بدل البروتوكول الثنائي المعقّد (API-SSL على المنفذ 8729) لتبسيط التطبيق. الراوترات القديمة (v6 أو أقدم بدون REST) غير مدعومة حاليًا.
- **`radius_policy_projection`**: حاليًا no-op موثّق — الإسقاط الفعلي لسياسات الباقات (bandwidth/quota) إلى جدول radcheck/radreply منفصل غير مطبَّق؛ الاعتماد الحالي هو أن FreeRADIUS يقرأ مباشرة من `service_plans` عبر وحدة SQL الخاصة به.
- **تحليل حزم RADIUS UDP الخام**: غير مطبَّق في Node — يتطلب FreeRADIUS كوسيط (انظر أعلاه).
- **اختبارات الواجهة الأمامية**: لا توجد بنية اختبار للواجهة (`client/`) — التغطية الحالية للـ backend فقط.
- **قائمة مهام موزّعة حقيقية**: العامل الخلفي هو حلقة استقصاء (polling) بسيطة داخل نفس العملية، وليس نظام طابور موزّع (مثل BullMQ+Redis) — مناسب لمثيل VPS واحد فقط.

## الخطوات التالية الموصى بها
1. **مراجعة أمنية قبل الإنتاج**: تدوير `JWT_SECRET`/`SECRET_ENCRYPTION_KEY` لقيم إنتاجية فريدة (لا تُستخدم قيم `.env` التطويرية أبدًا في الإنتاج).
2. **إعداد FreeRADIUS فعليًا على VPS** وربطه بنقطة `/api/radius/accounting` (حاليًا مُختبَر فقط عبر استدعاءات HTTP مباشرة تُحاكي FreeRADIUS).
3. **اختبار ميداني مع راوتر MikroTik حقيقي** (REST مفعّل على RouterOS v7+) للتأكد من التوافق الكامل خارج بيئة الشبكة المعزولة للـ sandbox.
4. **إضافة مراقبة/تنبيهات** (مثل Sentry أو تنبيهات بريدية) لحالات فشل العامل الخلفي المتكررة.
5. **تفعيل migration 0002 (وكل ما قبلها) على قاعدة بيانات الإنتاج** قبل أول نشر (`npx drizzle-kit migrate` كما في قسم النشر أدناه). إذا كانت هناك بيانات إنتاجية قديمة قبل هذه النقطة، تحقق أولًا من عدم وجود تصادم NAS-Identifier بين مؤسسات مختلفة قبل تطبيق migration 0002 (القيد الفريد الجديد سيرفض التطبيق إن وُجد تصادم).
6. **تقوية سياسة كلمة المرور**: `isValidPassword` في `server/_core/auth.ts` يتحقق من الطول فقط (8-200 حرفًا) حاليًا — يُنصح بإضافة تعقيد (حروف كبيرة/صغيرة/أرقام) قبل الإنتاج.
7. **قفل الحساب بعد محاولات دخول فاشلة متكررة**: غير مطبَّق حاليًا — `auth.login` في `server/routers/auth.ts` لا يتتبع المحاولات الفاشلة. Rate limiting العام (20 محاولة/15 دقيقة لكل IP) يخفف المخاطر جزئيًا لكنه ليس بديلاً كاملاً عن قفل الحساب.
8. **دمج/توضيح `router_identity_read` مقابل `health_check`**: حاليًا alias حرفي في `server/worker/backgroundJobWorker.ts` — يستحق التوحيد أو توثيق الفرق المقصود إن وُجد.
9. **تنظيف دوري لجدول `background_jobs`**: لا يوجد حاليًا حذف/أرشفة للمهام المكتملة/الفاشلة نهائيًا — سينمو الجدول بلا حدود على مدى طويل.
10. **جدولة تلقائية دورية لفحص صحة الراوترات**: حاليًا فحوصات الصحة تُنشأ فقط يدويًا عبر `integrations.enqueueJob` — لا يوجد cron/scheduler يُنشئها تلقائيًا كل فترة.
11. **تحسين نظام السجلات (structured logging)**: لا يزال الاعتماد على `console.log`/`console.warn`/`console.error` الخام في جميع أنحاء المشروع؛ يُنصح بمكتبة تسجيل بنيوية (مثل pino) قبل الإنتاج على نطاق واسع.
12. **إضافة نقطة تحديث NAS-Identifier**: تم إضافة `updateTenantRouterNasIdentifier` في `server/db.ts` (يفرض نفس قيد التفرّد العالمي) لكنه غير مربوط بعد بأي إجراء tRPC في `server/routers/workspace.ts` — حاليًا NAS-Identifier يُحدَّد فقط عند إنشاء الراوتر.
13. **ربط مراقبة الخادم بإرسال Telegram فعلي**: أضف مهمة `monitor_alert_dispatch` في `server/worker/backgroundJobWorker.ts` تُنشئها مهمة مجدولة (أو تُستدعى عند كل `samples.record`) لمقارنة العيّنة بعتبات `monitor_settings` واستدعاء Telegram Bot API عند التجاوز.
14. **ربط بوابة SMS بمزوّد فعلي**: أضف معالج مهمة (`sms_dispatch`) يستدعي REST API لمزوّد SMS حقيقي بدلًا من ترك الرسائل بحالة `queued` فقط.
15. **توليد تصدير تقارير فعلي**: نفّذ توليد PDF/XLSX حقيقي في `reportBuilder.exports.generate` وخزّنه عبر S3 الموجود مسبقًا في المشروع.
16. **ربط نقاط الولاء بالفوترة تلقائيًا**: اربط `points.ledger.post` بحدث دفع فاتورة ناجح لمنح نقاط تلقائيًا دون تدخّل يدوي.

## النشر على VPS
### المتطلبات
- Node.js 20+، MySQL/MariaDB 8+، PM2 (أو Docker).

### الخطوات (PM2)
```bash
git clone <repo-url> netora && cd netora
cp .env.example .env   # عدّل القيم: DATABASE_URL, JWT_SECRET, SECRET_ENCRYPTION_KEY (openssl rand -hex 32), S3_*
npm install
npx drizzle-kit migrate   # يطبّق كل ملفات drizzle/*.sql على قاعدة بيانات الإنتاج المحددة في DATABASE_URL
npm run build
pm2 start ecosystem.config.cjs
pm2 save
```

### الخطوات (Docker)
```bash
docker build -t netora .
docker run -d --name netora -p 3000:3000 --env-file .env netora
```

> **ملاحظة**: العامل الخلفي (`startBackgroundJobWorker`) يعمل داخل نفس عملية السيرفر — لا حاجة لعملية PM2 منفصلة. عند التوسّع لأكثر من مثيل واحد، افصل العامل إلى عملية PM2 مستقلة لتفادي معالجة مزدوجة للمهام.

## البنية التقنية
- **Backend**: Hono~~/~~ ~~لا~~ — **ملاحظة**: هذا المشروع Express + tRPC v11 (وليس Hono/Cloudflare Workers)، لأنه يعتمد على Node.js runtime كامل (MySQL، bcrypt، عمليات خلفية طويلة الأمد) وهي غير متوافقة مع بيئة Cloudflare Workers المقيّدة. النشر المستهدف هو **VPS تقليدي عبر PM2/Docker**، وليس Cloudflare Pages.
- **Database**: MySQL/MariaDB + Drizzle ORM.
- **Auth**: bcrypt + JWT (jose).
- **Storage**: S3-compatible.
- **Frontend**: React + Vite (مبني كملفات ثابتة تُخدَّم من نفس سيرفر Express في الإنتاج).

## آخر تحديث
2026-08-28 — إكمال عميل MikroTik، العامل الخلفي، معالجة RADIUS، أدوات نشر VPS، ومجموعة اختبارات شاملة (56/56 ناجحة).

2026-08-28 (تحديث لاحق) — إصلاح عزل NAS-Identifier عبر المؤسسات (فريد على مستوى المنصة)، تجاوز TLS الذاتي لراوترات MikroTik عبر `undici`، تفعيل Helmet + Rate Limiting (auth/عام/RADIUS) + حدود body لكل مسار، تقسيم حزمة الواجهة الأمامية (506KB → ~352KB). 58/58 اختبار ناجح، tsc نظيف، build ناجح. **ملاحظة مهمة**: البنود التالية من مراجعة الكود لم تُنفَّذ بعد — راجع "الخطوات التالية الموصى بها": تعقيد كلمة المرور، قفل الحساب بعد محاولات فاشلة، توحيد router_identity_read/health_check، تنظيف دوري لـ background_jobs، جدولة تلقائية لفحوصات الصحة، تحسين السجلات البنيوية.

2026-08-29 — **إضافة 11 وحدة كاملة جديدة** لموازاة apluswifi.com/demo.apluswifi.com: المحاسبة، فئات/مجموعات البطاقات، استوديو تصميم البطاقات، الأدوار المخصّصة، مُنشئ التقارير، النسخ الاحتياطي، مراقبة الخادم (بنية تنبيهات Telegram)، النقاط والولاء، بوابة SMS، المسابقات، والدعم المباشر (Live Chat) — كل وحدة تتضمّن راوتر tRPC كامل + جدول/جداول Drizzle + لوحة React مربوطة بالكامل في `Home.tsx` (تنقّل من 3 إلى 8 مجموعات). تم إصلاح خلل نظامي كان يفتقد `organizationSlug` في مدخلات كل استدعاءات الـ11 لوحة الجديدة. أُضيفت migration واحدة (`0004_spotty_the_hand.sql`) لـ26+ جدولًا جديدًا (60 جدولًا إجماليًا بعد التطبيق). **إصلاح خلل حقيقي في طابور المهام الخلفية**: `claimNextJob()` في `server/worker/backgroundJobWorker.ts` كان يعتمد على ترتيب غير محدَّد لصفوف MySQL (لا `ORDER BY`)، مما يعني نظريًا أنه قد "يُجوِّع" (starve) أقدم مهمة مستحقة تحت الحمل — تمت إضافة ترتيب FIFO حقيقي (`ORDER BY createdAt, id`). كما أُضيف تنظيف استباقي (`drainQueue`) في `server/worker/backgroundJobWorker.test.ts` قبل كل اختبار لضمان نتائج حتمية على قاعدة البيانات المشتركة الحقيقية. **النتيجة النهائية**: `tsc --noEmit` نظيف تمامًا، `npm run build` ناجح (37 حزمة JS منفصلة تشمل الـ11 لوحة الجديدة)، ومجموعة الاختبارات الكاملة **14/14 ملف، 60/60 اختبار ناجح** (0 اختبارات فاشلة، مقارنة بـ5/60 فاشلة متقطّعة قبل الإصلاح).

### Running with Docker Compose (Local / Staging)
You can bring up the entire platform including the MariaDB database using Docker Compose:
```bash
docker-compose up --build
```
This sets up a containerized DB on port 3306 and the Netora application on port 3000. It also automatically applies schema migrations (`db:push`) on startup.

### CI/CD
Netora includes a standard GitHub Actions workflow (`.github/workflows/ci.yml`) that validates:
- Type checking (`npm run check`)
- Vite and esbuild production build (`npm run build`)
- Drizzle schema migrations against a live containerized MariaDB
- Comprehensive unit and integration testing via Vitest (`npm run test`)
