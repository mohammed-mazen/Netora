import { useState } from "react";
import { useLocation } from "wouter";
import { TRPCClientError } from "@trpc/client";
import { Loader2, LogIn, UserPlus } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Mode = "login" | "register";

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof TRPCClientError) return error.message || fallback;
  return fallback;
}

export default function Login() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const [twoFactorChallenge, setTwoFactorChallenge] = useState<string | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState("");

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async result => {
      if (result.requiresTwoFactor) {
        setTwoFactorChallenge(result.challengeToken);
        return;
      }
      utils.auth.me.setData(undefined, result.user);
      await utils.auth.me.invalidate();
      navigate("/");
    },
    onError: error => setFormError(extractErrorMessage(error, "تعذر تسجيل الدخول، تحقق من البريد وكلمة المرور")),
  });

  const verifyTwoFactorMutation = trpc.auth.verifyTwoFactor.useMutation({
    onSuccess: async user => {
      utils.auth.me.setData(undefined, user);
      await utils.auth.me.invalidate();
      navigate("/");
    },
    onError: error => setFormError(extractErrorMessage(error, "رمز التحقق غير صحيح")),
  });

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: async user => {
      utils.auth.me.setData(undefined, user);
      await utils.auth.me.invalidate();
      navigate("/");
    },
    onError: error => setFormError(extractErrorMessage(error, "تعذر إنشاء الحساب الآن")),
  });

  const isPending = loginMutation.isPending || registerMutation.isPending;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    if (!email.trim() || !password) {
      setFormError("البريد الإلكتروني وكلمة المرور مطلوبان");
      return;
    }
    if (password.length < 8) {
      setFormError("كلمة المرور يجب أن تكون 8 أحرف على الأقل");
      return;
    }

    if (mode === "login") {
      loginMutation.mutate({ email: email.trim(), password });
    } else {
      registerMutation.mutate({ email: email.trim(), password, name: name.trim() || undefined });
    }
  };

  if (twoFactorChallenge) {
    return (
      <main dir="rtl" className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-slate-900">التحقق بخطوتين</CardTitle>
            <CardDescription>أدخل رمز التطبيق (Google Authenticator) أو أحد رموز الاستعادة</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              id="two-factor-form"
              className="space-y-4"
              onSubmit={event => {
                event.preventDefault();
                setFormError(null);
                verifyTwoFactorMutation.mutate({ challengeToken: twoFactorChallenge, code: twoFactorCode.trim() });
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="two-factor-code-input">رمز التحقق</Label>
                <Input
                  id="two-factor-code-input"
                  dir="ltr"
                  value={twoFactorCode}
                  onChange={e => setTwoFactorCode(e.target.value)}
                  placeholder="123456 أو XXXXX-XXXXX"
                  autoComplete="one-time-code"
                  autoFocus
                  required
                />
              </div>
              {formError && (
                <p id="two-factor-form-error" className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                  {formError}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={verifyTwoFactorMutation.isPending}>
                {verifyTwoFactorMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                تأكيد
              </Button>
              <button
                type="button"
                id="two-factor-cancel"
                onClick={() => { setTwoFactorChallenge(null); setTwoFactorCode(""); setFormError(null); }}
                className="w-full text-center text-xs font-semibold text-slate-500 hover:underline"
              >
                رجوع لتسجيل الدخول
              </button>
            </form>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main dir="rtl" className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-slate-900">Netora</CardTitle>
          <CardDescription>
            {mode === "login" ? "سجّل الدخول للوصول إلى مساحة عمل مؤسستك" : "أنشئ حسابًا جديدًا للبدء في استخدام Netora"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4" id="auth-form">
            {mode === "register" && (
              <div className="space-y-2">
                <Label htmlFor="name-input">الاسم (اختياري)</Label>
                <Input id="name-input" value={name} onChange={e => setName(e.target.value)} placeholder="اسمك الكامل" autoComplete="name" />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email-input">البريد الإلكتروني</Label>
              <Input
                id="email-input"
                type="email"
                dir="ltr"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="name@company.com"
                autoComplete="email"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password-input">كلمة المرور</Label>
              <Input
                id="password-input"
                type="password"
                dir="ltr"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
                minLength={8}
              />
            </div>

            {formError && (
              <p id="auth-form-error" className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                {formError}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : mode === "login" ? (
                <LogIn className="h-4 w-4" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              {mode === "login" ? "تسجيل الدخول" : "إنشاء حساب"}
            </Button>
          </form>

          <button
            type="button"
            id="auth-mode-toggle"
            onClick={() => {
              setFormError(null);
              setMode(mode === "login" ? "register" : "login");
            }}
            className="mt-4 w-full text-center text-xs font-semibold text-violet-700 hover:underline"
          >
            {mode === "login" ? "ليس لديك حساب؟ أنشئ واحدًا" : "لديك حساب بالفعل؟ سجّل الدخول"}
          </button>
        </CardContent>
      </Card>
    </main>
  );
}
