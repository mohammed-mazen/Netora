import { trpc } from "@/lib/trpc";
import { FileUp } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

export function CustomerImportPanel({ organizationSlug }: { organizationSlug: string }) {
  const inputRef = useRef<HTMLInputElement>(null); const utils = trpc.useUtils(); const [isReading, setIsReading] = useState(false);
  const importCsv = trpc.workspace.customers.importCsv.useMutation({ onSuccess: async result => { toast.success(`اكتمل الاستيراد: ${result.created} مضاف، ${result.rejected} مرفوض.`); await utils.workspace.customers.list.invalidate(); }, onError: error => toast.error(error.message) });
  const selectFile = async (event: React.ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; event.target.value = ""; if (!file) return; if (file.size > 1_000_000 || !file.name.toLowerCase().endsWith(".csv")) { toast.error("اختر ملف CSV بحجم لا يتجاوز 1 ميغابايت."); return; } try { setIsReading(true); importCsv.mutate({ organizationSlug, content: await file.text() }); } catch { toast.error("تعذر قراءة ملف CSV."); } finally { setIsReading(false); } };
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(23,35,61,.035)]"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold text-violet-600">استيراد محدود</p><h2 className="mt-1 text-sm font-bold text-slate-900">إضافة عملاء من CSV</h2><p className="mt-1 text-xs leading-6 text-slate-500">الرأسان الإلزاميان: <span dir="ltr" className="font-mono">full_name,username</span>. يرفض النظام الصفوف غير الصالحة أو المكررة داخل المؤسسة.</p></div><button disabled={isReading || importCsv.isPending} onClick={() => inputRef.current?.click()} className="inline-flex h-9 items-center gap-2 rounded-xl border border-violet-100 bg-violet-50 px-3 text-xs font-bold text-violet-700 disabled:opacity-60"><FileUp className="h-4 w-4" />{isReading || importCsv.isPending ? "جارٍ الاستيراد…" : "اختيار CSV"}</button><input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={selectFile} /></div></section>;
}
