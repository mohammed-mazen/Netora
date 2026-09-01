import { trpc } from "@/lib/trpc";
import { Palette, Plus, Trash2, Wifi } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export function HotspotLoginBuilderPanel({ organizationSlug }: { organizationSlug: string }) {
  const utils = trpc.useUtils();
  const [selectedPageId, setSelectedPageId] = useState("");
  const [name, setName] = useState("");
  const [logoImageKey, setLogoImageKey] = useState("");
  const [backgroundImageKey, setBackgroundImageKey] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#6d28d9");
  const [welcomeTitle, setWelcomeTitle] = useState("");
  const [welcomeBody, setWelcomeBody] = useState("");
  const [termsText, setTermsText] = useState("");
  const [voucherGroupScope, setVoucherGroupScope] = useState("");
  const [isDefault, setIsDefault] = useState(true);

  const pagesQuery = trpc.hotspotPages.list.useQuery({ organizationSlug }, { enabled: Boolean(organizationSlug), retry: false });
  const saveMutation = trpc.hotspotPages.save.useMutation({
    onSuccess: async result => {
      setSelectedPageId(String(result.id));
      toast.success("تم حفظ صفحة الدخول.");
      await utils.hotspotPages.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const deleteMutation = trpc.hotspotPages.delete.useMutation({
    onSuccess: async () => {
      setSelectedPageId("");
      setName("");
      setLogoImageKey("");
      setBackgroundImageKey("");
      setWelcomeTitle("");
      setWelcomeBody("");
      setTermsText("");
      setVoucherGroupScope("");
      setIsDefault(false);
      toast.success("تم حذف الصفحة.");
      await utils.hotspotPages.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const selectedPage = useMemo(() => (pagesQuery.data ?? []).find(page => String(page.id) === selectedPageId) ?? null, [pagesQuery.data, selectedPageId]);

  useEffect(() => {
    if (!selectedPage) return;
    setName(selectedPage.name);
    setLogoImageKey(selectedPage.logoImageKey || "");
    setBackgroundImageKey(selectedPage.backgroundImageKey || "");
    setPrimaryColor(selectedPage.primaryColor || "#6d28d9");
    setWelcomeTitle(selectedPage.welcomeTitle || "");
    setWelcomeBody(selectedPage.welcomeBody || "");
    setTermsText(selectedPage.termsText || "");
    setVoucherGroupScope(selectedPage.voucherGroupScope.join(", "));
    setIsDefault(Boolean(selectedPage.isDefault));
  }, [selectedPage]);

  if (!organizationSlug) return <section className="rounded-2xl border border-dashed border-violet-200 bg-violet-50/60 p-5 text-xs text-slate-600">اختر مؤسسة أولًا لإدارة صفحات دخول الهوت سبوت.</section>;

  return <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(23,35,61,.035)]">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-sm font-bold text-slate-900"><Wifi className="ml-2 inline h-4 w-4 text-violet-600" />منشئ صفحة دخول الهوت سبوت</h2><p className="mt-1 text-xs leading-6 text-slate-500">ابنِ صفحة دخول بعناصر هوية ورسائل ترحيب وشروط ونطاق مجموعات بطاقات.</p></div><select value={selectedPageId} onChange={event => setSelectedPageId(event.target.value)} className="h-10 min-w-[220px] rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none"><option value="">صفحة جديدة</option>{(pagesQuery.data ?? []).map(page => <option key={page.id} value={String(page.id)}>{page.name}</option>)}</select></div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <input value={name} onChange={event => setName(event.target.value)} placeholder="اسم الصفحة" className="h-10 rounded-xl border border-slate-200 px-3 text-xs outline-none" />
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 px-3"><input id="hotspot-default" checked={isDefault} onChange={event => setIsDefault(event.target.checked)} type="checkbox" className="h-4 w-4" /><label htmlFor="hotspot-default" className="text-xs font-medium text-slate-700">صفحة افتراضية</label></div>
        <input value={logoImageKey} onChange={event => setLogoImageKey(event.target.value)} placeholder="مفتاح شعار التخزين" className="h-10 rounded-xl border border-slate-200 px-3 text-xs outline-none" />
        <input value={backgroundImageKey} onChange={event => setBackgroundImageKey(event.target.value)} placeholder="مفتاح الخلفية" className="h-10 rounded-xl border border-slate-200 px-3 text-xs outline-none" />
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 px-3"><input value={primaryColor} onChange={event => setPrimaryColor(event.target.value)} type="color" className="h-8 w-10 rounded border border-slate-200" /><input value={primaryColor} onChange={event => setPrimaryColor(event.target.value)} dir="ltr" className="h-10 flex-1 border-0 bg-transparent px-0 text-left text-xs outline-none" /></div>
        <input value={voucherGroupScope} onChange={event => setVoucherGroupScope(event.target.value)} dir="ltr" placeholder="IDs مجموعات البطاقات مفصولة بفواصل" className="h-10 rounded-xl border border-slate-200 px-3 text-left text-xs outline-none" />
        <input value={welcomeTitle} onChange={event => setWelcomeTitle(event.target.value)} placeholder="عنوان الترحيب" className="h-10 rounded-xl border border-slate-200 px-3 text-xs outline-none md:col-span-2" />
        <textarea value={welcomeBody} onChange={event => setWelcomeBody(event.target.value)} placeholder="نص الترحيب" rows={4} className="rounded-2xl border border-slate-200 px-3 py-3 text-xs outline-none md:col-span-2" />
        <textarea value={termsText} onChange={event => setTermsText(event.target.value)} placeholder="الشروط والأحكام" rows={4} className="rounded-2xl border border-slate-200 px-3 py-3 text-xs outline-none md:col-span-2" />
      </div>
      <div className="mt-4 flex flex-wrap gap-2"><button disabled={saveMutation.isPending} onClick={() => { if (!name.trim()) { toast.error("أدخل اسم الصفحة."); return; } saveMutation.mutate({ organizationSlug, pageId: selectedPageId ? Number(selectedPageId) : null, name: name.trim(), isDefault, logoImageKey: logoImageKey.trim() || null, backgroundImageKey: backgroundImageKey.trim() || null, primaryColor: primaryColor.trim() || null, welcomeTitle: welcomeTitle.trim() || null, welcomeBody: welcomeBody.trim() || null, termsText: termsText.trim() || null, voucherGroupScope: voucherGroupScope.split(",").map(part => Number(part.trim())).filter(value => Number.isFinite(value) && value > 0) }); }} className="inline-flex h-10 items-center gap-2 rounded-xl bg-violet-600 px-4 text-xs font-bold text-white disabled:opacity-60"><Plus className="h-3.5 w-3.5" />حفظ الصفحة</button>{selectedPageId && <button disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate({ organizationSlug, pageId: Number(selectedPageId) })} className="inline-flex h-10 items-center gap-2 rounded-xl border border-rose-200 px-4 text-xs font-bold text-rose-700"><Trash2 className="h-3.5 w-3.5" />حذف الصفحة</button>}</div>
    </section>

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(23,35,61,.035)]">
      <div className="border-b border-slate-100 px-5 py-4"><h3 className="text-sm font-bold text-slate-900"><Palette className="ml-2 inline h-4 w-4 text-violet-600" />معاينة أولية</h3></div>
      <div className="p-5"><div className="overflow-hidden rounded-[28px] border border-slate-200"><div className="p-6 text-white" style={{ background: `linear-gradient(135deg, ${primaryColor || "#6d28d9"}, #0f172a)` }}><p className="text-[11px] font-semibold opacity-80">{logoImageKey || "شعار المؤسسة"}</p><h3 className="mt-3 text-xl font-bold">{welcomeTitle || "مرحبًا بك في شبكة Netora"}</h3><p className="mt-3 text-sm leading-7 opacity-90">{welcomeBody || "استخدم بيانات الاشتراك أو كرت الفاوتشر للاتصال بالإنترنت بسرعة وأمان."}</p><div className="mt-5 rounded-2xl bg-white/10 p-3 text-xs leading-6">{termsText || "بمتابعة الاتصال فأنت توافق على سياسة الاستخدام العادل والخصوصية الخاصة بالمؤسسة."}</div></div><div className="space-y-3 bg-slate-50 px-6 py-5"><input placeholder="اسم المستخدم أو رقم البطاقة" className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none" /><input placeholder="كلمة المرور" type="password" className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none" /><button className="h-10 w-full rounded-xl text-xs font-bold text-white" style={{ backgroundColor: primaryColor || "#6d28d9" }}>تسجيل الدخول</button><p className="text-[11px] text-slate-500">نطاق المجموعات: {voucherGroupScope || "كل المجموعات"}</p><p className="text-[11px] text-slate-400">الخلفية: {backgroundImageKey || "افتراضية"}</p></div></div></div>
    </section>
  </div>;
}
