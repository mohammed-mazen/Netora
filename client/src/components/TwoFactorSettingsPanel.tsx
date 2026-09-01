import { trpc } from "@/lib/trpc";
import { KeyRound, QrCode, RefreshCw, ShieldCheck, ShieldOff } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function TwoFactorSettingsPanel() {
  const utils = trpc.useUtils();
  const [setupCode, setSetupCode] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [setupPayload, setSetupPayload] = useState<{ secret: string; qrCodeDataUrl: string; recoveryCodes: string[] } | null>(null);
  const [freshRecoveryCodes, setFreshRecoveryCodes] = useState<string[] | null>(null);

  const statusQuery = trpc.auth.twoFactor.status.useQuery(undefined, { retry: false });
  const beginMutation = trpc.auth.twoFactor.begin.useMutation({
    onSuccess: payload => {
      setSetupPayload(payload);
      setFreshRecoveryCodes(null);
      setSetupCode("");
      toast.success("تم بدء إعداد التحقق بخطوتين.");
    },
    onError: error => toast.error(error.message),
  });
  const confirmMutation = trpc.auth.twoFactor.confirm.useMutation({
    onSuccess: async () => {
      toast.success("تم تفعيل التحقق بخطوتين.");
      setSetupCode("");
      await utils.auth.twoFactor.status.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const regenerateMutation = trpc.auth.twoFactor.regenerateRecoveryCodes.useMutation({
    onSuccess: async result => {
      setFreshRecoveryCodes(result.recoveryCodes);
      setCurrentPassword("");
      toast.success("تم إنشاء رموز استعادة جديدة.");
      await utils.auth.twoFactor.status.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const disableMutation = trpc.auth.twoFactor.disable.useMutation({
    onSuccess: async () => {
      setSetupPayload(null);
      setFreshRecoveryCodes(null);
      setCurrentPassword("");
      toast.success("تم تعطيل التحقق بخطوتين.");
      await utils.auth.twoFactor.status.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(23,35,61,.035)]">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-xs font-bold text-violet-600">أمان الحساب</p>
        <h2 className="mt-1 text-base font-bold text-slate-900"><ShieldCheck className="ml-2 inline h-4 w-4 text-violet-600" />التحقق بخطوتين</h2>
        <p className="mt-1 text-xs leading-6 text-slate-500">تفعيل TOTP مع QR ورموز استعادة أحادية الاستخدام، مع إبقاء الهوية البصرية الخاصة بـ Netora.</p>
      </div>
      <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${statusQuery.data?.enabled ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{statusQuery.data?.enabled ? "مفعّل" : "غير مفعّل"}</span>
    </div>

    <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_1fr]">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-slate-800">بدء التهيئة</p>
            <p className="mt-1 text-[11px] leading-5 text-slate-500">يتم إنشاء سر جديد وQR ورموز استعادة جديدة، ثم تأكيد أول رمز من تطبيق المصادقة.</p>
          </div>
          <button disabled={beginMutation.isPending} onClick={() => beginMutation.mutate()} className="inline-flex h-10 items-center gap-2 rounded-xl bg-violet-600 px-4 text-xs font-bold text-white disabled:opacity-60"><QrCode className="h-3.5 w-3.5" />{beginMutation.isPending ? "جارٍ البدء…" : "بدء الإعداد"}</button>
        </div>

        {setupPayload && <div className="mt-4 space-y-4">
          <div className="rounded-2xl border border-violet-200 bg-white p-4">
            <p className="text-xs font-bold text-slate-800">المفتاح السري</p>
            <p dir="ltr" className="mt-2 break-all rounded-xl bg-slate-50 px-3 py-2 font-mono text-[11px] text-slate-700">{setupPayload.secret}</p>
          </div>
          <div className="rounded-2xl border border-violet-200 bg-white p-4">
            <p className="text-xs font-bold text-slate-800">QR Code</p>
            <img src={setupPayload.qrCodeDataUrl} alt="Two-factor QR" className="mt-3 h-44 w-44 rounded-xl border border-slate-200 bg-white p-2" />
          </div>
          <div className="rounded-2xl border border-violet-200 bg-white p-4">
            <p className="text-xs font-bold text-slate-800">رموز الاستعادة</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">{setupPayload.recoveryCodes.map(code => <p key={code} dir="ltr" className="rounded-xl bg-slate-50 px-3 py-2 font-mono text-[11px] text-slate-700">{code}</p>)}</div>
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <input value={setupCode} onChange={event => setSetupCode(event.target.value)} dir="ltr" placeholder="123456" className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-left text-xs outline-none" />
            <button disabled={confirmMutation.isPending} onClick={() => { if (!setupCode.trim()) { toast.error("أدخل رمز التطبيق أولًا."); return; } confirmMutation.mutate({ code: setupCode.trim() }); }} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 disabled:opacity-60"><KeyRound className="h-3.5 w-3.5" />تأكيد التفعيل</button>
          </div>
        </div>}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-bold text-slate-800">إدارة الحماية</p>
        <p className="mt-1 text-[11px] leading-5 text-slate-500">لإعادة إنشاء رموز الاستعادة أو تعطيل الميزة، أدخل كلمة المرور الحالية.</p>
        <input value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} type="password" dir="ltr" placeholder="كلمة المرور الحالية" className="mt-4 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-left text-xs outline-none" />
        <div className="mt-3 flex flex-wrap gap-2">
          <button disabled={regenerateMutation.isPending} onClick={() => { if (!currentPassword) { toast.error("أدخل كلمة المرور الحالية."); return; } regenerateMutation.mutate({ currentPassword }); }} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 disabled:opacity-60"><RefreshCw className="h-3.5 w-3.5" />رموز جديدة</button>
          <button disabled={disableMutation.isPending || !statusQuery.data?.enabled} onClick={() => { if (!currentPassword) { toast.error("أدخل كلمة المرور الحالية."); return; } disableMutation.mutate({ currentPassword }); }} className="inline-flex h-10 items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 text-xs font-bold text-rose-700 disabled:opacity-60"><ShieldOff className="h-3.5 w-3.5" />تعطيل</button>
        </div>
        {freshRecoveryCodes && <div className="mt-4 rounded-2xl border border-emerald-200 bg-white p-4">
          <p className="text-xs font-bold text-slate-800">رموز الاستعادة الجديدة</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">{freshRecoveryCodes.map(code => <p key={code} dir="ltr" className="rounded-xl bg-slate-50 px-3 py-2 font-mono text-[11px] text-slate-700">{code}</p>)}</div>
        </div>}
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-600">
          <p>الحالة الحالية: {statusQuery.data?.enabled ? "الحماية فعّالة" : "الحماية غير مفعلة"}</p>
          <p className="mt-2">آخر تأكيد: {statusQuery.data?.confirmedAt ? new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short" }).format(statusQuery.data.confirmedAt) : "—"}</p>
        </div>
      </div>
    </div>
  </section>;
}
