# Netora - Runbooks & Operational Guide

## 1. Deployment & Staging
- **Docker Compose:** Use `docker-compose.yml` for isolated deployments. Ensure MariaDB initializes correctly.
- **Environment Variables:** `SECRET_ENCRYPTION_KEY` must be exactly 64 hex characters. `DATABASE_URL` must point to the MariaDB instance.
- **Migrations:** Always run `npm run db:push` (or `drizzle-kit migrate`) before starting the Node process.

## 2. Worker Queue Recovery
- **Issue:** Background jobs (MikroTik health checks, RADIUS disconnects, SMS) are stuck or failed.
- **Diagnosis:** The worker uses `FOR UPDATE SKIP LOCKED`. If a job is stuck in "running", it automatically becomes visible again after 5 minutes (`VISIBILITY_TIMEOUT_MS`).
- **Action:**
  - Check PM2 or Docker logs for `[Worker]`.
  - Terminal failures are moved to dead-letter (status: `failed`). These require manual inspection of `background_jobs` table.

## 3. RouterOS Connection Failures
- **RouterOS 6:** Uses Binary API-SSL on port 8729. Ensure TLS is configured on the router. Connection mode must be `api_ssl`.
- **RouterOS 7:** Uses REST API (HTTPS). Ensure REST is enabled. Connection mode must be `rest_https`.
- **Diagnosis:** Check the `error` field in `MikrotikHealthResult`. If 401/403, reset credentials in the Tenant Dashboard. If timeout, verify firewall/NAT rules.

## 4. Backup & Restore
- **Backup:** Runs automatically based on Tenant Schedule (`backupSchedules`). Uses `mysqldump` if available, falls back to JSON data export.
- **Restore:** Restore operations wipe current tenant data and insert the backup rows. This is guarded by `organizationId` to prevent cross-tenant data corruption.
- **Action:** If a restore fails midway, use the raw JSON/SQL file generated in the `files` table to manually inspect data.
