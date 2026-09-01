export const integrationKinds = ["radius", "mikrotik"] as const;
export type ManagedIntegrationKind = typeof integrationKinds[number];
export type RouterOperation = "router_health_check" | "router_identity_read" | "radius_policy_projection" | "radius_disconnect_session";

const secretLikeKey = /authorization|credential|password|secret|token|api[-_]?key/i;
const hostPattern = /^[a-zA-Z0-9._:[\]-]+$/;

export function validateSecretReference(secretRef: string | null | undefined) {
  if (!secretRef) return null;
  if (!/^secret:\/\/[a-zA-Z0-9._/-]{3,220}$/.test(secretRef)) throw new Error("مرجع السر يجب أن يكون معرفًا آمنًا من مخزن الأسرار");
  return secretRef;
}

export function assertNoSensitiveConfiguration(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("إعداد التكامل يجب أن يكون كائنًا");
  for (const [key, item] of Object.entries(value)) {
    if (secretLikeKey.test(key)) throw new Error("لا تقبل إعدادات التكامل أي كلمة مرور أو رمز أو سر؛ استخدم مرجع السر فقط");
    if (item && typeof item === "object") assertNoSensitiveConfiguration(item);
  }
}

export function validateIntegrationDraft(input: { kind: ManagedIntegrationKind; secretRef?: string | null; configuration: Record<string, unknown> }) {
  assertNoSensitiveConfiguration(input.configuration);
  const secretRef = validateSecretReference(input.secretRef);
  if (input.kind === "mikrotik") {
    const transport = input.configuration.transport;
    const host = input.configuration.managementHost;
    if (transport !== "api_ssl" && transport !== "rest_https") throw new Error("يجب اختيار API-SSL أو REST عبر HTTPS فقط");
    if (typeof host !== "string" || !hostPattern.test(host)) throw new Error("عنوان إدارة الراوتر غير صالح");
  }
  if (input.kind === "radius") {
    const mode = input.configuration.mode;
    const nasIdentifier = input.configuration.nasIdentifier;
    if (mode !== "local" && mode !== "cloud" && mode !== "hybrid") throw new Error("نمط RADIUS غير صالح");
    if (typeof nasIdentifier !== "string" || !/^[a-zA-Z0-9._:-]{2,120}$/.test(nasIdentifier)) throw new Error("معرف NAS غير صالح");
  }
  return { secretRef, configuration: input.configuration };
}

export function assertAllowedRouterOperation(operation: string): asserts operation is RouterOperation {
  if (!(["router_health_check", "router_identity_read", "radius_policy_projection", "radius_disconnect_session"] as const).includes(operation as RouterOperation)) throw new Error("عملية التكامل غير مسموح بها");
}

export function createSafeJobPayload(input: { operation: RouterOperation; routerId?: number | null; integrationKind: ManagedIntegrationKind }) {
  assertAllowedRouterOperation(input.operation);
  return { operation: input.operation, routerId: input.routerId ?? null, integrationKind: input.integrationKind };
}
