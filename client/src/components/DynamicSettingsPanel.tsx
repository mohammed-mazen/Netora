import { trpc } from "@/lib/trpc";
import { Plus, Save, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type SettingDraft = {
  key: string;
  label: string;
  fieldType: "select" | "text" | "checkbox" | "time" | "textarea" | "number";
  expectedValuesText: string;
  value: string;
  notice: string;
};

export function DynamicSettingsPanel({ organizationSlug }: { organizationSlug: string }) {
  const utils = trpc.useUtils();
  const [moduleName, setModuleName] = useState("hotspot");
  const [items, setItems] = useState<SettingDraft[]>([]);

  const listQuery = trpc.dynamicSettings.list.useQuery({ organizationSlug, module: moduleName }, { enabled: Boolean(organizationSlug) && Boolean(moduleName), retry: false });
  const saveMutation = trpc.dynamicSettings.save.useMutation({ onSuccess: async () => { toast.success("تم حفظ الإعدادات الديناميكية."); await utils.dynamicSettings.list.invalidate(); }, onError: error => toast.error(error.message) });

  useEffect(() => {
    setItems((listQuery.data ?? []).map(item => ({ key: item.key, label: item.label, fieldType: item.fieldType, expectedValuesText: item.expectedValues.join(", "), value: item.value || "", notice: item.notice || "" })));
  }, [listQuery.data]);

  function updateItem(index: number, next: Partial<SettingDraft>) {
    setItems(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...next } : item));
  }

  if (!organizationSlug) return <section className="rounded-2xl border border-dashed border-violet-200 bg-violet-50/60 p-5 text-xs text-slate-600">اختر مؤسسة أولًا لإدارة المحرك الديناميكي للإعدادات.</section>;

  return <div className="space-y-5">
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(23,35,61,.035)]">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-sm font-bold text-slate-900"><SlidersHorizontal className="ml-2 inline h-4 w-4 text-violet-600" />محرك الإعدادات الديناميكي</h2><p className="mt-1 text-xs leading-6 text-slate-500">عرّف حقول الإعدادات لأي وحدة تشغيلية مع قيم متوقعة وملاحظات وقيمة حالية.</p></div><input value={moduleName} onChange={event => setModuleName(event.target.value)} dir="ltr" placeholder="module name" className="h-10 min-w-[240px] rounded-xl border border-slate-200 px-3 text-left text-xs outline-none" /></div>
      <div className="mt-4 flex flex-wrap gap-2"><button onClick={() => setItems(current => [...current, { key: `field_${current.length + 1}`, label: "حقل جديد", fieldType: "text", expectedValuesText: "", value: "", notice: "" }])} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-bold text-slate-700"><Plus className="h-3.5 w-3.5" />إضافة حقل</button><button disabled={saveMutation.isPending} onClick={() => { const prepared = items.filter(item => item.key.trim() && item.label.trim()).map((item, index) => ({ key: item.key.trim(), label: item.label.trim(), fieldType: item.fieldType, expectedValues: item.expectedValuesText.split(",").map(part => part.trim()).filter(Boolean), value: item.value || null, notice: item.notice || null, sortOrder: index + 1 })); if (!moduleName.trim()) { toast.error("أدخل اسم الوحدة أولًا."); return; } if (!prepared.length) { toast.error("أضف حقلًا واحدًا على الأقل."); return; } saveMutation.mutate({ organizationSlug, module: moduleName.trim(), items: prepared }); }} className="inline-flex h-10 items-center gap-2 rounded-xl bg-violet-600 px-4 text-xs font-bold text-white disabled:opacity-60"><Save className="h-3.5 w-3.5" />حفظ الكل</button></div>
    </section>

    <section className="space-y-3">{items.map((item, index) => <div key={`${item.key}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_30px_rgba(23,35,61,.035)]"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5"><input value={item.key} onChange={event => updateItem(index, { key: event.target.value })} dir="ltr" placeholder="key" className="h-10 rounded-xl border border-slate-200 px-3 text-left text-xs outline-none" /><input value={item.label} onChange={event => updateItem(index, { label: event.target.value })} placeholder="التسمية" className="h-10 rounded-xl border border-slate-200 px-3 text-xs outline-none" /><select value={item.fieldType} onChange={event => updateItem(index, { fieldType: event.target.value as SettingDraft["fieldType"] })} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none"><option value="text">text</option><option value="textarea">textarea</option><option value="checkbox">checkbox</option><option value="number">number</option><option value="time">time</option><option value="select">select</option></select><input value={item.expectedValuesText} onChange={event => updateItem(index, { expectedValuesText: event.target.value })} dir="ltr" placeholder="expected values" className="h-10 rounded-xl border border-slate-200 px-3 text-left text-xs outline-none" /><input value={item.value} onChange={event => updateItem(index, { value: event.target.value })} placeholder="القيمة الحالية" className="h-10 rounded-xl border border-slate-200 px-3 text-xs outline-none" /><textarea value={item.notice} onChange={event => updateItem(index, { notice: event.target.value })} rows={3} placeholder="ملاحظة الحقل" className="rounded-2xl border border-slate-200 px-3 py-3 text-xs outline-none md:col-span-2 xl:col-span-5" /></div></div>)}{!items.length && <section className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-xs text-slate-400">لا توجد عناصر إعدادات لهذه الوحدة بعد.</section>}</section>
  </div>;
}
