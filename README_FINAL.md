# Netora Post-Audit Implementation Notes

This document reflects the resolution of several P0 and P1 security, data-integrity, and architectural defects identified during the latest systems audit.

### Platform Console vs Tenant Console Separation
The platform console (`/platform`) is distinctly separate from the tenant console (`/dashboard`). The frontend routing enforces this UI separation, while backend tRPC procedures natively assert either `role === 'admin'` (Platform Owner) or query the `organizationMembers` table (Tenant Owner/Staff) to enforce data boundaries.
A Tenant Owner can *never* access platform-level plans, subscriptions, or global metrics, while a Platform Owner cannot accidentally mutate a tenant’s `network_sessions` or `vouchers` unless explicitly assuming a support role mapped back through the DB constraints.

### Platform Billing vs Tenant Billing Separation
Platform billing relates to operators paying Netora for SaaS usage (handled via `platformInvoices` and `platformPayments`). Tenant billing involves ISP customers paying their WISP/ISP for internet access (handled via `invoices` and `payments`).
There is zero overlap in these tables. Webhooks for platform payments cannot inadvertently update tenant customer balances due to distinct table targeting and strict invoice reference validation.

### Cross-Tenant Isolation
Extensive modifications, specifically to `server/_core/storageProxy.ts`, ensure that direct object-key access is impossible without authenticated context verifying `organizationId` matching. This effectively neutralizes IDOR (Insecure Direct Object Reference) vulnerabilities for sensitive files.

### Platform Admin Bootstrap Security
The system previously relied on an environment variable (`OWNER_EMAIL`) to automatically promote a newly registered user to `admin`. This insecure process has been removed. Initialization of the Platform Owner account must now occur via the secure CLI script `server/bootstrap_admin.ts`, ensuring that outside actors cannot hijack the environment configuration during the initial application rollout.

### Support & Operations Visibility
Platform administrators retain selective visibility into tenant resources (such as active router sync status) solely for the purpose of global operational health monitoring and technical support. This visibility is strictly read-only unless an explicit support intervention is authorized, and resources are never modeled as "owned" by the platform.
