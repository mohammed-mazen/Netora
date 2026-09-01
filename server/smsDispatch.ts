import { resolveIntegrationSecret } from "./secrets";

const REQUEST_TIMEOUT_MS = 8000;

export type SmsDispatchResult = {
  ok: boolean;
  retryable: boolean;
  error?: string;
};

export type SmsGatewaySecret = {
  url?: string;
  apiKey?: string;
  from?: string;
};

export function parseSmsGatewaySecret(raw: string): SmsGatewaySecret {
  const trimmed = raw.trim();
  if (!trimmed) return {};
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      const url = typeof parsed.url === "string" ? parsed.url : typeof parsed.endpoint === "string" ? parsed.endpoint : undefined;
      const apiKey = typeof parsed.apiKey === "string" ? parsed.apiKey : typeof parsed.token === "string" ? parsed.token : typeof parsed.key === "string" ? parsed.key : undefined;
      const from = typeof parsed.from === "string" ? parsed.from : typeof parsed.sender === "string" ? parsed.sender : undefined;
      return { url, apiKey, from };
    } catch {
      return { apiKey: trimmed };
    }
  }
  return { apiKey: trimmed, url: process.env.SMS_PROVIDER_URL };
}

export async function dispatchSms(input: {
  toNumber: string;
  body: string;
  serverType: "cloud" | "local_modem";
  secretValue: string | null;
}): Promise<SmsDispatchResult> {
  if (input.serverType === "local_modem") {
    return { ok: false, retryable: false, error: "المودم المحلي غير متصل؛ اضبط بوابة سحابية لإرسال الرسائل" };
  }
  if (!input.secretValue?.trim()) {
    return { ok: false, retryable: false, error: "مفتاح بوابة الرسائل غير مهيأ" };
  }

  const gateway = parseSmsGatewaySecret(input.secretValue);
  const url = gateway.url?.trim();
  if (!url) {
    return { ok: false, retryable: false, error: "عنوان بوابة الرسائل غير مهيأ" };
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (gateway.apiKey) headers.Authorization = `Bearer ${gateway.apiKey}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ to: input.toNumber, text: input.body, from: gateway.from ?? null }),
      signal: controller.signal,
    });
    if (response.ok) return { ok: true, retryable: false };
    const body = await response.text().catch(() => "");
    const retryable = response.status >= 500;
    return { ok: false, retryable, error: `فشل إرسال الرسالة (${response.status})${body ? `: ${body.slice(0, 200)}` : ""}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر الاتصال ببوابة الرسائل";
    const aborted = error instanceof Error && error.name === "AbortError";
    return { ok: false, retryable: true, error: aborted ? "انتهت مهلة الاتصال ببوابة الرسائل" : message };
  } finally {
    clearTimeout(timeout);
  }
}

export async function dispatchTenantSms(input: {
  toNumber: string;
  body: string;
  serverType: "cloud" | "local_modem";
  secretRef: string | null;
}): Promise<SmsDispatchResult> {
  const secretValue = input.secretRef ? await resolveIntegrationSecret(input.secretRef) : null;
  return dispatchSms({ toNumber: input.toNumber, body: input.body, serverType: input.serverType, secretValue });
}
