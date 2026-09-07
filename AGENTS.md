Netora — AGENTS.md

«Persistent engineering constitution for AI coding agents working on Netora.

This file defines non-negotiable engineering, security, business, architecture, and production rules.

Task-specific prompts may add requirements, but must never weaken these rules.»

---

1. Project Mission

Netora is a production-grade, multi-tenant network management and ISP/WISP operations platform.

Its purpose is to provide organizations operating networks/ISPs with a secure workspace for managing their network infrastructure and business operations.

Core Business Model

Netora has two fundamentally different levels:

Platform

The Platform Owner owns and operates Netora itself.

The Platform is responsible for:

- organizations / tenants
- tenant provisioning
- platform plans
- subscriptions
- platform billing
- platform payments
- platform configuration
- platform administration
- platform reporting
- platform-wide operational controls

Tenant

A Tenant Organization is an independent network/ISP operator using Netora.

Tenant users manage only their organization's:

- users
- customers
- routers
- sites
- service plans
- speed profiles
- RADIUS
- vouchers
- sessions
- invoices
- customer payments
- accounting
- support
- notifications
- monitoring
- reports
- backups
- network operations

Critical Business Invariant

«Platform administration and tenant operations are separate domains.»

Platform subscription billing is NOT tenant customer billing.

A tenant must never receive platform-owner privileges merely because it is an organization owner.

A tenant owner is the owner of that tenant organization, not the owner of Netora.

---

2. Source of Truth

When documentation conflicts with implementation, use this order:

1. Current source code
2. Database schema and migrations
3. Tests
4. API contracts
5. Documentation / README

Never claim a feature exists merely because documentation says it exists.

Never invent:

- APIs
- database columns
- environment variables
- integrations
- provider capabilities
- permissions
- business rules
- infrastructure services

Before changing architecture, inspect the existing repository and understand the current implementation.

Do not blindly trust historical documentation, previous AI output, comments, screenshots, or TODO files.

---

3. Required Working Method

For every non-trivial task:

1. Inspect the repository.
2. Identify relevant frontend, backend, database, worker, infrastructure, integration, and test code.
3. Establish the current baseline.
4. Identify existing functionality that already works.
5. Create a concrete implementation plan.
6. Implement the smallest coherent production-grade change.
7. Run the strongest available verification.
8. Fix failures caused by the change.
9. Review the resulting diff for regressions and security issues.
10. Verify tenant isolation and authorization.
11. Verify database integrity and concurrency implications.
12. Verify relevant UI states.
13. Do not report success without evidence.

Prefer incremental, reviewable changes over speculative rewrites.

Do not rewrite large parts of Netora unless the existing architecture demonstrably requires it.

Preserve Working Functionality

Never replace correct existing functionality merely because another implementation appears more elegant.

Before refactoring:

- understand the current behavior
- identify dependencies
- verify existing tests
- preserve externally visible contracts where possible
- migrate incrementally when required

Do not introduce architecture theater.

Do not add infrastructure merely because it sounds sophisticated.

---

4. Architecture Boundaries

Netora has two fundamentally different domains.

Platform Domain

Controlled by the Platform Owner:

- organizations / tenants
- tenant provisioning
- plans
- subscriptions
- platform invoices
- platform payments
- platform configuration
- platform reporting
- platform administration
- platform-wide operational controls

Tenant Domain

Controlled by each Tenant Organization:

- tenant users
- customers
- routers
- sites
- service plans
- speed profiles
- RADIUS
- vouchers
- sessions
- invoices
- customer payments
- accounting
- support
- notifications
- monitoring
- reports
- backups
- network operations

Never mix these domains.

Platform subscription billing is NOT tenant customer billing.

Platform administration must NOT be exposed through the normal tenant console.

---

5. Platform Console vs Tenant Console

The frontend must clearly distinguish:

Platform Console

For Platform Owner / platform administrators.

It may manage:

- organizations
- tenant provisioning
- platform plans
- subscriptions
- platform billing
- platform payments
- platform-wide settings
- platform operational information

Tenant Console

For tenant users.

It may manage only resources belonging to the authenticated user's authorized organization.

Frontend route visibility is not authorization.

Backend authorization is mandatory.

A hidden platform route is not a security boundary.

---

6. Multi-Tenant Security — P0

Every tenant-owned resource must have an authoritative organization boundary.

Never trust client-supplied identifiers as proof of authorization:

- organizationId
- tenantId
- ownerId
- routerId
- customerId
- invoiceId
- fileId
- jobId
- sessionId
- voucherId
- reportId
- backupId
- support ticket ID
- resource IDs of any kind

Authorization must derive tenant context from authenticated server-side membership.

Preferred architecture:

Authenticated User
        ↓
Membership / Tenant Access Resolution
        ↓
Tenant Context
        ↓
Tenant-Scoped Repository / Query
        ↓
Resource

Avoid unscoped queries against tenant-owned tables.

Every new tenant-owned table must have an explicit tenant ownership strategy.

Every new tenant-owned endpoint must have authorization tests.

---

7. Cross-Tenant Attack Test

Always consider:

Tenant A → read Tenant B       = DENY
Tenant A → update Tenant B     = DENY
Tenant A → delete Tenant B     = DENY
Tenant A → router Tenant B     = DENY
Tenant A → files Tenant B     = DENY
Tenant A → jobs Tenant B      = DENY
Tenant A → reports Tenant B   = DENY
Tenant A → backups Tenant B   = DENY
Tenant A → sessions Tenant B  = DENY
Tenant A → invoices Tenant B  = DENY
Tenant A → infer Tenant B     = DENY

Cross-tenant isolation is a P0 requirement.

"Cannot see it in the UI" is not sufficient.

---

8. Platform Owner vs Tenant Roles

Tenant roles may include:

- owner
- manager
- operator
- accountant
- support
- viewer

The Platform Owner is NOT simply a tenant user with additional permissions.

Never grant platform privileges through tenant-role escalation.

Never treat:

platform admin

as equivalent to:

tenant owner

Owner Invariant

Every organization must maintain a valid owner.

The final organization owner must not be removable or demotable unless ownership is safely transferred.

Ownership transfer must be:

- authorized
- validated
- atomic
- audited
- recoverable

---

9. Authentication

Authentication must preserve:

- secure password hashing
- password policy
- session expiration
- session revocation
- account lockout protection
- secure token handling
- 2FA security
- password reset security
- email verification where required

Never store plaintext passwords.

Never log:

- passwords
- session tokens
- reset tokens
- 2FA secrets
- authentication secrets

Authentication decisions must be server-side.

---

10. Authentication Bootstrap

Platform-owner bootstrap is security-critical.

Do not automatically grant platform-admin privileges solely because a newly registered account matches a configured email address.

Avoid insecure patterns such as:

if user.email === OWNER_EMAIL
    role = admin

unless protected by a secure, explicit, one-time bootstrap process.

Preferred approaches include:

- one-time bootstrap secret
- pre-provisioned administrator
- controlled deployment initialization
- verified ownership process

Bootstrap credentials must never be committed to source control.

---

11. Password Lifecycle

Production authentication should support:

- password change
- secure password reset
- email verification where required
- session revocation after sensitive credential changes
- protection against token reuse
- secure reset-token expiration
- single-use reset tokens

Do not implement security controls only in the frontend.

All authentication security decisions must be enforced server-side.

Never transmit placeholder passwords or fake credentials as part of real authentication flows.

---

12. Session Security

Long-lived stateless JWTs must not be treated as equivalent to fully revocable sessions.

Production session architecture should support:

- expiration
- revocation
- session identification
- invalidation after sensitive security events
- logout invalidation where appropriate
- password-change invalidation
- role/permission-change invalidation
- suspicious-session invalidation

If JWTs remain part of the architecture, use an appropriate short lifetime and server-side revocation/versioning mechanism where practical.

Never rely on a client-side token store as the security boundary.

---

13. Two-Factor Authentication

2FA challenges must be:

- short-lived
- tied to the intended authentication flow
- one-time use
- resistant to replay
- invalidated after successful use

Do not use reusable stateless challenges where the same valid challenge can simply be replayed during its lifetime.

Sensitive operations may require recent authentication or step-up authentication.

---

14. Authorization / RBAC

Authorization is always server-side.

Frontend visibility is NOT authorization.

Every protected mutation must verify:

1. authentication
2. platform/tenant scope
3. required permission
4. resource ownership
5. additional requirements for high-risk operations

Never create authorization bypasses through:

- alternate API routes
- tRPC procedures
- REST endpoints
- exports
- file endpoints
- background jobs
- integrations
- internal services

Custom roles and permissions must have correct persistence and database relationships.

Database relationships must enforce valid custom-role ownership.

---

15. High-Risk Operations

Treat the following as high-risk:

- router reboot
- router shutdown
- router configuration changes
- credential changes
- network-wide changes
- customer disconnection
- financial state changes
- subscription changes
- destructive deletion
- backup deletion
- secret access
- API token operations
- role changes
- owner changes

High-risk operations require appropriate:

- authorization
- validation
- tenant ownership verification
- audit logging
- confirmation
- idempotency where appropriate
- step-up authentication where appropriate
- safe failure behavior

Never allow AI features to bypass these controls.

---

16. MikroTik / Network Infrastructure

Netora may communicate with MikroTik RouterOS.

Rules:

- Never disable TLS certificate verification merely to make a connection work.
- Never silently downgrade secure protocols.
- Never claim API-SSL support when implementation actually uses REST.
- Clearly distinguish REST, API-SSL, SSH, and other protocols.
- Encrypt router credentials at rest.
- Verify router ownership before every sensitive operation.
- Apply strict connection and request timeouts.
- Protect against SSRF through user-controlled router addresses.
- Validate network destinations.
- Audit dangerous operations.
- Never expose router credentials to frontend code.
- Never log router passwords.

Production security defaults must remain secure.

If self-signed certificates are required for controlled environments, support an explicit trusted CA/configuration mechanism rather than silently disabling certificate validation.

---

17. Router Safety

Router operations must be treated as external side effects.

Before executing a dangerous operation:

Authenticated Actor
        ↓
Tenant Membership
        ↓
Permission
        ↓
Router Ownership
        ↓
Operation Validation
        ↓
Safety Policy
        ↓
Audit
        ↓
Queue / Controlled Execution
        ↓
Read Back
        ↓
Verify

Do not assume a successful HTTP response means the router reached the intended state.

Where possible:

Apply
  ↓
Read Back
  ↓
Verify Desired State

---

18. RADIUS

RADIUS endpoints are security-sensitive.

Rules:

- Fail closed when shared-secret authentication is required but missing or invalid.
- Never silently accept unauthenticated accounting traffic in production.
- Validate NAS/router ownership.
- Validate event identity and state transitions.
- Make accounting processing idempotent.
- Protect against replay and duplicate events.
- Reject malformed protocol values.
- Reject invalid counter values rather than silently converting them to zero.
- Handle accounting ordering and counter rollover safely.
- Never trust arbitrary tenant IDs supplied by external traffic.
- Apply appropriate rate limiting.
- Never log RADIUS shared secrets.

RADIUS accounting must never create cross-tenant sessions.

---

19. Background Jobs / Workers

Background jobs are part of the security boundary.

Rules:

- Job ownership must be tenant-safe.
- Job handlers must validate job organization.
- Related resources must belong to the same organization.
- Job claiming must be safe with multiple workers.
- Use leases/visibility timeouts where appropriate.
- Recover jobs stuck in "running".
- Retry transient failures.
- Bound retry counts.
- Preserve idempotency.
- Never place plaintext secrets in job payloads.
- Never execute arbitrary commands from job payloads.
- Never trust job payload organization IDs without verifying persisted ownership.
- Never allow a stale worker to complete a job after another worker has safely reclaimed it.

Worker Fencing

Where multiple workers may execute jobs, use appropriate lease fencing such as:

- lease owner
- lease version
- fencing token
- atomic claim condition

A worker must verify that it still owns the job before committing side effects.

---

20. Job Handler Truthfulness

A job handler must never report successful completion when the requested operation was not actually implemented.

For example, a placeholder/no-op handler must not return:

success

merely because the function executed without throwing.

If functionality is unavailable:

- fail explicitly
- record the reason
- expose an honest operational state
- retry only when appropriate

Never create false operational confidence.

---

21. Storage and Files

Files are tenant-owned unless explicitly platform-owned.

Rules:

- Verify file ownership before read/download/delete.
- Never allow arbitrary storage-key access.
- Storage proxy endpoints must resolve files through authorized database records.
- Do not trust client MIME type alone.
- Validate file content/magic bytes where appropriate.
- Enforce file-size limits.
- Prevent path traversal.
- Prevent accidental public exposure.
- Handle orphaned objects.
- Never expose storage credentials.
- Use short-lived signed URLs.
- Do not treat storage keys as authorization credentials.

A storage key must never become an authorization mechanism.

Any endpoint resembling:

/api/storage/<raw-storage-key>

must not bypass tenant authorization.

Preferred model:

Authenticated User
        ↓
Tenant Authorization
        ↓
File ID
        ↓
Database Ownership Check
        ↓
Storage Object Resolution
        ↓
Short-Lived Signed URL

---

22. Storage Consistency

Object storage and database writes may fail independently.

Handle:

Object uploaded
DB insert failed

and:

DB record created
Object unavailable

through appropriate reconciliation/cleanup mechanisms.

Do not leave unbounded orphaned objects.

---

23. API Security

All APIs must enforce the same security model.

Review for:

- IDOR / BOLA
- authentication bypass
- privilege escalation
- SSRF
- CSRF where applicable
- XSS
- SQL injection
- command injection
- path traversal
- unsafe deserialization
- mass assignment
- replay attacks
- rate-limit bypass
- information leakage
- insecure direct object references
- unsafe file access

Validate all external input server-side.

---

24. Webhooks

Webhook endpoints must:

- authenticate/verify the source
- preserve and verify the original request body where signatures require it
- validate payloads
- prevent replay where applicable
- be idempotent
- validate state transitions
- avoid trusting arbitrary financial values
- avoid logging secrets
- process state changes atomically

Missing authentication must not silently result in acceptance.

Webhook uniqueness must reflect the provider's identity model.

Where appropriate use:

(provider, eventId)

rather than assuming event IDs are globally unique across all providers.

---

25. Payments and Financial Data

Payment processing is security- and correctness-critical.

Rules:

- Verify webhook signatures/authentication.
- Validate provider identity.
- Use correct composite idempotency.
- Process webhook effects atomically.
- Validate invoice ownership.
- Validate amount against trusted server-side invoice data.
- Validate currency.
- Validate allowed state transitions.
- Prevent duplicate financial effects.
- Use database transactions for financial mutations.
- Protect against race conditions.
- Audit financial changes.

Never trust client-supplied:

- payment status
- amount
- currency
- invoice ownership
- payment completion

Financial state must come from trusted server-side records and authenticated provider data.

---

26. Financial Domain Separation

Netora contains at least two distinct financial domains:

Platform Financial Domain

Examples:

- tenant subscription
- platform invoice
- platform payment
- subscription state

Tenant Financial Domain

Examples:

- tenant customer invoice
- customer payment
- accounting
- service charges

Never accidentally update a platform invoice using tenant payment logic or vice versa.

Use explicit domain boundaries in:

- database tables
- repositories
- routers
- authorization
- services
- tests

---

27. Financial Concurrency

Financial operations must remain correct under concurrent requests.

Use appropriate:

- database transactions
- row locking
- atomic updates
- unique constraints
- idempotency keys
- state-machine validation

Never assume only one request can arrive at a time.

Test:

same payment × multiple requests
same webhook × multiple deliveries
same invoice × concurrent updates
same subscription × concurrent transitions

---

28. Database Rules

Every schema change must consider:

- tenant ownership
- foreign keys
- unique constraints
- indexes
- nullability
- cascading behavior
- deletion behavior
- concurrency
- migration safety
- backwards compatibility
- query plans

Do not silently destroy existing data.

Do not introduce destructive migrations without an explicit migration strategy.

Do not add indexes blindly.

For high-volume tables consider:

- indexing
- pagination
- retention
- archival
- query plans
- workload measurements

Use real query analysis where available.

---

29. Database Integrity

Business invariants should be enforced as close to the database as practical.

Use:

- foreign keys
- unique constraints
- check constraints where supported
- transactions
- atomic updates

Do not rely exclusively on application-level validation for invariants that the database can safely enforce.

For potentially destructive migrations prefer:

Add
 ↓
Backfill
 ↓
Switch
 ↓
Verify
 ↓
Remove

---

30. Soft Deletion and Retention

Before destructive deletion, verify:

- ownership
- dependencies
- financial/audit requirements
- active sessions
- active jobs
- backup implications
- referential integrity

Prefer soft deletion or archival where retention is required.

Never hard-delete financial or audit records merely to simplify UI behavior.

Deletion policies must be explicit rather than inconsistent across domains.

---

31. Express / HTTP Security

Production HTTP infrastructure should provide appropriate:

- security headers
- rate limiting
- body-size limits
- request timeouts
- CORS policy
- proxy configuration
- graceful shutdown
- health endpoints
- readiness checks
- safe error handling
- request correlation IDs

Production should bind to a configured fixed port.

Do not use automatic port scanning as a production deployment strategy.

Never expose a production database publicly without explicit security controls.

---

32. Rate Limiting

In-memory rate limiting is not sufficient for horizontally scaled production when shared enforcement is required.

For distributed deployment, use an appropriate shared mechanism such as Redis.

Rate limits must not become inconsistent security controls across application instances.

Rate limiting should exist at multiple appropriate layers:

Edge / WAF
    ↓
Load Balancer
    ↓
Application
    ↓
Sensitive Endpoint

Application rate limiting alone is not DDoS protection.

---

33. Secrets

Sensitive secrets include:

- database credentials
- JWT secrets
- encryption keys
- router credentials
- RADIUS shared secrets
- payment secrets
- API keys
- SMTP/SMS credentials
- cloud credentials
- storage credentials

Rules:

- Never commit real secrets.
- Never print secrets.
- Encrypt sensitive credentials at rest.
- Keep secrets outside source code.
- Support key rotation/versioning where practical.
- Minimize secret exposure.
- Audit sensitive secret access.
- Never expose secrets to frontend code.
- Never place plaintext secrets in jobs.
- Never put secrets into URLs.

Never use hardcoded fallback production credentials.

---

34. Observability

Production should provide:

- structured logs
- request correlation IDs
- useful error context
- metrics
- health/readiness checks
- worker visibility
- job monitoring
- security audit logs
- dependency health visibility

Never log:

- passwords
- session tokens
- API tokens
- encryption keys
- payment secrets
- RADIUS shared secrets
- router credentials

Do not claim observability exists unless it is actually implemented and connected to production paths.

---

35. Health and Readiness

Health endpoints must distinguish between:

Liveness

and:

Readiness

Readiness should verify critical dependencies sufficiently to determine whether the instance can safely serve traffic.

For example:

Application alive
        ≠
Database ready
        ≠
Worker ready
        ≠
External integrations healthy

Do not report "ready" merely because a database object exists in memory.

---

36. Audit Logging

Audit security-sensitive actions, including:

- authentication/security changes
- role changes
- owner changes
- secret access
- router changes
- dangerous router operations
- financial mutations
- subscription changes
- destructive actions
- API token operations
- network-wide changes

Audit entries should identify:

- actor
- action
- target
- tenant/platform scope
- timestamp
- useful non-sensitive context
- correlation/request ID where appropriate

Never store raw secrets in audit records.

---

37. Backups / Disaster Recovery

Backups are production infrastructure.

Verify:

- backup ownership
- tenant isolation
- security/encryption
- retention
- failure handling
- restore process
- job recovery
- monitoring
- integrity
- off-site availability where required

A backup that has never been restored successfully should not be treated as a verified recovery strategy.

Define and verify:

- RPO
- RTO

A production backup strategy must include actual restore testing.

---

38. Frontend Architecture

Maintain clear separation between:

Platform Console

and:

Tenant Console

Frontend route visibility is not security.

Backend authorization is always mandatory.

Important actions should support:

- default
- loading
- success
- error
- empty
- disabled
- permission denied
- offline/retry where appropriate

Never leave fake buttons that imply functionality that does not exist.

If a quick action is displayed, it must perform the actual intended action or navigate to the real workflow.

---

39. UI / UX

Netora should be:

- responsive
- accessible
- RTL-friendly
- Arabic-compatible
- usable on weak connections
- visually consistent
- keyboard accessible
- clear for destructive operations
- consistent in loading/error/empty states
- honest about unavailable integrations

Avoid unnecessary network requests and heavy assets.

Do not introduce unrelated visual redesigns during backend/security tasks.

---

40. Offline / Degraded UX

The application should distinguish between:

No data

and:

Network unavailable

and:

Server unavailable

and:

Permission denied

and:

Integration unavailable

Where appropriate provide:

- retry
- stale-data indication
- graceful degradation
- mutation failure recovery
- user-visible status

Never display successful UI state when the server did not confirm success.

---

41. Performance

Prefer:

- server-side pagination
- cursor pagination for large datasets
- indexed queries
- bounded result sets
- debounced search
- lazy loading
- route-level code splitting
- efficient caching
- avoiding N+1 queries
- request deduplication where appropriate

Do not hide backend performance problems behind frontend tricks.

For large historical datasets consider:

- retention
- archival
- partitioning where justified
- query optimization

Measure before optimizing.

---

42. Idempotency

Important mutations should be designed for retries.

Where appropriate:

Client
  ↓
Idempotency-Key
  ↓
API
  ↓
Validated Operation
  ↓
Database Unique Constraint
  ↓
Atomic Mutation

Idempotency is especially important for:

- payments
- webhooks
- financial mutations
- router operations
- customer disconnection
- provisioning
- job execution
- bulk actions

Never rely only on frontend prevention of duplicate clicks.

---

43. Background Queue Architecture

The existing durable database-backed job system may remain the correct architecture for current scale.

Do not introduce Redis, BullMQ, Kafka, RabbitMQ, Kubernetes, or other infrastructure merely for appearance.

Introduce shared queue infrastructure when actual requirements justify it.

For horizontal scale, a possible evolution is:

WAF / CDN
      ↓
Load Balancer
      ↓
Stateless API Replicas
      ↓
Shared Cache / Rate Limit
      ↓
Durable Queue
      ↓
Worker Pool
      ↓
MariaDB / Object Storage / Integrations

Any migration from database-backed jobs to a queue system must preserve:

- durability
- idempotency
- retry semantics
- tenant isolation
- observability
- recovery
- ordering where required

---

44. Redis

Redis is appropriate when there is a demonstrated requirement for:

- distributed rate limiting
- shared caching
- session infrastructure
- distributed coordination
- queue infrastructure

Do not use Redis as the authoritative store for financial data.

Do not introduce Redis merely because "production systems use Redis."

Caching must never bypass authorization.

Tenant-sensitive cached data must include tenant-safe cache keys and invalidation behavior.

---

45. Horizontal Scaling

If Netora is horizontally scaled:

- API instances must be stateless where practical.
- Shared security state must not depend on process memory.
- Rate limits must be distributed.
- sessions must be revocable across instances.
- workers must coordinate safely.
- storage must be shared.
- database connections must be bounded.
- migrations must be deployment-safe.
- observability must correlate requests across instances.

Do not claim horizontal scalability without verifying these properties.

---

46. CDN / Edge Infrastructure

CDN/WAF infrastructure should be considered for large-scale deployment.

Use CDN for appropriate:

- static assets
- immutable frontend bundles
- public assets

Private tenant files must remain protected by authorization and short-lived signed access.

CDN caching must never leak tenant-specific private data.

WAF/edge controls should be used for:

- abusive traffic
- common web attacks
- rate limiting
- bot mitigation where appropriate
- DDoS absorption

---

47. Network Digital Twin / Safety Compiler

Advanced Netora network automation should follow a desired-state architecture:

Desired State
      ↓
Current State
      ↓
Diff
      ↓
Validation
      ↓
Safe Change Plan
      ↓
Approval
      ↓
Queue
      ↓
Apply
      ↓
Read Back
      ↓
Verification
      ↓
Rollback if required

Never allow AI to directly execute arbitrary:

- shell commands
- SQL
- router commands
- scripts
- unrestricted HTTP requests

AI/network automation must use typed, explicitly authorized tools.

The AI may propose actions.

Server-side authorization and safety validation make the final decision.

---

48. Change Journal

Network changes should become auditable state transitions.

Where appropriate record:

Who
What
Why
Target
Previous State
Desired State
Validation
Approval
Execution
Result
Verification
Rollback

The Change Journal must not expose secrets.

It should support troubleshooting and accountability.

---

49. AI Safety

AI output is untrusted input.

Never allow AI to bypass:

- authentication
- RBAC
- tenant isolation
- approval requirements
- secret controls
- financial controls
- network safety controls

AI tools must have:

- explicit schemas
- input validation
- authorization checks
- tenant context
- audit logging
- safe failure behavior
- bounded capabilities

Never create an unrestricted:

executeAnything(...)

style tool.

AI must not directly become a privileged system administrator.

---

50. Safety Compiler

Any AI-generated network action should pass through a server-side safety layer.

Conceptually:

AI Intent
   ↓
Typed Command
   ↓
Schema Validation
   ↓
Tenant Authorization
   ↓
Permission Check
   ↓
Safety Rules
   ↓
Conflict Detection
   ↓
Risk Classification
   ↓
Approval if Required
   ↓
Execution

Unsafe or ambiguous actions must fail closed.

---

51. API Tokens

If API tokens are supported:

- store secure hashes where practical
- display plaintext only at creation
- support revocation
- enforce scopes/permissions
- associate tokens with tenant/user context
- audit creation/revocation where appropriate
- never log token values
- expire tokens where appropriate

A tenant API token must never automatically become a platform-admin credential.

---

52. ISP / WISP Workflow Integrity

Netora should support coherent workflows across:

Tenant
 ↓
Sites
 ↓
Routers
 ↓
Customers
 ↓
Service Plans
 ↓
Speed Profiles
 ↓
RADIUS
 ↓
Sessions
 ↓
Vouchers
 ↓
Billing
 ↓
Accounting
 ↓
Support
 ↓
Monitoring

When changing one domain, inspect dependent domains.

Examples:

- deleting a router with active sessions
- disabling a service plan used by customers
- deleting a voucher batch with unused vouchers
- changing a speed profile referenced by active services
- removing a RADIUS integration with active sessions

Do not allow destructive operations that silently break active business workflows.

---

53. No Fake Features

Never implement UI-only simulations presented as real functionality.

Unacceptable examples:

- fake router connection success
- fake payment success
- fake RADIUS state
- fake backup completion
- fake SMS delivery
- fake monitoring health
- fake AI execution
- fake report generation
- fake provisioning
- fake job completion

If an integration/provider is unavailable, show an honest:

- unavailable
- configuration required
- failed
- pending
- degraded

state.

---

54. Error Handling

Errors must:

- fail safely
- avoid exposing sensitive internals
- provide useful client-safe messages
- preserve server-side diagnostics
- remain consistent
- be actionable where appropriate

Never expose to untrusted clients:

- database credentials
- secrets
- internal tokens
- SQL
- unnecessary filesystem paths
- sensitive stack traces
- provider credentials

---

55. Testing

Every meaningful feature change should add or update appropriate tests.

Authorization

Test:

- unauthenticated → denied
- wrong tenant → denied
- wrong role → denied
- correct permission → allowed
- platform/tenant boundary → enforced
- owner invariant → enforced

Security

Test where applicable:

- IDOR/BOLA
- privilege escalation
- replay
- invalid signatures
- malformed input
- path traversal
- SSRF
- secret leakage
- storage-key bypass
- webhook replay

Financial

Test:

- duplicate webhook
- concurrent payment
- amount mismatch
- currency mismatch
- invalid state transition
- duplicate payment reference
- platform/tenant domain separation

Network

Test:

- router ownership
- invalid credentials
- TLS failure
- timeout
- dangerous operation authorization
- RADIUS secret validation
- malformed accounting
- duplicate accounting
- cross-tenant router access

Worker

Test:

- atomic claiming
- retry
- stuck-job recovery
- tenant mismatch
- related-resource mismatch
- idempotency
- lease expiration
- fencing

Do not delete tests simply to make the build pass.

---

56. Verification

Use the strongest verification actually available.

Typical commands:

npm run check
npm test -- --runInBand
npm run build

If the repository uses pnpm, prefer the repository's configured package manager and scripts.

If dependencies or infrastructure prevent execution:

- state exactly what could not be run
- do not fabricate results
- perform static verification
- inspect affected code paths
- report the limitation

"Looks correct" is not equivalent to:

tested successfully

---

57. Security Regression Review

After security-sensitive changes, explicitly review:

- authentication
- authorization
- tenant isolation
- storage access
- worker access
- webhook access
- network operations
- secrets
- logs
- error responses

Perform at least one deliberate "attacker mindset" review.

Ask:

«"If I controlled a low-privilege tenant account, what identifier or endpoint could I manipulate to cross a boundary?"»

---

58. Dependencies

Before adding a dependency:

1. Check whether the current stack already provides the capability.
2. Check compatibility.
3. Check runtime/bundle cost.
4. Check security and maintenance.
5. Check licensing where relevant.
6. Add it only when justified.

Do not perform unrelated major dependency upgrades.

---

59. Docker / Deployment

Production deployment should separate:

Build
  ↓
Migration
  ↓
Application Runtime
  ↓
Worker Runtime

Do not depend on development-only packages in production runtime images.

Do not expose production databases unnecessarily.

Never commit production secrets into Docker Compose or images.

Prefer dedicated migrations instead of automatically mutating the database every time the application starts.

Application startup should not unexpectedly perform destructive schema operations.

---

60. Database Migrations

Every migration must be:

- intentional
- reviewable
- reproducible
- safe for existing data
- compatible with deployment ordering where required

For potentially destructive changes prefer:

Add
 ↓
Backfill
 ↓
Switch
 ↓
Verify
 ↓
Remove

Never silently drop production data.

---

61. Graceful Shutdown

Production services must handle shutdown correctly.

On shutdown:

- stop accepting new work
- finish or safely release in-flight work where practical
- stop workers safely
- release database resources
- release network resources
- avoid corrupting job state
- respect a bounded shutdown timeout

A worker must not leave jobs permanently stuck in a running state merely because the process exited.

---

62. Data Consistency Across API / DB / UI

When changing a feature, inspect the complete path:

Database
   ↓
Repository / Service
   ↓
API / tRPC
   ↓
Client Query
   ↓
Mutation
   ↓
UI

Verify:

- field names
- nullability
- enum values
- permissions
- error states
- loading states
- cache invalidation
- optimistic updates
- server confirmation

Never consider a feature complete merely because the backend compiles.

---

63. Frontend Route Performance

For large applications:

- use route-level lazy loading where appropriate
- avoid loading every dashboard panel on initial page load
- split heavy features
- avoid unnecessary JavaScript
- avoid loading admin-only code for ordinary tenant users where practical

Performance optimization must not weaken authorization.

---

64. Configuration Validation

Production configuration should be validated at startup.

Required secrets and configuration must fail clearly when missing.

Avoid dangerous defaults such as:

change-me
password
secret
placeholder

Production must not silently fall back to insecure configuration.

Configuration errors should be explicit and actionable.

---

65. No Placeholder Security

Never leave security-sensitive placeholders such as:

- fake passwords
- placeholder authentication values
- temporary authorization bypasses
- disabled signature checks
- disabled TLS verification
- fake secret values
- development-only credentials

in production paths.

Temporary development behavior must be clearly isolated from production behavior.

---

66. No Architecture Theater

Do not introduce:

- Redis without a real need
- Kafka without a real need
- Kubernetes without a real need
- microservices without a real boundary
- multiple databases without a real requirement
- unnecessary abstractions
- excessive event buses

The architecture must solve real Netora problems.

Prefer:

Simple + Correct + Observable + Secure

over:

Complex + Impressive + Fragile

---

67. Production Readiness

Do not use the following as proof of production readiness:

- successful TypeScript compilation alone
- successful frontend build alone
- a working demo
- screenshots
- mocked integrations
- documentation claims
- a single happy-path test

Production readiness requires:

- security
- tenant isolation
- correctness
- financial integrity
- network safety
- observability
- reliability
- testing
- recovery
- deployment verification
- honest integration behavior

---

68. Completion Criteria

A task is complete only when:

- requested functionality is implemented
- authorization is correct
- tenant isolation is preserved
- relevant tests exist or were updated
- available verification has been executed
- no obvious regression remains
- migrations are safe
- UI states are handled
- security-sensitive changes are reviewed
- documentation is updated when behavior/configuration changes
- final claims are evidence-based

For major tasks, perform a final self-review as if attempting to break the implementation.

---

69. Priority Order

When requirements conflict, use this priority:

1. Security
2. Tenant isolation
3. Data integrity
4. Financial correctness
5. Network safety
6. Reliability / recoverability
7. Correct functionality
8. Performance
9. Accessibility / UX
10. Visual polish

Never sacrifice a higher-priority invariant for convenience.

---

70. Final Engineering Principle

Build Netora as a real production platform, not a demo.

Every feature must be:

- real
- authorized
- tenant-safe
- observable
- testable
- recoverable
- maintainable

The agent's job is not merely to make the code compile.

The agent must preserve Netora's business boundaries and security model while continuously improving:

- correctness
- security
- reliability
- performance
- usability
- scalability
- recoverability
- production readiness

«Never trade security, tenant isolation, data integrity, financial correctness, or network safety for speed of implementation.»

«Never claim functionality, security, scalability, or production readiness without evidence.»

«Preserve what already works. Improve what is deficient. Replace architecture only when evidence shows that replacement is necessary.»
