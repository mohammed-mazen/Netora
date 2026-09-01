import { trpc } from "@/lib/trpc";
import { Eye, MessageSquareText, Plus, WandSparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export function SmsTemplatesPanel({ organizationSlug }: { organizationSlug: string }) {
  const utils = trpc.useUtils();
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templateKey, setTemplateKey] = useState("payment_reminder");
  const [name, setName] = useState("تذكير دفع");
  const [namespace, setNamespace] = useState<"direct" | "scheduled" | "custom">("scheduled");
  const [body, setBody] = useState("مرحبًا {{customerName}}، لديك رصيد مستحق {{amount}}.");
  const [variablesText, setVariablesText] = useState('{"customerName":"أحمد","amount":"25.00"}');
  const [previewText, setPreviewText] = useState("");

  const templatesQuery = trpc.sms.templates.list.useQuery({ organizationSlug }, { enabled: Boolean(organizationSlug), retry: false });
  const saveMutation = trpc.sms.templates.save.useMutation({
    onSuccess: async result => {
      setSelectedTemplateId(String(result.id));
      toast.success("تم حفظ قالب الرسالة.");
      await utils.sms.templates.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const previewMutation = trpc.sms.templates.preview.useMutation({
    onSuccess: result => setPreviewText(result.body),
    onError: error => toast.error(error.message),
  });

  const selectedTemplate = useMemo(() => (templatesQuery.data ?? []).find(template => String(template.id) === selectedTemplateId) ?? null, [templatesQuery.data, selectedTemplateId]);

  if (!organizationSlug) return <section className="rounded-2xl border border-dashed border-violet-200 bg-violet-50/60 p-5 text-xs text-slate-600">اختر مؤسسة أولًا لإدارة قوالب الرسائل النصية.</section>;

  return <div className="grid gap-5 xl:grid-cols-[.95fr_1.05fr]">
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(23,35,61,.035)]"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-sm font-bold text-slate-900"><MessageSquareText className="ml-2 inline h-4 w-4 text-violet-600" />قوالب الرسائل النصية</h2><p className="mt-1 text-xs leading-6 text-slate-500">أنشئ قوالب قابلة لإعادة الاستخدام للتذكيرات والإرسال المجدول والسيناريوهات المخصصة.</p></div><select value={selectedTemplateId} onChange={event => { const nextId = event.target.value; setSelectedTemplateId(nextId); const found = (templatesQuery.data ?? []).find(template => String(template.id) === nextId); if (found) { setTemplateKey(found.key); setName(found.name); setNamespace(found.namespace); setBody(found.body); } }} className="h-10 min-w-[220px] rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none"><option value="">قالب جديد</option>{(templatesQuery.data ?? []).map(template => <option key={template.id} value={String(template.id)}>{template.name}</option>)}</select></div><div className="mt-4 grid gap-3 md:grid-cols-2"><input value={templateKey} onChange={event => setTemplateKey(event.target.value)} dir="ltr" placeholder="template key" className="h-10 rounded-xl border border-slate-200 px-3 text-left text-xs outline-none" /><input value={name} onChange={event => setName(event.target.value)} placeholder="اسم القالب" className="h-10 rounded-xl border border-slate-200 px-3 text-xs outline-none" /><select value={namespace} onChange={event => setNamespace(event.target.value as typeof namespace)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none md:col-span-2"><option value="direct">direct</option><option value="scheduled">scheduled</option><option value="custom">custom</option></select><textarea value={body} onChange={event => setBody(event.target.value)} rows={7} className="rounded-2xl border border-slate-200 px-3 py-3 text-xs outline-none md:col-span-2" dir="ltr" placeholder="اكتب نص القالب هنا..." /></div><div className="mt-4 flex flex-wrap gap-2"><button disabled={saveMutation.isPending} onClick={() => { if (!templateKey.trim() || !name.trim() || !body.trim()) { toast.error("أكمل بيانات القالب أولًا."); return; } saveMutation.mutate({ organizationSlug, templateId: selectedTemplateId ? Number(selectedTemplateId) : null, key: templateKey.trim(), name: name.trim(), namespace, body: body.trim() }); }} className="inline-flex h-10 items-center gap-2 rounded-xl bg-violet-600 px-4 text-xs font-bold text-white disabled:opacity-60"><Plus className="h-3.5 w-3.5" />حفظ القالب</button><span className="rounded-full bg-slate-100 px-3 py-2 text-[11px] font-semibold text-slate-600">{selectedTemplate?.isSystem ? "قالب نظامي" : "قالب مخصص"}</span></div></section>
    <section className="space-y-5"><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(23,35,61,.035)]"><h3 className="text-sm font-bold text-slate-900"><Eye className="ml-2 inline h-4 w-4 text-violet-600" />معاينة القالب</h3><textarea value={variablesText} onChange={event => setVariablesText(event.target.value)} rows={5} className="mt-4 w-full rounded-2xl border border-slate-200 px-3 py-3 text-left text-xs outline-none" dir="ltr" placeholder='{"customerName":"أحمد"}' /><button disabled={!selectedTemplateId || previewMutation.isPending} onClick={() => { if (!selectedTemplateId) { toast.error("احفظ القالب أو اختر قالبًا أولًا."); return; } try { previewMutation.mutate({ organizationSlug, templateId: Number(selectedTemplateId), variables: JSON.parse(variablesText) }); } catch { toast.error("JSON غير صالح."); } }} className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-bold text-slate-700 disabled:opacity-60"><WandSparkles className="h-3.5 w-3.5" />معاينة</button><div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-7 text-slate-700">{previewText || "ستظهر المعاينة هنا بعد اختيار قالب وحفظه ثم تمرير متغيرات الاختبار."}</div></div><div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(23,35,61,.035)]"><div className="border-b border-slate-100 px-5 py-4"><h3 className="text-sm font-bold text-slate-900">القوالب المحفوظة</h3></div><div className="divide-y divide-slate-100">{(templatesQuery.data ?? []).map(template => <button key={template.id} onClick={() => { setSelectedTemplateId(String(template.id)); setTemplateKey(template.key); setName(template.name); setNamespace(template.namespace); setBody(template.body); }} className="block w-full px-5 py-4 text-right transition hover:bg-slate-50"><p className="text-xs font-bold text-slate-800">{template.name}</p><p dir="ltr" className="mt-1 text-[11px] text-slate-500">{template.key} · {template.namespace}</p></button>)}{!templatesQuery.data?.length && <div className="px-5 py-10 text-center text-xs text-slate-400">لا توجد قوالب بعد.</div>}</div></div></section>
  </div>;
}
