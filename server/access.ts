import { z } from "zod";

export const tenantRoles = ["owner", "manager", "operator", "accountant", "support", "viewer"] as const;
export type TenantRole = (typeof tenantRoles)[number];

export const tenantPermissions = [
  "workspace:read",
  "network:read",
  "network:write",
  "customers:read",
  "customers:write",
  "vouchers:read",
  "vouchers:write",
  "billing:read",
  "billing:write",
  "support:read",
  "support:write",
  "integrations:read",
  "integrations:write",
  "audit:read",
  "files:read",
  "files:write",
  "alerts:read",
  "alerts:write",
  "sessions:control",
  // --- New fine-grained modules (competitive-parity rebuild) ---
  "accounting:read",
  "accounting:write",
  "cards:read",
  "cards:write",
  "cardDesign:read",
  "cardDesign:write",
  "reports:builder",
  "backup:read",
  "backup:write",
  "monitor:read",
  "monitor:write",
  "points:read",
  "points:write",
  "sms:read",
  "sms:write",
  "competitions:read",
  "competitions:write",
  "chat:read",
  "chat:write",
  "roles:read",
  "roles:write",

  // --- Round 2: DevTools/source-level competitive audit closeout ---
  // Two-factor authentication (TOTP) — every account manages its own, this
  // permission covers an *owner* forcing/inspecting another member's status.
  "twoFactor:read",
  "twoFactor:write",
  // Personal access tokens (API) — matches competitor's Sanctum tokens page.
  "apiTokens:read",
  "apiTokens:write",
  // MAC security (block/unblock devices, blacklist/whitelist policy).
  "macsec:read",
  "macsec:write",
  "macsec:action",
  // Hotspot captive-portal login page builder.
  "hotspotPages:read",
  "hotspotPages:write",
  // Dangerous raw-SQL report editor — deliberately separate from the base
  // "reports:builder" permission so an owner can grant report browsing
  // without exposing the SQL editor (competitor gates the whole module
  // behind one static password; we gate only the risky sub-feature).
  "reports:sqlEditor",
  // Scheduled report delivery (email/Telegram) administration.
  "reports:schedules",
  // Card/voucher CSV + MikroTik SQLite/Wizard import pipelines.
  "cards:import",
  // Bulk voucher actions (delete/group-change/stop many at once).
  "vouchers:bulk",
  // Real reboot/shutdown trigger endpoints against a router (matches the
  // competitor's confirmed monitor.reboot/monitor.shutdown routes).
  "monitor:action",
  // Backup schedule/retention configuration (distinct from backup:write,
  // which only covers on-demand backup creation).
  "backup:schedule",
  // SMS template engine (create/edit reusable Mustache-style templates).
  "sms:templates",
  // Universal dynamic settings-items engine (shared by macsec/points/
  // change-speed/change-group/charging-points/sms — see dynamicSettingsItems).
  "settings:dynamic:read",
  "settings:dynamic:write",
] as const;
export type TenantPermission = (typeof tenantPermissions)[number];

const allTenantPermissions: readonly TenantPermission[] = tenantPermissions;

const permissionsByRole: Record<TenantRole, readonly TenantPermission[]> = {
  owner: allTenantPermissions,
  manager: [
    "workspace:read", "network:read", "network:write", "customers:read", "customers:write",
    "vouchers:read", "vouchers:write", "billing:read", "support:read", "support:write",
    "integrations:read", "audit:read", "files:read", "files:write", "alerts:read", "alerts:write", "sessions:control",
    "accounting:read", "accounting:write", "cards:read", "cards:write", "cardDesign:read", "cardDesign:write",
    "reports:builder", "backup:read", "monitor:read", "monitor:write", "points:read", "points:write",
    "sms:read", "sms:write", "competitions:read", "competitions:write", "chat:read", "chat:write", "roles:read",
    "twoFactor:read", "apiTokens:read", "apiTokens:write", "macsec:read", "macsec:write", "macsec:action",
    "hotspotPages:read", "hotspotPages:write", "reports:sqlEditor", "reports:schedules", "cards:import",
    "vouchers:bulk", "monitor:action", "backup:schedule", "sms:templates", "settings:dynamic:read", "settings:dynamic:write",
  ],
  operator: [
    "workspace:read", "network:read", "network:write", "customers:read", "customers:write", "vouchers:read", "vouchers:write",
    "support:read", "support:write", "cards:read", "cards:write", "points:read", "competitions:read", "chat:read", "chat:write",
    "macsec:read", "macsec:action", "cards:import", "apiTokens:read",
  ],
  accountant: [
    "workspace:read", "customers:read", "billing:read", "billing:write", "support:read",
    "accounting:read", "accounting:write", "reports:builder", "reports:schedules",
  ],
  support: [
    "workspace:read", "customers:read", "vouchers:read", "support:read", "support:write", "chat:read", "chat:write",
    "macsec:read",
  ],
  viewer: [
    "workspace:read", "network:read", "customers:read", "vouchers:read", "billing:read", "support:read",
    "integrations:read", "audit:read", "files:read", "alerts:read", "accounting:read", "cards:read",
    "monitor:read", "points:read", "sms:read", "competitions:read", "chat:read", "roles:read",
    "twoFactor:read", "apiTokens:read", "macsec:read", "hotspotPages:read", "settings:dynamic:read",
  ],
};

export const tenantSelectorSchema = z.object({
  organizationSlug: z.string().trim().min(3).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "صيغة معرّف المؤسسة غير صالحة"),
});

/**
 * Base check against the fixed 6-role matrix above. Callers that also need
 * to honor a member's optional custom fine-grained role (see
 * `drizzle/schema.ts` customRoles/rolePermissions) should prefer
 * `hasEffectiveTenantPermission` in server/db.ts, which layers the custom
 * role's explicit permission grants on top of this base check.
 */
export function hasTenantPermission(role: TenantRole, permission: TenantPermission) {
  return permissionsByRole[role].includes(permission);
}

export function redactAuditMetadata(metadata: Record<string, unknown> | undefined) {
  if (!metadata) return null;
  const sensitiveKey = /authorization|credential|password|secret|token|api[-_]?key/i;
  return JSON.stringify(metadata, (key, value) => sensitiveKey.test(key) ? "[REDACTED]" : value);
}
