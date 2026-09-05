import { useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function Trial() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [orgName, setOrgName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const { data: user } = trpc.auth.me.useQuery();

  const registerMutation = trpc.auth.register.useMutation();
  const createTenantMutation = trpc.tenant.create.useMutation();

  const isPending = registerMutation.isPending || createTenantMutation.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const slug = orgName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    if (!orgName.trim() || slug.length < 3) {
      setFormError("اسم المؤسسة يجب أن يحتوي على أحرف كافية لتوليد معرّف صحيح");
      return;
    }

    try {
      let currentUserId = user?.id;

      if (!currentUserId) {
        if (!email.trim() || !password) {
          setFormError("البريد الإلكتروني وكلمة المرور مطلوبان لإنشاء الحساب");
          return;
        }
        if (password.length < 8) {
          setFormError("كلمة المرور يجب أن تكون 8 أحرف على الأقل");
          return;
        }

        const newUser = await registerMutation.mutateAsync({
          email: email.trim(),
          password,
          name: name.trim() || undefined,
        });
        utils.auth.me.setData(undefined, newUser);
        currentUserId = newUser.id;
      }

      await createTenantMutation.mutateAsync({
        name: orgName.trim(),
        slug,
        timezone: "Asia/Riyadh",
        currency: "SAR",
      });

      await utils.tenant.listMine.invalidate();
      toast.success("تم إنشاء المؤسسة بنجاح!");
      navigate("/dashboard");
    } catch (error) {
      if (error instanceof TRPCClientError) {
        setFormError(error.message);
      } else {
        setFormError("حدث خطأ غير متوقع أثناء المعالجة");
      }
    }
  };

  return (
    <div className="min-h-screen bg-blue-50 py-20 px-4" dir="rtl">
      <div className="max-w-2xl mx-auto bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
        <h1 className="text-3xl font-bold text-slate-900 mb-6 text-center">ابدأ تجربتك المجانية</h1>
        <p className="text-slate-600 mb-8 text-center">احصل على 14 يوماً من التجربة الكاملة لمنصة Netora بدون بطاقة ائتمان.</p>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium mb-1">اسم المؤسسة</label>
            <input
              type="text"
              className="w-full border rounded-lg p-2"
              placeholder="مثال: شبكة الأفق"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              required
            />
          </div>

          {!user && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">اسمك (اختياري)</label>
                <input
                  type="text"
                  className="w-full border rounded-lg p-2"
                  placeholder="الاسم الكامل"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">البريد الإلكتروني</label>
                <input
                  type="email"
                  dir="ltr"
                  className="w-full border rounded-lg p-2"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">كلمة المرور</label>
                <input
                  type="password"
                  dir="ltr"
                  className="w-full border rounded-lg p-2"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
            </>
          )}

          {formError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              {formError}
            </p>
          )}

          <button
            type="submit"
            className="w-full flex items-center justify-center bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            disabled={isPending}
          >
            {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : "إنشاء حسابي"}
          </button>
        </form>
        <div className="mt-8 text-center">
          <Link href="/" className="text-blue-600 hover:underline">العودة للرئيسية</Link>
        </div>
      </div>
    </div>
  );
}
