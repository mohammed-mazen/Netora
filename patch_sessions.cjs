const fs = require('fs');

let content = fs.readFileSync('client/src/components/SessionControlPanel.tsx', 'utf8');

// Add import if needed and the mutation logic
const hookAdd = `
  const disconnectMutation = trpc.workspace.sessions.queueDisconnect.useMutation({
    onSuccess: async () => {
      toast.success("تم إرسال طلب فصل الجلسة بنجاح، سيقوم العامل الخلفي بالتنفيذ.");
      await utils.workspace.sessions.list.invalidate();
    },
    onError: (error) => toast.error(error.message)
  });
`;

content = content.replace('const updateStatus = (value: string) => {', hookAdd + '\n  const updateStatus = (value: string) => {');

// Add the button
const buttonHtml = `
                    {session.state === "active" ? (
                       <button
                         disabled={disconnectMutation.isPending}
                         onClick={() => disconnectMutation.mutate({ organizationSlug, sessionId: session.id })}
                         className="px-2 py-1 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-md text-[10px] font-bold transition-colors disabled:opacity-50"
                       >
                         فصل الجلسة
                       </button>
                    ) : (
                       <span className="text-slate-400 text-[10px]">-</span>
                    )}
`;

content = content.replace('<td><Status value={session.state} /></td>', '<td><Status value={session.state} /></td>\n                    <td className="px-5">' + buttonHtml + '</td>');

content = content.replace('<th>الحالة</th>', '<th>الحالة</th>\n                <th className="px-5">إجراءات</th>');

fs.writeFileSync('client/src/components/SessionControlPanel.tsx', content);
console.log('SessionControlPanel patched');
