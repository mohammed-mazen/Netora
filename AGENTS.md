Netora — AGENTS.md

«Persistent engineering constitution for AI coding agents working on Netora.
This file defines non-negotiable rules. Task-specific prompts may add requirements, but must not weaken these rules.»

---

1. Project Mission

Netora is a production-grade, multi-tenant network management and ISP/WISP operations platform.

Core business model:

- The Platform Owner owns and operates Netora itself.
- Tenant Organizations are network/ISP operators who rent/use workspace on Netora.
- Tenant users manage their own customers, routers, services, vouchers, billing, RADIUS, support, reports, and network operations.
- Platform billing/subscriptions are separate from tenant operational billing.

Critical invariant

«A tenant must never be able to read, modify, delete, infer, or operate on another tenant's data or infrastructure.»

---

2. Source of Truth

When documentation conflicts with implementation, use this order:

1. Current source code
2. Database schema and migrations
3. Tests
4. API contracts
5. Documentation / README

Never claim a feature exists merely because documentation says it exists.

Do not invent:

- APIs
- database columns
- environment variables
- integrations
- provider capabilities
- permissions
- business rules

Before changing architecture, inspect the existing repository and understand the current implementation.

---

3. Required Working Method

For every non-trivial task:

1. Inspect the repository.
2. Identify relevant frontend, backend, database, worker, infrastructure, and test code.
3. Establish the current baseline.
4. Create a concrete implementation plan.
5. Implement the smallest coherent production-grade change.
6. Run the strongest available verification.
7. Fix failures caused by the change.
8. Review the resulting diff for regressions and security issues.
9. Verify tenant isolation and authorization.
10. Do not report success without evidence.

Prefer incremental, reviewable changes over speculative rewrites.

Do not rewrite large parts of Netora unless the existing architecture demonstrably requires it.

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
- payments
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

5. Multi-Tenant Security — P0

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
- arbitrary resource IDs

Authorization must derive the tenant from authenticated server-side context and verify resource ownership.

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

Cross-Tenant Security Test

Always consider:

Tenant A → read Tenant B     = DENY
Tenant A → update Tenant B   = DENY
Tenant A → delete Tenant B   = DENY
Tenant A → router Tenant B   = DENY
Tenant A → files Tenant B   = DENY
Tenant A → jobs Tenant B    = DENY
Tenant A → reports Tenant B = DENY
Tenant A → backups Tenant B = DENY
Tenant A → infer Tenant B   = DENY

Cross-tenant isolation is a P0 requirement.

---

6. Platform Owner vs Tenant Roles

Do not confuse Platform Owner privileges with tenant roles.

Tenant roles may include:

- owner
- manager
- operator
- accountant
- support
- viewer

The Platform Owner is NOT simply a tenant user with additional permissions.

Never grant platform privileges through tenant-role escalation.

Owner Invariant

Every organization must maintain a valid owner.

The final organization owner must not be removable or demotable unless ownership is safely transferred.

---

7. Authentication

Authentication must preserve:

- secure password hashing
- password policy
- session expiration
- session revocation
- account lockout protection
- secure token handling
- 2FA security
- password reset security

Sensitive authentication changes should support session revocation and/or step-up authentication where appropriate.

Never store plaintext passwords.

Never log passwords or authentication secrets.

---

8. Password Lifecycle

Production authentication should support:

- password change
- secure password reset
- email verification where required
- session revocation after sensitive credential changes
- protection against token reuse

Do not implement security controls only in the frontend.

All authentication security decisions must be enforced server-side.

---

9. Two-Factor Authentication

2FA challenges must be:

- short-lived
- tied to the intended authentication flow
- one-time use
- resistant to replay

Do not use reusable stateless challenges where the same valid challenge can simply be replayed during its lifetime.

Sensitive operations may require recent authentication.

---

10. Authorization / RBAC

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

---

11. High-Risk Operations

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
- audit logging
- tenant ownership verification
- step-up authentication where appropriate

Never allow AI features to bypass these controls.

---

12. MikroTik / Network Infrastructure

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

Production security defaults must remain secure.

---

13. RADIUS

RADIUS endpoints are security-sensitive.

Rules:

- Fail closed when shared-secret authentication is required but missing or invalid.
- Never silently accept unauthenticated accounting traffic in production.
- Validate NAS/router ownership.
- Validate event identity and state transitions.
- Make accounting processing idempotent.
- Protect against replay and duplicate events.
- Never trust arbitrary tenant IDs supplied by external traffic.
- Apply appropriate rate limiting.
- Never log RADIUS shared secrets.

RADIUS accounting must never create cross-tenant sessions.

---

14. Payments and Financial Data

Payment processing is security- and correctness-critical.

Rules:

- Verify webhook signatures/authentication.
- Validate provider identity.
- Use correct composite idempotency where required.
- Process webhook effects atomically.
- Validate invoice ownership.
- Validate amount against trusted server-side invoice data.
- Validate currency.
- Validate allowed state transitions.
- Prevent duplicate financial effects.
- Use database transactions for financial mutations.
- Protect against race conditions.
- Audit financial changes.

Never trust client-supplied payment status, amount, currency, or invoice ownership.

Platform subscription payments and tenant customer payments are separate domains.

---

15. Database Rules

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

Do not silently destroy existing data.

Do not introduce destructive migrations without an explicit migration strategy.

Do not add indexes blindly.

For high-volume tables consider:

- indexing
- pagination
- retention
- archival
- query plans

---

16. Financial Concurrency

Financial operations must remain correct under concurrent requests.

Use appropriate:

- database transactions
- row locking
- atomic updates
- unique constraints
- idempotency keys

Never assume only one request can arrive at a time.

---

17. Background Jobs / Workers

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

A worker must never bypass normal tenant authorization.

---

18. Storage and Files

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

A storage key must never become an authorization mechanism.

---

19. API Security

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

Validate all external input server-side.

---

20. Webhooks

Webhook endpoints must:

- authenticate/verify the source
- validate payloads
- prevent replay where applicable
- be idempotent
- validate state transitions
- avoid trusting arbitrary financial values
- avoid logging secrets
- process state changes atomically

Missing authentication must not silently result in acceptance.

---

21. Express / HTTP Security

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

Production should bind to a configured fixed port.

Do not use automatic port scanning as a production deployment strategy.

Never expose a production database publicly without explicit security controls.

---

22. Rate Limiting

In-memory rate limiting is not sufficient for horizontally scaled production when shared enforcement is required.

For distributed deployment, use an appropriate shared mechanism such as Redis.

Rate limits must not become inconsistent security controls across application instances.

---

23. Secrets

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

Never use hardcoded fallback production credentials.

---

24. Observability

Production should provide:

- structured logs
- request correlation IDs
- useful error context
- metrics
- health/readiness checks
- worker visibility
- job monitoring
- security audit logs

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

25. Audit Logging

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

Audit entries should identify:

- actor
- action
- target
- tenant/platform scope
- timestamp
- useful non-sensitive context

Never store raw secrets in audit records.

---

26. Backups / Disaster Recovery

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

A backup that has never been restored successfully should not be treated as a verified recovery strategy.

Do not claim disaster recovery is complete without restore verification.

---

27. Frontend Architecture

Maintain clear separation between:

Platform Console

For Platform Owner administration.

Tenant Console

For tenant users managing their own organization.

Frontend route visibility is not security.

Backend authorization is always mandatory.

Every important action should support appropriate states:

- default
- loading
- success
- error
- empty
- disabled
- permission denied
- offline/retry where appropriate

Never leave fake buttons that imply functionality that does not exist.

---

28. UI / UX

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

Avoid unnecessary network requests and heavy assets.

Do not introduce unrelated visual redesigns during backend/security tasks.

---

29. Performance

Prefer:

- server-side pagination
- cursor pagination for large datasets
- indexed queries
- bounded result sets
- debounced search
- lazy loading
- code splitting
- efficient caching
- avoiding N+1 queries

Do not hide backend performance problems behind frontend tricks.

For large historical datasets consider retention and archival.

---

30. Network Digital Twin / Safety Compiler

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

Server-side authorization and safety validation must make the final decision.

---

31. AI Safety

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

Never create an unrestricted:

executeAnything(...)

style tool.

---

32. API Tokens

If API tokens are supported:

- store secure hashes where practical
- display plaintext only at creation
- support revocation
- enforce scopes/permissions
- associate tokens with tenant/user context
- audit creation/revocation where appropriate
- never log token values

A tenant API token must never automatically become a platform-admin credential.

---

33. Data Deletion

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

---

34. Testing

Every meaningful feature change should add or update appropriate tests.

Authorization

Test:

- unauthenticated → denied
- wrong tenant → denied
- wrong role → denied
- correct permission → allowed
- platform/tenant boundary → enforced

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

Financial

Test:

- duplicate webhook
- concurrent payment
- amount mismatch
- currency mismatch
- invalid state transition

Network

Test:

- router ownership
- invalid credentials
- TLS failure
- timeout
- dangerous operation authorization
- RADIUS secret validation

Worker

Test:

- atomic claiming
- retry
- stuck-job recovery
- tenant mismatch
- idempotency

Do not delete tests simply to make the build pass.

---

35. Verification

Use the strongest verification actually available.

Typical commands:

npm run check
npm test -- --runInBand
npm run build

If dependencies or infrastructure prevent execution:

- state exactly what could not be run
- do not fabricate results
- perform static verification
- inspect affected code paths
- report the limitation

"Looks correct" is not equivalent to "tested successfully."

---

36. Dependencies

Before adding a dependency:

1. Check whether the current stack already provides the capability.
2. Check compatibility.
3. Check runtime/bundle cost.
4. Check security and maintenance.
5. Add it only when justified.

Do not perform unrelated major dependency upgrades.

---

37. Docker / Deployment

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

---

38. Database Migrations

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

39. Error Handling

Errors must:

- fail safely
- avoid exposing sensitive internals
- provide useful client-safe messages
- preserve server-side diagnostics
- remain consistent

Never expose:

- database credentials
- secrets
- internal tokens
- SQL
- unnecessary filesystem paths
- sensitive stack traces

to untrusted clients.

---

40. Code Quality

Prefer:

- strong typing
- clear domain boundaries
- small cohesive functions
- explicit authorization
- tenant-scoped repositories
- consistent naming
- deterministic behavior
- explicit error handling

Avoid:

- unjustified "any"
- hidden global state
- duplicated security logic
- client-side authorization
- giant untestable functions
- security magic constants
- unrelated refactors

Do not refactor unrelated code solely for style.

---

41. No Fake Features

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

If an integration/provider is unavailable, show an honest unavailable/configuration/error state.

---

42. Production Readiness

Do not use the following as proof of production readiness:

- successful TypeScript compilation alone
- successful frontend build alone
- a working demo
- screenshots
- mocked integrations
- documentation claims
- a single happy-path test

Production readiness requires security, isolation, correctness, observability, reliability, testing, and deployment verification.

---

43. Completion Criteria

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

44. Priority Order

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

45. Final Engineering Principle

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
- production readiness

«Never trade security, tenant isolation, data integrity, or network safety for speed of implementation.»
