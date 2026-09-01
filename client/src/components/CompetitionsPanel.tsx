import { trpc } from "@/lib/trpc";
import { Plus, Trophy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

function Pill({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "success" | "warning" }) {
  const tones = { neutral: "bg-slate-100 text-slate-600", success: "bg-emerald-50 text-emerald-700", warning: "bg-amber-50 text-amber-700" };
  return <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${tones[tone]}`}>{label}</span>;
}

export function CompetitionsPanel({ organizationSlug }: { organizationSlug: string }) {
  const utils = trpc.useUtils();
  const [name, setName] = useState(""); const [selectedCompetitionId, setSelectedCompetitionId] = useState("");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("easy"); const [question, setQuestion] = useState(""); const [correctAnswer, setCorrectAnswer] = useState("");

  const competitionsQuery = trpc.competitions.list.useQuery({ organizationSlug, limit: 25, offset: 0 }, { enabled: Boolean(organizationSlug), retry: false });
  const questionsQuery = trpc.competitions.questions.list.useQuery({ organizationSlug, competitionId: Number(selectedCompetitionId) }, { enabled: Boolean(organizationSlug) && Boolean(selectedCompetitionId), retry: false });
  const createCompetition = trpc.competitions.create.useMutation({ onSuccess: async () => { setName(""); toast.success("تم إنشاء المسابقة كمسودة."); await utils.competitions.list.invalidate(); }, onError: e => toast.error(e.message) });
  const updateStatus = trpc.competitions.updateStatus.useMutation({ onSuccess: async () => { toast.success("تم تحديث حالة المسابقة."); await utils.competitions.list.invalidate(); }, onError: e => toast.error(e.message) });
  const createQuestion = trpc.competitions.questions.create.useMutation({ onSuccess: async () => { setQuestion(""); setCorrectAnswer(""); toast.success("تمت إضافة السؤال."); await utils.competitions.questions.list.invalidate(); }, onError: e => toast.error(e.message) });

  if (!organizationSlug) return <section className="rounded-2xl border border-dashed border-violet-200 bg-violet-50/60 p-5 text-xs text-slate-600">اختر مؤسسة أولًا لإدارة مسابقاتها.</section>;

  return <div className="space-y-5">
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(23,35,61,.035)]">
      <h2 className="text-sm font-bold text-slate-900"><Trophy className="ml-2 inline h-4 w-4 text-violet-600" />المسابقات</h2>
      <div className="mt-4 flex gap-2"><input value={name} onChange={e => setName(e.target.value)} placeholder="اسم المسابقة" className="h-9 flex-1 rounded-xl border border-slate-200 px-3 text-xs outline-none" /><button disabled={createCompetition.isPending} onClick={() => { if (!name.trim()) { toast.error("أدخل اسم المسابقة."); return; } createCompetition.mutate({ organizationSlug, name: name.trim() }); }} className="inline-flex h-9 items-center gap-1 rounded-xl bg-violet-600 px-3 text-xs font-bold text-white disabled:opacity-60"><Plus className="h-3.5 w-3.5" />إنشاء</button></div>
      <div className="mt-4 space-y-2">{competitionsQuery.data?.map(c => <div key={c.id} onClick={() => setSelectedCompetitionId(String(c.id))} className={`flex cursor-pointer items-center justify-between rounded-xl border px-3 py-2 text-xs ${String(c.id) === selectedCompetitionId ? "border-violet-300 bg-violet-50" : "border-slate-200"}`}><span className="font-bold text-slate-800">{c.name}</span><div className="flex items-center gap-2"><Pill label={c.status} tone={c.status === "active" ? "success" : c.status === "draft" ? "warning" : "neutral"} />{c.status === "draft" && <button onClick={e => { e.stopPropagation(); updateStatus.mutate({ organizationSlug, competitionId: c.id, status: "active" }); }} className="text-[11px] font-bold text-violet-600">تفعيل</button>}{c.status === "active" && <button onClick={e => { e.stopPropagation(); updateStatus.mutate({ organizationSlug, competitionId: c.id, status: "ended" }); }} className="text-[11px] font-bold text-slate-600">إنهاء</button>}</div></div>) ?? <p className="text-xs text-slate-400">لا توجد مسابقات بعد.</p>}</div>
    </section>

    {selectedCompetitionId && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(23,35,61,.035)]">
      <h3 className="text-sm font-bold text-slate-900">أسئلة المسابقة #{selectedCompetitionId}</h3>
      <div className="mt-3 grid gap-2 md:grid-cols-4"><select value={difficulty} onChange={e => setDifficulty(e.target.value as typeof difficulty)} className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-xs outline-none"><option value="easy">سهل</option><option value="medium">متوسط</option><option value="hard">صعب</option></select><input value={question} onChange={e => setQuestion(e.target.value)} placeholder="نص السؤال" className="h-9 rounded-xl border border-slate-200 px-3 text-xs outline-none" /><input value={correctAnswer} onChange={e => setCorrectAnswer(e.target.value)} placeholder="الإجابة الصحيحة" className="h-9 rounded-xl border border-slate-200 px-3 text-xs outline-none" /><button disabled={createQuestion.isPending} onClick={() => { if (!question.trim() || !correctAnswer.trim()) { toast.error("أدخل السؤال والإجابة."); return; } createQuestion.mutate({ organizationSlug, competitionId: Number(selectedCompetitionId), difficulty, question: question.trim(), correctAnswer: correctAnswer.trim() }); }} className="inline-flex h-9 items-center justify-center gap-1 rounded-xl bg-violet-600 text-xs font-bold text-white disabled:opacity-60"><Plus className="h-3.5 w-3.5" />إضافة</button></div>
      <ul className="mt-3 space-y-1 text-xs">{questionsQuery.data?.map(q => <li key={q.id} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2"><span className="text-slate-700">{q.question}</span><Pill label={q.difficulty} /></li>) ?? <li className="text-slate-400">لا توجد أسئلة بعد.</li>}</ul>
    </section>}
  </div>;
}
