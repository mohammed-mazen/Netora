import { trpc } from "@/lib/trpc";
import { Download, FileArchive, RotateCcw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function BackupPanel({ organizationSlug }: { organizationSlug: string }) {
  const utils = trpc.useUtils();
  const [method, setMethod] = useState<"json" | "mysqldump">("json");

  const jobsQuery = trpc.backup.list.useQuery(
    { organizationSlug, limit: 25, offset: 0 },
    { enabled: Boolean(organizationSlug), retry: false },
  );

  const createJob = trpc.backup.create.useMutation({
    onSuccess: async () => {
      toast.success("تم إنشاء نسخة احتياطية جديدة.");
      await utils.backup.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const restoreJob = trpc.backup.restore.useMutation({
    onSuccess: async () => {
      toast.success("تمت استعادة النسخة الاحتياطية.");
      await utils.backup.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  if (!organizationSlug) {
    return (
      <section className="rounded-2xl border border-dashed border-violet-200 bg-violet-50/60 p-5 text-xs text-slate-600">
        اختر مؤسسة أولًا لإدارة نسخها الاحتياطية.
      </section>
    );
  }

  const jobs = jobsQuery.data ?? [];

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(23,35,61,.035)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900">
            <FileArchive className="ml-2 inline h-4 w-4 text-violet-600" />
            النسخ الاحتياطية
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            لقطة JSON معزولة لبيانات المؤسسة، مع دعم الاستعادة.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={method}
            onChange={(event) => setMethod(event.target.value as "json" | "mysqldump")}
            className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-xs outline-none"
          >
            <option value="json">لقطة JSON</option>
            <option value="mysqldump">تفريغ SQL كامل</option>
          </select>
          <button
            disabled={createJob.isPending}
            onClick={() => createJob.mutate({ organizationSlug, method })}
            className="inline-flex h-9 items-center gap-2 rounded-xl bg-violet-600 px-4 text-xs font-bold text-white disabled:opacity-60"
          >
            <Download className="h-3.5 w-3.5" />
            {createJob.isPending ? "جارٍ الإنشاء…" : "نسخة جديدة"}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[760px] w-full text-right text-xs">
          <thead className="bg-slate-50 text-[11px] text-slate-500">
            <tr>
              <th className="px-5 py-2">الحالة</th>
              <th>الحجم</th>
              <th>الملف</th>
              <th>التاريخ</th>
              <th className="px-5">إجراء</th>
            </tr>
          </thead>
          <tbody>
            {jobs.length ? (
              jobs.map((job) => (
                <tr key={job.id} className="border-t border-slate-100">
                  <td className="px-5 py-2 font-bold text-slate-800">{job.status}</td>
                  <td className="text-slate-500">
                    {job.sizeBytes ? `${(job.sizeBytes / 1024).toFixed(1)} KB` : "—"}
                  </td>
                  <td className="text-slate-500">{job.fileId ? `#${job.fileId}` : "—"}</td>
                  <td className="px-5 text-slate-500">
                    {new Intl.DateTimeFormat("ar-SA", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(job.createdAt)}
                  </td>
                  <td className="px-5">
                    <button
                      disabled={!job.fileId || restoreJob.isPending}
                      onClick={() =>
                        restoreJob.mutate({
                          organizationSlug,
                          backupJobId: job.id,
                        })
                      }
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-bold text-slate-700 disabled:opacity-40"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      استعادة
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-400">
                  لا توجد نسخ احتياطية بعد.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
