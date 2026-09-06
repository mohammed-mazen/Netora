const fs = require('fs');

let content3 = fs.readFileSync('server/mikrotik.ts', 'utf8');

const runRouterSystemCommandOld = `export async function runRouterSystemCommand(router: RouterTarget, action: MonitorAction): Promise<{ ok: boolean; error?: string }> {
  if (router.connectionMode === "agent") {
    return { ok: false, error: "connectionMode=agent يتطلب وكيلًا محليًا غير مطبق بعد؛ استخدم api_ssl أو rest_https" };
  }

  const credential = await resolveRouterCredential(router.credentialRef);
  if (!credential) {
    return { ok: false, error: "لا توجد بيانات اعتماد محفوظة لهذا الراوتر — أضف اسم المستخدم وكلمة المرور أولاً" };
  }
  const authHeader = \`Basic \${Buffer.from(\`\${credential.username}:\${credential.password}\`).toString("base64")}\`;
  const command = buildRouterCommand(action);

  try {
    const res = await fetchWithTimeout(buildRestUrl(router.managementAddress, command.path), {
      method: command.method,
      headers: { Authorization: authHeader, Accept: "application/json" },
    });
    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: "فشل التحقق من بيانات الاعتماد (401/403) — تأكد من اسم المستخدم وكلمة المرور" };
    }
    if (res.status === 404) {
      return { ok: false, error: \`العملية \${action} غير مدعومة على هذا الراوتر (HTTP 404) — تأكد أن RouterOS v7+ مع REST مفعّل\` };
    }
    if (!res.ok) {
      return { ok: false, error: \`فشل تنفيذ \${action} على الراوتر (HTTP \${res.status})\` };
    }
    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, error: \`انتهت مهلة الاتصال بالراوتر (\${REQUEST_TIMEOUT_MS}ms) — تحقق من الشبكة/الجدار الناري\` };
    }
    const message = error instanceof Error ? error.message : "خطأ غير معروف";
    return { ok: false, error: \`تعذر تنفيذ \${action} على الراوتر: \${message}\` };
  }
}`;

const runRouterSystemCommandNew = `export async function runRouterSystemCommand(router: RouterTarget, action: MonitorAction): Promise<{ ok: boolean; error?: string }> {
  if (router.connectionMode === "agent") {
    return { ok: false, error: "connectionMode=agent يتطلب وكيلًا محليًا غير مطبق بعد؛ استخدم api_ssl أو rest_https" };
  }

  const credential = await resolveRouterCredential(router.credentialRef);
  if (!credential) {
    return { ok: false, error: "لا توجد بيانات اعتماد محفوظة لهذا الراوتر — أضف اسم المستخدم وكلمة المرور أولاً" };
  }

  const command = buildRouterCommand(action);

  if (router.connectionMode === "api_ssl") {
     const host = router.managementAddress.includes("://") ? router.managementAddress.replace(/^https?:\\/\\//, "") : router.managementAddress;
     let port = 8729;
     let hostOnly = host;
     if (host.includes(":")) {
         const parts = host.split(":");
         hostOnly = parts[0];
         port = parseInt(parts[1], 10);
     }

     const client = new MikrotikApiSslClient(hostOnly, port, REQUEST_TIMEOUT_MS);
     try {
         await client.connect();
         await client.login(credential.username, credential.password);

         await client.execute(command.path);

         client.disconnect();
         return { ok: true };
     } catch (error: any) {
         client.disconnect();
         if (error.message.includes("Timeout")) {
              return { ok: false, error: \`انتهت مهلة الاتصال بالراوتر (\${REQUEST_TIMEOUT_MS}ms) — تحقق من الشبكة/الجدار الناري\` };
         }
         return { ok: false, error: \`تعذر تنفيذ \${action} على الراوتر: \${error.message}\` };
     }
  }

  const authHeader = \`Basic \${Buffer.from(\`\${credential.username}:\${credential.password}\`).toString("base64")}\`;

  try {
    const res = await fetchWithTimeout(buildRestUrl(router.managementAddress, command.path), {
      method: command.method,
      headers: { Authorization: authHeader, Accept: "application/json" },
    });
    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: "فشل التحقق من بيانات الاعتماد (401/403) — تأكد من اسم المستخدم وكلمة المرور" };
    }
    if (res.status === 404) {
      return { ok: false, error: \`العملية \${action} غير مدعومة على هذا الراوتر (HTTP 404) — تأكد أن RouterOS v7+ مع REST مفعّل\` };
    }
    if (!res.ok) {
      return { ok: false, error: \`فشل تنفيذ \${action} على الراوتر (HTTP \${res.status})\` };
    }
    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, error: \`انتهت مهلة الاتصال بالراوتر (\${REQUEST_TIMEOUT_MS}ms) — تحقق من الشبكة/الجدار الناري\` };
    }
    const message = error instanceof Error ? error.message : "خطأ غير معروف";
    return { ok: false, error: \`تعذر تنفيذ \${action} على الراوتر: \${message}\` };
  }
}`;

content3 = content3.replace(runRouterSystemCommandOld, runRouterSystemCommandNew);

fs.writeFileSync('server/mikrotik.ts', content3);
console.log('patched runRouterSystemCommand');
