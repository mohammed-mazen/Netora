import {
  decimal,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  name: text("name"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  // Account-lockout tracking (brute-force mitigation, on top of the
  // IP-based rate limiter in server/_core/index.ts — that limiter is shared
  // across all clients behind one IP/NAT, this is per-account and survives
  // across IPs). failedLoginAttempts resets to 0 on any successful login;
  // lockedUntil is set once attempts cross the threshold (see
  // server/_core/auth.ts ACCOUNT_LOCKOUT_THRESHOLD) and cleared on the next
  // successful login after it elapses.
  failedLoginAttempts: int("failedLoginAttempts").default(0).notNull(),
  lockedUntil: timestamp("lockedUntil"),
  // Two-factor authentication flag (the actual TOTP secret/recovery codes
  // live in `two_factor_secrets`, encrypted — see server/twoFactor.ts). This
  // denormalized boolean lets login/session checks avoid a join on the hot
  // path; it is kept in sync by twoFactor.enable/disable exclusively.
  twoFactorEnabled: int("twoFactorEnabled").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const subscriptionPlans = mysqlTable("subscription_plans", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 40 }).notNull().unique(),
  name: varchar("name", { length: 120 }).notNull(),
  description: text("description"),
  monthlyPrice: decimal("monthlyPrice", { precision: 12, scale: 2 }).notNull(),
  routerLimit: int("routerLimit").notNull(),
  customerLimit: int("customerLimit").notNull(),
  staffLimit: int("staffLimit").notNull(),
  storageLimitMb: int("storageLimitMb").notNull(),
  isActive: int("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const organizations = mysqlTable("organizations", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 80 }).notNull().unique(),
  name: varchar("name", { length: 160 }).notNull(),
  legalName: varchar("legalName", { length: 180 }),
  status: mysqlEnum("status", ["trial", "active", "suspended", "archived"]).default("trial").notNull(),
  timezone: varchar("timezone", { length: 64 }).default("Asia/Riyadh").notNull(),
  currency: varchar("currency", { length: 8 }).default("SAR").notNull(),
  routerResourceCount: int("routerResourceCount").default(0).notNull(),
  customerResourceCount: int("customerResourceCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const organizationSubscriptions = mysqlTable("organization_subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  planId: int("planId").notNull().references(() => subscriptionPlans.id),
  status: mysqlEnum("status", ["trialing", "active", "past_due", "suspended", "cancelled"]).default("trialing").notNull(),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  endsAt: timestamp("endsAt"),
  routerLimitOverride: int("routerLimitOverride"),
  customerLimitOverride: int("customerLimitOverride"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("subscription_organization_idx").on(table.organizationId)]);

export const organizationMembers = mysqlTable("organization_members", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  userId: int("userId").notNull().references(() => users.id),
  role: mysqlEnum("role", ["owner", "manager", "operator", "accountant", "support", "viewer"]).notNull(),
  status: mysqlEnum("status", ["invited", "active", "disabled"]).default("invited").notNull(),
  // Optional fine-grained custom role (see customRoles/rolePermissions below).
  // When set, the member's *effective* permission set is the union of the
  // custom role's rolePermissions rows instead of the base `role` enum's
  // hardcoded mapping in server/access.ts — this is what lets an owner build
  // permission sets as granular as the competitor's role/permission matrix
  // without us having to hardcode every combination.
  customRoleId: int("customRoleId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("member_unique").on(table.organizationId, table.userId), index("member_user_idx").on(table.userId), index("member_custom_role_idx").on(table.customRoleId)]);

// ---------------------------------------------------------------------------
// Fine-grained RBAC (custom roles). Each organization can define its own
// named roles (e.g. "محاسب مبيعات") and pick exactly which permission keys
// (see server/access.ts fineGrainedPermissions) that role grants. This is
// layered ON TOP of the simple 6-value `role` enum above (which still
// determines base capability when no custom role is assigned) rather than
// replacing it, so every existing procedure keeps working unmodified.
export const customRoles = mysqlTable("custom_roles", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  name: varchar("name", { length: 140 }).notNull(),
  description: varchar("description", { length: 255 }),
  isSystem: int("isSystem").default(0).notNull(),
  createdByUserId: int("createdByUserId").references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("custom_role_name_unique").on(table.organizationId, table.name)]);

export const rolePermissions = mysqlTable("role_permissions", {
  id: int("id").autoincrement().primaryKey(),
  roleId: int("roleId").notNull().references(() => customRoles.id),
  permission: varchar("permission", { length: 80 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("role_permission_unique").on(table.roleId, table.permission)]);

export const sites = mysqlTable("sites", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  name: varchar("name", { length: 140 }).notNull(),
  city: varchar("city", { length: 80 }),
  status: mysqlEnum("status", ["active", "maintenance", "offline"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("site_org_idx").on(table.organizationId)]);

export const routers = mysqlTable("routers", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  siteId: int("siteId").references(() => sites.id),
  name: varchar("name", { length: 140 }).notNull(),
  managementAddress: varchar("managementAddress", { length: 255 }).notNull(),
  routerOsVersion: varchar("routerOsVersion", { length: 60 }),
  connectionMode: mysqlEnum("connectionMode", ["api_ssl", "rest_https", "agent"]).default("api_ssl").notNull(),
  credentialRef: varchar("credentialRef", { length: 255 }),
  nasIdentifier: varchar("nasIdentifier", { length: 160 }),
  status: mysqlEnum("status", ["pending", "healthy", "degraded", "offline", "disabled"]).default("pending").notNull(),
  lastSeenAt: timestamp("lastSeenAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
// nasIdentifier is unique PLATFORM-WIDE (not per-organization). This is
// intentional: a raw RADIUS accounting packet carries no tenant/organization
// context of its own — the only way to route it to the correct tenant is by
// looking up the router via getRouterByNasIdentifier(nasIdentifier) alone
// (see server/db.ts and server/radiusAccounting.ts). If two organizations
// were allowed to reuse the same NAS-Identifier, RADIUS accounting events for
// one tenant's router could be misattributed to another tenant's session —
// a cross-tenant data leak. NULL values are exempt from the unique
// constraint (MySQL unique indexes allow multiple NULLs), so routers without
// a NAS-Identifier configured yet are unaffected.
}, table => [index("router_org_idx").on(table.organizationId), uniqueIndex("router_nas_unique").on(table.nasIdentifier)]);

export const speedProfiles = mysqlTable("speed_profiles", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  name: varchar("name", { length: 120 }).notNull(),
  downloadKbps: int("downloadKbps").notNull(),
  uploadKbps: int("uploadKbps").notNull(),
  radiusAttributes: text("radiusAttributes"),
  isActive: int("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("speed_profile_unique").on(table.organizationId, table.name)]);

export const servicePlans = mysqlTable("service_plans", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  speedProfileId: int("speedProfileId").references(() => speedProfiles.id),
  name: varchar("name", { length: 140 }).notNull(),
  type: mysqlEnum("type", ["voucher", "subscription", "pppoe"]).notNull(),
  price: decimal("price", { precision: 12, scale: 2 }).notNull(),
  validityDays: int("validityDays"),
  quotaMb: int("quotaMb"),
  simultaneousSessions: int("simultaneousSessions").default(1).notNull(),
  status: mysqlEnum("status", ["draft", "active", "archived"]).default("draft").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("service_plan_org_idx").on(table.organizationId)]);

export const customers = mysqlTable("customers", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  fullName: varchar("fullName", { length: 160 }).notNull(),
  username: varchar("username", { length: 120 }).notNull(),
  phone: varchar("phone", { length: 40 }),
  email: varchar("email", { length: 320 }),
  status: mysqlEnum("status", ["active", "suspended", "blocked", "archived"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("customer_username_unique").on(table.organizationId, table.username), index("customer_org_idx").on(table.organizationId)]);

export const customerServiceAssignments = mysqlTable("customer_service_assignments", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  customerId: int("customerId").notNull().references(() => customers.id),
  servicePlanId: int("servicePlanId").notNull().references(() => servicePlans.id),
  status: mysqlEnum("status", ["active", "suspended", "ended"]).default("active").notNull(),
  activeKey: varchar("activeKey", { length: 12 }),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  endsAt: timestamp("endsAt"),
  createdByUserId: int("createdByUserId").references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("customer_assignment_one_active_unique").on(table.organizationId, table.customerId, table.activeKey), index("customer_assignment_org_customer_idx").on(table.organizationId, table.customerId, table.status), index("customer_assignment_plan_idx").on(table.organizationId, table.servicePlanId)]);

export const vouchers = mysqlTable("vouchers", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  servicePlanId: int("servicePlanId").notNull().references(() => servicePlans.id),
  codeHash: varchar("codeHash", { length: 255 }).notNull(),
  serial: varchar("serial", { length: 80 }).notNull(),
  status: mysqlEnum("status", ["new", "sold", "active", "expired", "cancelled"]).default("new").notNull(),
  expiresAt: timestamp("expiresAt"),
  soldAt: timestamp("soldAt"),
  activatedAt: timestamp("activatedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("voucher_serial_unique").on(table.organizationId, table.serial), index("voucher_org_status_idx").on(table.organizationId, table.status)]);

export const voucherBatches = mysqlTable("voucher_batches", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  servicePlanId: int("servicePlanId").notNull().references(() => servicePlans.id),
  reference: varchar("reference", { length: 80 }).notNull(),
  quantity: int("quantity").notNull(),
  status: mysqlEnum("status", ["draft", "generated", "printed", "cancelled"]).default("draft").notNull(),
  createdByUserId: int("createdByUserId").references(() => users.id),
  generatedAt: timestamp("generatedAt"),
  printedAt: timestamp("printedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("voucher_batch_reference_unique").on(table.organizationId, table.reference), index("voucher_batch_org_status_idx").on(table.organizationId, table.status)]);

export const networkSessions = mysqlTable("network_sessions", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  routerId: int("routerId").notNull().references(() => routers.id),
  customerId: int("customerId").references(() => customers.id),
  voucherId: int("voucherId").references(() => vouchers.id),
  acctUniqueId: varchar("acctUniqueId", { length: 180 }).notNull(),
  protocol: mysqlEnum("protocol", ["hotspot", "pppoe"]).notNull(),
  state: mysqlEnum("state", ["active", "closed", "unknown"]).default("active").notNull(),
  inputOctets: bigintText("inputOctets"),
  outputOctets: bigintText("outputOctets"),
  startedAt: timestamp("startedAt").notNull(),
  lastUpdateAt: timestamp("lastUpdateAt").notNull(),
  stoppedAt: timestamp("stoppedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("session_acct_unique").on(table.organizationId, table.acctUniqueId), index("session_router_state_idx").on(table.routerId, table.state)]);

export const invoices = mysqlTable("invoices", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  customerId: int("customerId").references(() => customers.id),
  number: varchar("number", { length: 80 }).notNull(),
  status: mysqlEnum("status", ["draft", "issued", "paid", "void", "overdue"]).default("draft").notNull(),
  total: decimal("total", { precision: 12, scale: 2 }).notNull(),
  issuedAt: timestamp("issuedAt"),
  dueAt: timestamp("dueAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("invoice_number_unique").on(table.organizationId, table.number), index("invoice_org_status_idx").on(table.organizationId, table.status)]);

export const payments = mysqlTable("payments", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  invoiceId: int("invoiceId").references(() => invoices.id),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  method: mysqlEnum("method", ["cash", "bank", "gateway", "credit"]).notNull(),
  status: mysqlEnum("status", ["pending", "confirmed", "failed", "refunded"]).default("pending").notNull(),
  reference: varchar("reference", { length: 160 }),
  paidAt: timestamp("paidAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const journalEntries = mysqlTable("journal_entries", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  number: varchar("number", { length: 80 }).notNull(),
  description: varchar("description", { length: 255 }).notNull(),
  occurredAt: timestamp("occurredAt").notNull(),
  createdByUserId: int("createdByUserId").references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("journal_entry_number_unique").on(table.organizationId, table.number)]);

export const journalLines = mysqlTable("journal_lines", {
  id: int("id").autoincrement().primaryKey(),
  journalEntryId: int("journalEntryId").notNull().references(() => journalEntries.id),
  accountCode: varchar("accountCode", { length: 60 }).notNull(),
  debit: decimal("debit", { precision: 12, scale: 2 }).default("0").notNull(),
  credit: decimal("credit", { precision: 12, scale: 2 }).default("0").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const supportTickets = mysqlTable("support_tickets", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  reference: varchar("reference", { length: 60 }).notNull(),
  subject: varchar("subject", { length: 200 }).notNull(),
  priority: mysqlEnum("priority", ["low", "normal", "high", "critical"]).default("normal").notNull(),
  status: mysqlEnum("status", ["open", "pending", "resolved", "closed"]).default("open").notNull(),
  createdByUserId: int("createdByUserId").references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("ticket_reference_unique").on(table.organizationId, table.reference)]);

export const supportMessages = mysqlTable("support_messages", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  ticketId: int("ticketId").notNull().references(() => supportTickets.id),
  body: text("body").notNull(),
  authorUserId: int("authorUserId").references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("support_message_ticket_idx").on(table.organizationId, table.ticketId, table.createdAt)]);

export const supportTemplates = mysqlTable("support_templates", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  name: varchar("name", { length: 120 }).notNull(),
  body: text("body").notNull(),
  createdByUserId: int("createdByUserId").references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("support_template_name_unique").on(table.organizationId, table.name)]);

export const alertRules = mysqlTable("alert_rules", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  key: varchar("key", { length: 100 }).notNull(),
  severity: mysqlEnum("severity", ["info", "warning", "critical"]).default("warning").notNull(),
  isEnabled: int("isEnabled").default(1).notNull(),
  createdByUserId: int("createdByUserId").references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("alert_rule_key_unique").on(table.organizationId, table.key)]);

export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").references(() => organizations.id),
  type: varchar("type", { length: 80 }).notNull(),
  severity: mysqlEnum("severity", ["info", "warning", "critical"]).default("info").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  body: text("body"),
  readAt: timestamp("readAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const files = mysqlTable("files", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  storageKey: varchar("storageKey", { length: 600 }).notNull(),
  originalName: varchar("originalName", { length: 255 }).notNull(),
  mimeType: varchar("mimeType", { length: 160 }).notNull(),
  sizeBytes: int("sizeBytes").notNull(),
  category: mysqlEnum("category", ["import", "report", "backup", "attachment"]).notNull(),
  createdByUserId: int("createdByUserId").references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("file_org_category_idx").on(table.organizationId, table.category)]);

export const auditLogs = mysqlTable("audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").references(() => organizations.id),
  actorUserId: int("actorUserId").references(() => users.id),
  action: varchar("action", { length: 120 }).notNull(),
  resourceType: varchar("resourceType", { length: 80 }).notNull(),
  resourceId: varchar("resourceId", { length: 120 }),
  requestId: varchar("requestId", { length: 100 }).notNull(),
  outcome: mysqlEnum("outcome", ["success", "denied", "failed"]).notNull(),
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("audit_org_created_idx").on(table.organizationId, table.createdAt)]);

export const integrationConfigs = mysqlTable("integration_configs", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  kind: mysqlEnum("kind", ["radius", "mikrotik", "sms", "payment"]).notNull(),
  status: mysqlEnum("status", ["not_configured", "testing", "connected", "error"]).default("not_configured").notNull(),
  secretRef: varchar("secretRef", { length: 255 }),
  configuration: text("configuration"),
  lastCheckedAt: timestamp("lastCheckedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("integration_kind_unique").on(table.organizationId, table.kind)]);

// Encrypted vault for integration credentials (MikroTik router password /
// API key, RADIUS shared secret). Never exposed via any query result — only
// resolved server-side by the background worker via `secretRef`. Encrypted
// with AES-256-GCM using SECRET_ENCRYPTION_KEY (see server/secrets.ts).
export const integrationSecrets = mysqlTable("integration_secrets", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  kind: mysqlEnum("kind", ["radius", "mikrotik", "sms", "payment"]).notNull(),
  ciphertext: text("ciphertext").notNull(),
  iv: varchar("iv", { length: 32 }).notNull(),
  authTag: varchar("authTag", { length: 32 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("integration_secret_unique").on(table.organizationId, table.kind)]);

// Encrypted per-router MikroTik credentials (username + password/API key),
// referenced by `routers.credentialRef` = `secret://router/{routerId}`.
// Separate from `integrationSecrets` because credentials are per-router, not
// per-organization (an organization can have many routers with different
// passwords). Same AES-256-GCM scheme, see server/secrets.ts.
export const routerCredentials = mysqlTable("router_credentials", {
  id: int("id").autoincrement().primaryKey(),
  routerId: int("routerId").notNull().references(() => routers.id).unique(),
  ciphertext: text("ciphertext").notNull(),
  iv: varchar("iv", { length: 32 }).notNull(),
  authTag: varchar("authTag", { length: 32 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const backgroundJobs = mysqlTable("background_jobs", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").references(() => organizations.id),
  routerId: int("routerId").references(() => routers.id),
  type: varchar("type", { length: 100 }).notNull(),
  idempotencyKey: varchar("idempotencyKey", { length: 160 }).notNull().unique(),
  status: mysqlEnum("status", ["queued", "running", "succeeded", "retrying", "failed"]).default("queued").notNull(),
  attempts: int("attempts").default(0).notNull(),
  payload: text("payload"),
  lastError: text("lastError"),
  nextRetryAt: timestamp("nextRetryAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

function bigintText(name: string) {
  return varchar(name, { length: 30 }).default("0").notNull();
}

// ===========================================================================
// ACCOUNTING MODULE — hierarchical chart of accounts, cash boxes, warehouses,
// stock, and receipt/payment vouchers linked to the ledger. Mirrors the
// competitor's tree-account model (account_number encodes the hierarchy
// depth via its digit grouping, e.g. 1 / 11 / 111 / 111001) while staying on
// top of the existing flat journalEntries/journalLines tables (untouched —
// this module writes into them, it doesn't replace them).
// ===========================================================================

export const chartAccounts = mysqlTable("chart_accounts", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  parentId: int("parentId"),
  accountNumber: varchar("accountNumber", { length: 40 }).notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  grade: int("grade").notNull(),
  kind: mysqlEnum("kind", ["asset", "liability", "equity", "revenue", "expense"]).notNull(),
  nature: mysqlEnum("nature", ["debit", "credit"]).notNull(),
  isCashBox: int("isCashBox").default(0).notNull(),
  isWarehouse: int("isWarehouse").default(0).notNull(),
  isDeletable: int("isDeletable").default(1).notNull(),
  balance: decimal("balance", { precision: 14, scale: 2 }).default("0").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  uniqueIndex("chart_account_number_unique").on(table.organizationId, table.accountNumber),
  index("chart_account_org_parent_idx").on(table.organizationId, table.parentId),
]);

export const cashBoxes = mysqlTable("cash_boxes", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  accountId: int("accountId").notNull().references(() => chartAccounts.id),
  name: varchar("name", { length: 140 }).notNull(),
  isDefault: int("isDefault").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("cash_box_org_idx").on(table.organizationId)]);

export const warehouses = mysqlTable("warehouses", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  accountId: int("accountId").references(() => chartAccounts.id),
  name: varchar("name", { length: 140 }).notNull(),
  location: varchar("location", { length: 200 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("warehouse_org_idx").on(table.organizationId)]);

export const stockTransfers = mysqlTable("stock_transfers", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  fromWarehouseId: int("fromWarehouseId").references(() => warehouses.id),
  toWarehouseId: int("toWarehouseId").references(() => warehouses.id),
  reference: varchar("reference", { length: 80 }).notNull(),
  itemDescription: varchar("itemDescription", { length: 200 }).notNull(),
  quantity: int("quantity").notNull(),
  status: mysqlEnum("status", ["draft", "confirmed", "cancelled"]).default("draft").notNull(),
  createdByUserId: int("createdByUserId").references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("stock_transfer_reference_unique").on(table.organizationId, table.reference)]);

// Receipt/payment vouchers ("سند قبض/صرف") — distinct from `payments`
// (which is invoice-centric); these post directly against a cash box and an
// arbitrary chart-of-accounts line, matching the competitor's
// accounts::cash / receiving modules.
export const cashVouchers = mysqlTable("cash_vouchers", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  cashBoxId: int("cashBoxId").notNull().references(() => cashBoxes.id),
  counterAccountId: int("counterAccountId").notNull().references(() => chartAccounts.id),
  customerId: int("customerId").references(() => customers.id),
  kind: mysqlEnum("kind", ["receipt", "payment"]).notNull(),
  reference: varchar("reference", { length: 80 }).notNull(),
  amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
  description: varchar("description", { length: 255 }),
  journalEntryId: int("journalEntryId").references(() => journalEntries.id),
  createdByUserId: int("createdByUserId").references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("cash_voucher_reference_unique").on(table.organizationId, table.reference)]);

// ===========================================================================
// ADVANCED VOUCHER CATEGORIES/PACKAGES — multi-tier pricing (retail/
// wholesale/wholesale-of-wholesale) and direct MikroTik profile linkage,
// matching the competitor's catagory + groups pages.
// ===========================================================================

export const voucherCategories = mysqlTable("voucher_categories", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  name: varchar("name", { length: 120 }).notNull(),
  priceType: mysqlEnum("priceType", ["fixed", "customer"]).default("fixed").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  prefix: varchar("prefix", { length: 12 }),
  defaultAmount: decimal("defaultAmount", { precision: 12, scale: 2 }),
  maxAmount: decimal("maxAmount", { precision: 12, scale: 2 }),
  minAmount: decimal("minAmount", { precision: 12, scale: 2 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("voucher_category_name_unique").on(table.organizationId, table.name)]);

export const voucherCategoryPrices = mysqlTable("voucher_category_prices", {
  id: int("id").autoincrement().primaryKey(),
  categoryId: int("categoryId").notNull().references(() => voucherCategories.id),
  tier: mysqlEnum("tier", ["retail", "wholesale", "wholesale_of_wholesale"]).notNull(),
  price: decimal("price", { precision: 12, scale: 2 }).notNull(),
}, table => [uniqueIndex("voucher_category_price_unique").on(table.categoryId, table.tier)]);

export const voucherGroups = mysqlTable("voucher_groups", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  categoryId: int("categoryId").references(() => voucherCategories.id),
  name: varchar("name", { length: 140 }).notNull(),
  limitUsers: int("limitUsers").default(1).notNull(),
  voucherCodeLength: int("voucherCodeLength").default(10).notNull(),
  timeBalanceMinutes: int("timeBalanceMinutes"),
  downloadBalanceMb: int("downloadBalanceMb"),
  cardValidityDays: int("cardValidityDays"),
  speedProfileId: int("speedProfileId").references(() => speedProfiles.id),
  mikrotikProfile: varchar("mikrotikProfile", { length: 140 }),
  linkWithFirstMac: int("linkWithFirstMac").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("voucher_group_name_unique").on(table.organizationId, table.name)]);

// ===========================================================================
// CARD DESIGN STUDIO + PRINT QUEUE — pixel-level layout spec (matches the
// competitor's design/last_design payload) plus a print-job queue that a PDF
// renderer consumes.
// ===========================================================================

export const cardDesigns = mysqlTable("card_designs", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  name: varchar("name", { length: 120 }).notNull(),
  isDefault: int("isDefault").default(0).notNull(),
  cardWidthMm: decimal("cardWidthMm", { precision: 6, scale: 2 }).default("90").notNull(),
  cardHeightMm: decimal("cardHeightMm", { precision: 6, scale: 2 }).default("50").notNull(),
  cardBorderColor: varchar("cardBorderColor", { length: 16 }).default("#6d28d9").notNull(),
  backgroundImageKey: varchar("backgroundImageKey", { length: 600 }),
  watermarkOpacity: int("watermarkOpacity").default(0).notNull(),
  watermarkPosition: mysqlEnum("watermarkPosition", ["center", "top", "bottom"]).default("center").notNull(),
  printSerialAsBarcode: int("printSerialAsBarcode").default(1).notNull(),
  printCardQrCode: int("printCardQrCode").default(1).notNull(),
  // Per-field layout (position/font/style) for card_no, password, serial_no,
  // group_name, and the printed date — stored as one JSON blob (`fields`)
  // since the shape mirrors the competitor's arbitrary nested `options`
  // object and each org needs full freedom to add/rearrange fields.
  fields: text("fields").notNull(),
  createdByUserId: int("createdByUserId").references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("card_design_name_unique").on(table.organizationId, table.name)]);

export const printJobs = mysqlTable("print_jobs", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  batchId: int("batchId").notNull().references(() => voucherBatches.id),
  designId: int("designId").notNull().references(() => cardDesigns.id),
  status: mysqlEnum("status", ["queued", "rendering", "ready", "failed"]).default("queued").notNull(),
  fileId: int("fileId").references(() => files.id),
  errorMessage: text("errorMessage"),
  createdByUserId: int("createdByUserId").references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("print_job_org_status_idx").on(table.organizationId, table.status)]);

// ===========================================================================
// CUSTOM REPORT BUILDER — user-defined report definitions with a filter/
// column spec, optional recurring schedule, and generated exports. The
// competitor gates this behind a 30-day "extra password"; we gate it behind
// the normal fine-grained permission system instead (reports:builder) plus a
// per-organization optional PIN in `reportBuilderAccess`.
// ===========================================================================

export const reportDefinitions = mysqlTable("report_definitions", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  name: varchar("name", { length: 140 }).notNull(),
  dataset: mysqlEnum("dataset", ["customers", "invoices", "payments", "vouchers", "sessions", "journal_entries", "support_tickets"]).notNull(),
  columns: text("columns").notNull(),
  filters: text("filters"),
  createdByUserId: int("createdByUserId").references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("report_definition_name_unique").on(table.organizationId, table.name)]);

export const reportSchedules = mysqlTable("report_schedules", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  reportDefinitionId: int("reportDefinitionId").notNull().references(() => reportDefinitions.id),
  frequency: mysqlEnum("frequency", ["daily", "weekly", "monthly"]).notNull(),
  isEnabled: int("isEnabled").default(1).notNull(),
  lastRunAt: timestamp("lastRunAt"),
  nextRunAt: timestamp("nextRunAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("report_schedule_org_idx").on(table.organizationId)]);

export const reportExports = mysqlTable("report_exports", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  reportDefinitionId: int("reportDefinitionId").notNull().references(() => reportDefinitions.id),
  fileId: int("fileId").references(() => files.id),
  status: mysqlEnum("status", ["queued", "generating", "ready", "failed"]).default("queued").notNull(),
  rowCount: int("rowCount"),
  createdByUserId: int("createdByUserId").references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("report_export_org_idx").on(table.organizationId, table.createdAt)]);

// ===========================================================================
// BACKUP SYSTEM — snapshot metadata (the actual dump bytes live in `files`
// via the existing storage service, category "backup").
// ===========================================================================

export const backupJobs = mysqlTable("backup_jobs", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  status: mysqlEnum("status", ["queued", "running", "ready", "failed", "restoring", "restored"]).default("queued").notNull(),
  fileId: int("fileId").references(() => files.id),
  sizeBytes: int("sizeBytes"),
  errorMessage: text("errorMessage"),
  createdByUserId: int("createdByUserId").references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
}, table => [index("backup_job_org_idx").on(table.organizationId, table.createdAt)]);

// ===========================================================================
// SERVER MONITOR — per-organization monitoring config + latest resource
// sample, matches the competitor's MonitorScriptVariables/battery alerts.
// ===========================================================================

export const monitorSettings = mysqlTable("monitor_settings", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id).unique(),
  rebootable: int("rebootable").default(1).notNull(),
  shutdownable: int("shutdownable").default(1).notNull(),
  batteryNotification: int("batteryNotification").default(0).notNull(),
  batteryNotificationType: mysqlEnum("batteryNotificationType", ["telegram", "sms", "email"]).default("telegram").notNull(),
  batteryWarningPercentage: int("batteryWarningPercentage").default(50).notNull(),
  batteryCriticalPercentage: int("batteryCriticalPercentage").default(10).notNull(),
  // Destination chat id for the Telegram battery alert (bot token itself is
  // a single process-wide secret via TELEGRAM_BOT_TOKEN env var — see
  // server/notifications.ts — since the bot is shared across all tenants,
  // only the destination chat differs per organization).
  telegramChatId: varchar("telegramChatId", { length: 64 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const monitorSamples = mysqlTable("monitor_samples", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  cpuPercent: int("cpuPercent"),
  memoryPercent: int("memoryPercent"),
  diskPercent: int("diskPercent"),
  batteryPercent: int("batteryPercent"),
  serviceStatus: mysqlEnum("serviceStatus", ["healthy", "degraded", "down"]).default("healthy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("monitor_sample_org_created_idx").on(table.organizationId, table.createdAt)]);

// ===========================================================================
// POINTS / LOYALTY — customer point balances, ledger of earn/redeem events,
// and configurable benefit tiers (matches points_minimum_amount +
// benefit_limits from the competitor's points settings page).
// ===========================================================================

export const pointsSettings = mysqlTable("points_settings", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id).unique(),
  minimumAmount: decimal("minimumAmount", { precision: 12, scale: 2 }).default("0").notNull(),
  isEnabled: int("isEnabled").default(0).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const pointsBenefitTiers = mysqlTable("points_benefit_tiers", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  name: varchar("name", { length: 120 }).notNull(),
  requiredPoints: int("requiredPoints").notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
}, table => [index("points_tier_org_idx").on(table.organizationId)]);

export const customerPointBalances = mysqlTable("customer_point_balances", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  customerId: int("customerId").notNull().references(() => customers.id).unique(),
  balance: int("balance").default(0).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const pointLedgerEntries = mysqlTable("point_ledger_entries", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  customerId: int("customerId").notNull().references(() => customers.id),
  kind: mysqlEnum("kind", ["earn", "redeem", "adjust"]).notNull(),
  points: int("points").notNull(),
  reason: varchar("reason", { length: 200 }),
  createdByUserId: int("createdByUserId").references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("point_ledger_org_customer_idx").on(table.organizationId, table.customerId)]);

// ===========================================================================
// SMS GATEWAY — provider configuration + outbound message log.
// ===========================================================================

export const smsSettings = mysqlTable("sms_settings", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id).unique(),
  serverType: mysqlEnum("serverType", ["cloud", "local_modem"]).default("cloud").notNull(),
  simCardsCount: mysqlEnum("simCardsCount", ["one", "two"]).default("one").notNull(),
  defaultSimCard: int("defaultSimCard").default(1).notNull(),
  sendingType: mysqlEnum("sendingType", ["auto", "manual"]).default("auto").notNull(),
  secretRef: varchar("secretRef", { length: 255 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const smsMessages = mysqlTable("sms_messages", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  customerId: int("customerId").references(() => customers.id),
  toNumber: varchar("toNumber", { length: 40 }).notNull(),
  body: varchar("body", { length: 640 }).notNull(),
  status: mysqlEnum("status", ["queued", "sent", "failed"]).default("queued").notNull(),
  createdByUserId: int("createdByUserId").references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("sms_message_org_created_idx").on(table.organizationId, table.createdAt)]);

// ===========================================================================
// COMPETITIONS / GAMIFICATION
// ===========================================================================

export const competitions = mysqlTable("competitions", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  name: varchar("name", { length: 160 }).notNull(),
  easyPoints: int("easyPoints").default(5).notNull(),
  mediumPoints: int("mediumPoints").default(7).notNull(),
  hardPoints: int("hardPoints").default(10).notNull(),
  duration: mysqlEnum("duration", ["daily", "weekly", "one_time"]).default("daily").notNull(),
  questionsPerDuration: int("questionsPerDuration").default(10).notNull(),
  status: mysqlEnum("status", ["draft", "active", "ended"]).default("draft").notNull(),
  startsAt: timestamp("startsAt"),
  endsAt: timestamp("endsAt"),
  createdByUserId: int("createdByUserId").references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("competition_org_status_idx").on(table.organizationId, table.status)]);

export const competitionQuestions = mysqlTable("competition_questions", {
  id: int("id").autoincrement().primaryKey(),
  competitionId: int("competitionId").notNull().references(() => competitions.id),
  difficulty: mysqlEnum("difficulty", ["easy", "medium", "hard"]).notNull(),
  question: text("question").notNull(),
  correctAnswer: varchar("correctAnswer", { length: 400 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("competition_question_idx").on(table.competitionId)]);

export const competitionEntries = mysqlTable("competition_entries", {
  id: int("id").autoincrement().primaryKey(),
  competitionId: int("competitionId").notNull().references(() => competitions.id),
  customerId: int("customerId").notNull().references(() => customers.id),
  pointsEarned: int("pointsEarned").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("competition_entry_unique").on(table.competitionId, table.customerId)]);

// ===========================================================================
// LIVE CHAT SUPPORT — real-time admin<->customer chat, additive to the
// existing ticket/message system (supportTickets/supportMessages remain the
// async, staff-facing thread; chatThreads/chatMessages are the
// customer-facing live-chat surface, polled by the client for near-real-time
// delivery since Cloudflare Workers/Pages has no persistent WebSocket server).
// ===========================================================================

export const chatThreads = mysqlTable("chat_threads", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  customerId: int("customerId").references(() => customers.id),
  subject: varchar("subject", { length: 200 }),
  status: mysqlEnum("status", ["open", "closed"]).default("open").notNull(),
  lastMessageAt: timestamp("lastMessageAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("chat_thread_org_status_idx").on(table.organizationId, table.status, table.lastMessageAt)]);

export const chatMessages = mysqlTable("chat_messages", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  threadId: int("threadId").notNull().references(() => chatThreads.id),
  senderKind: mysqlEnum("senderKind", ["staff", "customer"]).notNull(),
  senderUserId: int("senderUserId").references(() => users.id),
  body: text("body").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("chat_message_thread_idx").on(table.threadId, table.createdAt)]);

// ===========================================================================
// TWO-FACTOR AUTHENTICATION (TOTP) — competitor only exposes a
// "two-factor secret key" confirm-password gate (from live audit); we ship
// a complete RFC-6238 TOTP flow: encrypted secret, QR provisioning, and
// one-time recovery codes (also encrypted, single-use, invalidated on use).
// ===========================================================================
export const twoFactorSecrets = mysqlTable("two_factor_secrets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id).unique(),
  secretCiphertext: text("secretCiphertext").notNull(),
  secretIv: varchar("secretIv", { length: 32 }).notNull(),
  secretAuthTag: varchar("secretAuthTag", { length: 32 }).notNull(),
  // JSON array of { codeHash, usedAt } — codes are bcrypt-hashed, never
  // stored/returned in plaintext after initial generation.
  recoveryCodes: text("recoveryCodes").notNull(),
  confirmedAt: timestamp("confirmedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ===========================================================================
// PERSONAL ACCESS TOKENS (API) — matches the competitor's Sanctum-based
// user/api-tokens page (create/read/update/delete abilities), but adds a
// per-token IP allowlist and organization scoping the competitor lacks.
// ===========================================================================
export const apiTokens = mysqlTable("api_tokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  organizationId: int("organizationId").references(() => organizations.id),
  name: varchar("name", { length: 140 }).notNull(),
  tokenHash: varchar("tokenHash", { length: 255 }).notNull().unique(),
  tokenPrefix: varchar("tokenPrefix", { length: 16 }).notNull(),
  // JSON array subset of ["create","read","update","delete"].
  abilities: text("abilities").notNull(),
  ipAllowlist: text("ipAllowlist"),
  lastUsedAt: timestamp("lastUsedAt"),
  expiresAt: timestamp("expiresAt"),
  revokedAt: timestamp("revokedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("api_token_user_idx").on(table.userId)]);

// ===========================================================================
// MAC SECURITY (macsec) — device allow/deny lists + duplicate-MAC policy +
// per-organization dynamic policy items (offer_blacklist_own_mac,
// offer_dublicated_list, ...), matching the competitor's AplusService/MacSec
// module 1:1 while adding a live action audit trail it doesn't expose.
// ===========================================================================
export const macSecurityRules = mysqlTable("mac_security_rules", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  macAddress: varchar("macAddress", { length: 17 }).notNull(),
  listType: mysqlEnum("listType", ["whitelist", "blacklist"]).notNull(),
  reason: varchar("reason", { length: 255 }),
  customerId: int("customerId").references(() => customers.id),
  createdByUserId: int("createdByUserId").references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("mac_rule_unique").on(table.organizationId, table.macAddress, table.listType), index("mac_rule_org_idx").on(table.organizationId)]);

export const macSecurityActionLogs = mysqlTable("mac_security_action_logs", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  macAddress: varchar("macAddress", { length: 17 }).notNull(),
  action: mysqlEnum("action", ["block", "unblock"]).notNull(),
  triggeredByUserId: int("triggeredByUserId").references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("mac_action_log_org_idx").on(table.organizationId, table.createdAt)]);

// ===========================================================================
// HOTSPOT CAPTIVE-PORTAL LOGIN PAGE BUILDER — matches the competitor's
// login-page::AplusService/LoginPage module: a customizable branded login
// page served to hotspot clients, with logo/background/colors/terms text
// and an optional per-voucher-group scope.
// ===========================================================================
export const hotspotLoginPages = mysqlTable("hotspot_login_pages", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  name: varchar("name", { length: 140 }).notNull(),
  isDefault: int("isDefault").default(0).notNull(),
  logoImageKey: varchar("logoImageKey", { length: 600 }),
  backgroundImageKey: varchar("backgroundImageKey", { length: 600 }),
  primaryColor: varchar("primaryColor", { length: 16 }).default("#6d28d9").notNull(),
  welcomeTitle: varchar("welcomeTitle", { length: 200 }),
  welcomeBody: text("welcomeBody"),
  termsText: text("termsText"),
  // JSON array of voucherGroup IDs this page is restricted to; empty/null = all groups.
  voucherGroupScope: text("voucherGroupScope"),
  createdByUserId: int("createdByUserId").references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("hotspot_login_page_name_unique").on(table.organizationId, table.name)]);

// ===========================================================================
// REPORT BUILDER PRO — categories, a curated safe SQL editor (SELECT-only,
// validated + sandboxed, owner-gated + optional extra PIN — the competitor
// gates the *entire* module behind a static 30-day password; we gate the
// dangerous SQL-editor sub-feature specifically instead, so category/
// definition browsing stays available to any reports:builder holder),
// saved/shared filters, dynamic parameter definitions, and multi-channel
// (email + Telegram) delivery scheduling with a full run/failure log.
// ===========================================================================
export const reportBuilderAccess = mysqlTable("report_builder_access", {
  organizationId: int("organizationId").notNull().references(() => organizations.id).primaryKey(),
  pinHash: varchar("pinHash", { length: 255 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const reportCategories = mysqlTable("report_categories", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  name: varchar("name", { length: 120 }).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("report_category_name_unique").on(table.organizationId, table.name)]);

export const reportParameterDefinitions = mysqlTable("report_parameter_definitions", {
  id: int("id").autoincrement().primaryKey(),
  reportDefinitionId: int("reportDefinitionId").notNull().references(() => reportDefinitions.id),
  key: varchar("key", { length: 80 }).notNull(),
  label: varchar("label", { length: 160 }).notNull(),
  fieldType: mysqlEnum("fieldType", ["text", "number", "date", "date_range", "select", "sort"]).default("text").notNull(),
  expectedValues: text("expectedValues"),
  isRequired: int("isRequired").default(0).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
}, table => [uniqueIndex("report_parameter_unique").on(table.reportDefinitionId, table.key)]);

export const reportSavedFilters = mysqlTable("report_saved_filters", {
  id: int("id").autoincrement().primaryKey(),
  reportDefinitionId: int("reportDefinitionId").notNull().references(() => reportDefinitions.id),
  name: varchar("name", { length: 140 }).notNull(),
  filterJson: text("filterJson").notNull(),
  isShared: int("isShared").default(0).notNull(),
  createdByUserId: int("createdByUserId").references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("report_saved_filter_unique").on(table.reportDefinitionId, table.name)]);

export const reportScheduleDeliveries = mysqlTable("report_schedule_deliveries", {
  id: int("id").autoincrement().primaryKey(),
  reportScheduleId: int("reportScheduleId").notNull().references(() => reportSchedules.id),
  channel: mysqlEnum("channel", ["email", "telegram"]).notNull(),
  target: varchar("target", { length: 255 }).notNull(),
  lastDeliveryStatus: mysqlEnum("lastDeliveryStatus", ["pending", "sent", "failed"]).default("pending").notNull(),
  lastDeliveryAt: timestamp("lastDeliveryAt"),
  failureCount: int("failureCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("report_delivery_schedule_idx").on(table.reportScheduleId)]);

export const reportScheduleLogs = mysqlTable("report_schedule_logs", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  reportScheduleId: int("reportScheduleId").references(() => reportSchedules.id),
  level: mysqlEnum("level", ["info", "warning", "error"]).default("info").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("report_schedule_log_org_idx").on(table.organizationId, table.createdAt)]);

// ===========================================================================
// CUSTOMER SUPPORT PRO — extends the existing async supportTickets/
// supportMessages pair (kept untouched) with live-chat-style metadata the
// competitor's Customer-support::Admin/AdvancedChat module exposes: device
// info (browser/platform/IP) and hotspot-node info captured at ticket
// creation time, plus a channel discriminator.
// ===========================================================================
export const supportTicketDeviceInfo = mysqlTable("support_ticket_device_info", {
  id: int("id").autoincrement().primaryKey(),
  ticketId: int("ticketId").notNull().references(() => supportTickets.id).unique(),
  ipAddress: varchar("ipAddress", { length: 64 }),
  userAgent: varchar("userAgent", { length: 400 }),
  routerId: int("routerId").references(() => routers.id),
  macAddress: varchar("macAddress", { length: 17 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ===========================================================================
// CARD / VOUCHER IMPORT JOBS — matches the competitor's Import/Cards +
// Import/SqliteImport + Wizard/Import (MikroTik UserManager) modules: a
// tracked import job with duplicate/invalid row counters and a quota check
// before committing (the competitor's sqlite.import.export-over-quota).
// ===========================================================================
export const cardImportJobs = mysqlTable("card_import_jobs", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  source: mysqlEnum("source", ["csv", "mikrotik_sqlite", "mikrotik_wizard"]).notNull(),
  status: mysqlEnum("status", ["queued", "validating", "importing", "ready", "failed"]).default("queued").notNull(),
  fileId: int("fileId").references(() => files.id),
  totalRows: int("totalRows").default(0).notNull(),
  importedRows: int("importedRows").default(0).notNull(),
  duplicateRows: int("duplicateRows").default(0).notNull(),
  invalidRows: int("invalidRows").default(0).notNull(),
  quotaExceeded: int("quotaExceeded").default(0).notNull(),
  errorLog: text("errorLog"),
  createdByUserId: int("createdByUserId").references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
}, table => [index("card_import_job_org_idx").on(table.organizationId, table.createdAt)]);

// ===========================================================================
// VOUCHER BULK ACTIONS — matches the competitor's cards.bulk.* routes
// (destroy/group-change/stop applied to many cards at once) with async
// progress tracking via the existing backgroundJobs table pattern.
// ===========================================================================
export const voucherBulkActions = mysqlTable("voucher_bulk_actions", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  actionType: mysqlEnum("actionType", ["delete", "group_change", "stop"]).notNull(),
  voucherIds: text("voucherIds").notNull(),
  targetGroupId: int("targetGroupId").references(() => voucherGroups.id),
  status: mysqlEnum("status", ["queued", "running", "done", "failed"]).default("queued").notNull(),
  affectedCount: int("affectedCount").default(0).notNull(),
  createdByUserId: int("createdByUserId").references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
}, table => [index("voucher_bulk_action_org_idx").on(table.organizationId, table.createdAt)]);

// ===========================================================================
// MONITOR ACTION LOG — the competitor's monitor.reboot / monitor.shutdown
// are REAL trigger endpoints (confirmed via Ziggy route audit); Netora
// executes the equivalent through the existing MikroTik integration
// (server/mikrotik.ts) and records every trigger here for accountability —
// a control the competitor's UI does not expose.
// ===========================================================================
export const monitorActionLogs = mysqlTable("monitor_action_logs", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  routerId: int("routerId").references(() => routers.id),
  action: mysqlEnum("action", ["reboot", "shutdown"]).notNull(),
  status: mysqlEnum("status", ["queued", "sent", "failed"]).default("queued").notNull(),
  triggeredByUserId: int("triggeredByUserId").references(() => users.id),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("monitor_action_log_org_idx").on(table.organizationId, table.createdAt)]);

// ===========================================================================
// BACKUP SCHEDULING — the competitor runs backups on a fixed cron with no
// visible per-tenant control; Netora exposes frequency + retention as
// tenant-configurable settings, evaluated lazily on request (Cloudflare
// Pages hosted deploys cannot rely on cron triggers — see project rules).
// ===========================================================================
export const backupSchedules = mysqlTable("backup_schedules", {
  organizationId: int("organizationId").notNull().references(() => organizations.id).primaryKey(),
  frequency: mysqlEnum("frequency", ["every_6h", "every_12h", "daily", "weekly"]).default("daily").notNull(),
  retentionDays: int("retentionDays").default(30).notNull(),
  isEnabled: int("isEnabled").default(1).notNull(),
  lastRunAt: timestamp("lastRunAt"),
  nextRunAt: timestamp("nextRunAt"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ===========================================================================
// SMS TEMPLATE ENGINE — matches the competitor's sms_template_* fields with
// a Mustache-style conditional block syntax ({{#var}}...{{/var}}) and named
// variable namespaces (direct notification vs scheduled notification), but
// generalized into a proper templates table instead of hardcoded settings
// keys, so an organization can define unlimited custom templates.
// ===========================================================================
export const smsTemplates = mysqlTable("sms_templates", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  key: varchar("key", { length: 80 }).notNull(),
  name: varchar("name", { length: 140 }).notNull(),
  namespace: mysqlEnum("namespace", ["direct", "scheduled", "custom"]).default("custom").notNull(),
  body: text("body").notNull(),
  isSystem: int("isSystem").default(0).notNull(),
  createdByUserId: int("createdByUserId").references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("sms_template_key_unique").on(table.organizationId, table.key)]);

// ===========================================================================
// DYNAMIC SETTINGS ITEMS ENGINE — generalizes the competitor's per-module
// "service.items" metadata pattern (name/shown_name/field_type/
// expected_values/shown_condation/shown_order/value, observed identically
// on macsec, change_group, change_speed, points, charging_points, sms
// settings pages) into ONE reusable, extensible engine covering every
// module instead of duplicating hardcoded settings tables per feature. This
// is a structural improvement over the competitor: adding a new
// configurable option to any module is a data row here, not a schema
// migration + new Vue settings page.
// ===========================================================================
export const dynamicSettingsItems = mysqlTable("dynamic_settings_items", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  module: varchar("module", { length: 60 }).notNull(),
  key: varchar("key", { length: 80 }).notNull(),
  label: varchar("label", { length: 200 }).notNull(),
  fieldType: mysqlEnum("fieldType", ["select", "text", "checkbox", "time", "textarea", "number"]).default("text").notNull(),
  expectedValues: text("expectedValues"),
  conditionField: varchar("conditionField", { length: 80 }),
  conditionOp: varchar("conditionOp", { length: 8 }),
  conditionValue: varchar("conditionValue", { length: 200 }),
  minValue: int("minValue"),
  maxValue: int("maxValue"),
  notice: varchar("notice", { length: 400 }),
  sortOrder: decimal("sortOrder", { precision: 8, scale: 3 }).default("1").notNull(),
  value: text("value"),
  updatedByUserId: int("updatedByUserId").references(() => users.id),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("dynamic_settings_item_unique").on(table.organizationId, table.module, table.key), index("dynamic_settings_org_module_idx").on(table.organizationId, table.module)]);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
