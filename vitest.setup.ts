// Ensures test runs see the same environment variables (DATABASE_URL,
// JWT_SECRET, SECRET_ENCRYPTION_KEY, etc.) that the real server loads via
// `dotenv/config` in server/_core/index.ts. Without this, vitest processes
// only see whatever happens to already be exported in the parent shell,
// which is not guaranteed — tests that depend on a real DB connection
// (e.g. tenant isolation checks that expect FORBIDDEN, not
// INTERNAL_SERVER_ERROR, when the DB is reachable) would then fail flakily
// depending on how the test runner was invoked.
import "dotenv/config";
