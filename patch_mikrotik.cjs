const fs = require('fs');

let content = fs.readFileSync('server/mikrotik.ts', 'utf8');

// 1. Add import
content = content.replace(
  'import { buildRouterCommand',
  'import { MikrotikApiSslClient } from "./mikrotik_api";\nimport { buildRouterCommand'
);

// 2. Patch checkRouterHealth
const checkRouterHealthOld = `export async function checkRouterHealth(router: RouterTarget): Promise<MikrotikHealthResult> {
  if (router.connectionMode === "agent") {
    return { ok: false, error: "connectionMode=agent يتطلب وكيلًا محليًا غير مطبق بعد؛ استخدم api_ssl أو rest_https" };
  }

  const credential = await resolveRouterCredential(router.credentialRef);
  if (!credential) {
    return { ok: false, error: "لا توجد بيانات اعتماد محفوظة لهذا الراوتر — أضف اسم المستخدم وكلمة المرور أولاً" };
  }

  const authHeader = \`Basic \${Buffer.from(\`\${credential.username}:\${credential.password}\`).toString("base64")}\`;

  try {
    const identityRes = await fetchWithTimeout(buildRestUrl(router.managementAddress, "/system/identity"), {
      method: "GET",
      headers: { Authorization: authHeader, Accept: "application/json" },
    });
    if (identityRes.status === 401 || identityRes.status === 403) {
      return { ok: false, error: "فشل التحقق من بيانات الاعتماد (401/403) — تأكد من اسم المستخدم وكلمة المرور" };
    }
    if (!identityRes.ok) {
      return { ok: false, error: \`تعذر الوصول إلى REST API الخاص بالراوتر (HTTP \${identityRes.status}) — تأكد أن RouterOS v7+ مع REST مفعّل\` };
    }
    const identityBody = (await identityRes.json()) as { name?: string };

    const resourceRes = await fetchWithTimeout(buildRestUrl(router.managementAddress, "/system/resource"), {
      method: "GET",
      headers: { Authorization: authHeader, Accept: "application/json" },
    });
    let routerOsVersion: string | undefined;
    let uptime: string | undefined;
    let cpuLoad: number | undefined;
    if (resourceRes.ok) {
      const resourceBody = (await resourceRes.json()) as { version?: string; uptime?: string; ["cpu-load"]?: string | number };
      routerOsVersion = resourceBody.version;
      uptime = resourceBody.uptime;
      const rawLoad = resourceBody["cpu-load"];
      cpuLoad = rawLoad !== undefined ? Number(rawLoad) : undefined;
    }

    return { ok: true, identity: identityBody.name, routerOsVersion, uptime, cpuLoad };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, error: \`انتهت مهلة الاتصال بالراوتر (\${REQUEST_TIMEOUT_MS}ms) — تحقق من الشبكة/الجدار الناري\` };
    }
    const message = error instanceof Error ? error.message : "خطأ غير معروف";
    return { ok: false, error: \`تعذر الاتصال بالراوتر: \${message}\` };
  }
}`;

const checkRouterHealthNew = `export async function checkRouterHealth(router: RouterTarget): Promise<MikrotikHealthResult> {
  if (router.connectionMode === "agent") {
    return { ok: false, error: "connectionMode=agent يتطلب وكيلًا محليًا غير مطبق بعد؛ استخدم api_ssl أو rest_https" };
  }

  const credential = await resolveRouterCredential(router.credentialRef);
  if (!credential) {
    return { ok: false, error: "لا توجد بيانات اعتماد محفوظة لهذا الراوتر — أضف اسم المستخدم وكلمة المرور أولاً" };
  }

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

         const identityRes = await client.execute('/system/identity/print');
         const identity = identityRes.length > 0 ? identityRes[0].name : undefined;

         const resourceRes = await client.execute('/system/resource/print');
         let routerOsVersion: string | undefined;
         let uptime: string | undefined;
         let cpuLoad: number | undefined;

         if (resourceRes.length > 0) {
             const res = resourceRes[0];
             routerOsVersion = res.version;
             uptime = res.uptime;
             cpuLoad = res['cpu-load'] !== undefined ? Number(res['cpu-load']) : undefined;
         }

         client.disconnect();
         return { ok: true, identity, routerOsVersion, uptime, cpuLoad };
     } catch (error: any) {
         client.disconnect();
         if (error.message.includes("401") || error.message.includes("cannot log in")) {
              return { ok: false, error: "فشل التحقق من بيانات الاعتماد (401/403) — تأكد من اسم المستخدم وكلمة المرور" };
         }
         if (error.message.includes("Timeout")) {
              return { ok: false, error: \`انتهت مهلة الاتصال بالراوتر (\${REQUEST_TIMEOUT_MS}ms) — تحقق من الشبكة/الجدار الناري\` };
         }
         return { ok: false, error: \`تعذر الاتصال بالراوتر: \${error.message}\` };
     }
  }

  const authHeader = \`Basic \${Buffer.from(\`\${credential.username}:\${credential.password}\`).toString("base64")}\`;

  try {
    const identityRes = await fetchWithTimeout(buildRestUrl(router.managementAddress, "/system/identity"), {
      method: "GET",
      headers: { Authorization: authHeader, Accept: "application/json" },
    });
    if (identityRes.status === 401 || identityRes.status === 403) {
      return { ok: false, error: "فشل التحقق من بيانات الاعتماد (401/403) — تأكد من اسم المستخدم وكلمة المرور" };
    }
    if (!identityRes.ok) {
      return { ok: false, error: \`تعذر الوصول إلى REST API الخاص بالراوتر (HTTP \${identityRes.status}) — تأكد أن RouterOS v7+ مع REST مفعّل\` };
    }
    const identityBody = (await identityRes.json()) as { name?: string };

    const resourceRes = await fetchWithTimeout(buildRestUrl(router.managementAddress, "/system/resource"), {
      method: "GET",
      headers: { Authorization: authHeader, Accept: "application/json" },
    });
    let routerOsVersion: string | undefined;
    let uptime: string | undefined;
    let cpuLoad: number | undefined;
    if (resourceRes.ok) {
      const resourceBody = (await resourceRes.json()) as { version?: string; uptime?: string; ["cpu-load"]?: string | number };
      routerOsVersion = resourceBody.version;
      uptime = resourceBody.uptime;
      const rawLoad = resourceBody["cpu-load"];
      cpuLoad = rawLoad !== undefined ? Number(rawLoad) : undefined;
    }

    return { ok: true, identity: identityBody.name, routerOsVersion, uptime, cpuLoad };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, error: \`انتهت مهلة الاتصال بالراوتر (\${REQUEST_TIMEOUT_MS}ms) — تحقق من الشبكة/الجدار الناري\` };
    }
    const message = error instanceof Error ? error.message : "خطأ غير معروف";
    return { ok: false, error: \`تعذر الاتصال بالراوتر: \${message}\` };
  }
}`;

content = content.replace(checkRouterHealthOld, checkRouterHealthNew);

fs.writeFileSync('server/mikrotik.ts', content);
console.log('patched checkRouterHealth');

// 3. Patch disconnectRouterSession
let content2 = fs.readFileSync('server/mikrotik.ts', 'utf8');
const disconnectRouterSessionOld = `export async function disconnectRouterSession(
  router: RouterTarget,
  input: { sessionIdentifier: string; protocol: "hotspot" | "pppoe" },
): Promise<{ ok: boolean; error?: string }> {
  const credential = await resolveRouterCredential(router.credentialRef);
  if (!credential) {
    return { ok: false, error: "لا توجد بيانات اعتماد محفوظة لهذا الراوتر" };
  }
  const authHeader = \`Basic \${Buffer.from(\`\${credential.username}:\${credential.password}\`).toString("base64")}\`;
  const listPath = input.protocol === "hotspot" ? "/ip/hotspot/active" : "/ppp/active";

  try {
    const listRes = await fetchWithTimeout(buildRestUrl(router.managementAddress, listPath), {
      method: "GET",
      headers: { Authorization: authHeader, Accept: "application/json" },
    });
    if (!listRes.ok) return { ok: false, error: \`تعذر قراءة الجلسات النشطة (HTTP \${listRes.status})\` };
    const entries = (await listRes.json()) as Array<Record<string, string>>;
    const match = entries.find(entry => entry.user === input.sessionIdentifier || entry.name === input.sessionIdentifier || entry["mac-address"] === input.sessionIdentifier);
    if (!match || !match[".id"]) return { ok: false, error: "لم يتم العثور على جلسة نشطة مطابقة على الراوتر" };

    const removeRes = await fetchWithTimeout(\`\${buildRestUrl(router.managementAddress, listPath)}/\${encodeURIComponent(match[".id"])}\`, {
      method: "DELETE",
      headers: { Authorization: authHeader },
    });
    if (!removeRes.ok && removeRes.status !== 404) return { ok: false, error: \`فشل قطع الجلسة (HTTP \${removeRes.status})\` };
    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, error: \`انتهت مهلة الاتصال بالراوتر (\${REQUEST_TIMEOUT_MS}ms)\` };
    }
    const message = error instanceof Error ? error.message : "خطأ غير معروف";
    return { ok: false, error: \`تعذر قطع الجلسة: \${message}\` };
  }
}`;

const disconnectRouterSessionNew = `export async function disconnectRouterSession(
  router: RouterTarget,
  input: { sessionIdentifier: string; protocol: "hotspot" | "pppoe" },
): Promise<{ ok: boolean; error?: string }> {
  const credential = await resolveRouterCredential(router.credentialRef);
  if (!credential) {
    return { ok: false, error: "لا توجد بيانات اعتماد محفوظة لهذا الراوتر" };
  }

  const listPath = input.protocol === "hotspot" ? "/ip/hotspot/active" : "/ppp/active";

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

         const cmdPath = listPath + "/print";
         const entries = await client.execute(cmdPath);

         const match = entries.find(entry => entry.user === input.sessionIdentifier || entry.name === input.sessionIdentifier || entry["mac-address"] === input.sessionIdentifier);
         if (!match || !match[".id"]) {
             client.disconnect();
             return { ok: false, error: "لم يتم العثور على جلسة نشطة مطابقة على الراوتر" };
         }

         const rmCmdPath = listPath + "/remove";
         await client.execute(rmCmdPath, { ".id": match[".id"] });
         client.disconnect();
         return { ok: true };
     } catch (error: any) {
         client.disconnect();
         if (error.message.includes("Timeout")) {
              return { ok: false, error: \`انتهت مهلة الاتصال بالراوتر (\${REQUEST_TIMEOUT_MS}ms)\` };
         }
         return { ok: false, error: \`تعذر قطع الجلسة: \${error.message}\` };
     }
  }

  const authHeader = \`Basic \${Buffer.from(\`\${credential.username}:\${credential.password}\`).toString("base64")}\`;

  try {
    const listRes = await fetchWithTimeout(buildRestUrl(router.managementAddress, listPath), {
      method: "GET",
      headers: { Authorization: authHeader, Accept: "application/json" },
    });
    if (!listRes.ok) return { ok: false, error: \`تعذر قراءة الجلسات النشطة (HTTP \${listRes.status})\` };
    const entries = (await listRes.json()) as Array<Record<string, string>>;
    const match = entries.find(entry => entry.user === input.sessionIdentifier || entry.name === input.sessionIdentifier || entry["mac-address"] === input.sessionIdentifier);
    if (!match || !match[".id"]) return { ok: false, error: "لم يتم العثور على جلسة نشطة مطابقة على الراوتر" };

    const removeRes = await fetchWithTimeout(\`\${buildRestUrl(router.managementAddress, listPath)}/\${encodeURIComponent(match[".id"])}\`, {
      method: "DELETE",
      headers: { Authorization: authHeader },
    });
    if (!removeRes.ok && removeRes.status !== 404) return { ok: false, error: \`فشل قطع الجلسة (HTTP \${removeRes.status})\` };
    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, error: \`انتهت مهلة الاتصال بالراوتر (\${REQUEST_TIMEOUT_MS}ms)\` };
    }
    const message = error instanceof Error ? error.message : "خطأ غير معروف";
    return { ok: false, error: \`تعذر قطع الجلسة: \${message}\` };
  }
}`;

content2 = content2.replace(disconnectRouterSessionOld, disconnectRouterSessionNew);

fs.writeFileSync('server/mikrotik.ts', content2);
console.log('patched disconnectRouterSession');
