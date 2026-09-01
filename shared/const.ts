export const COOKIE_NAME = "app_session_id";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';

// Account-lockout policy (brute-force mitigation). Lives here (not in
// server/_core/auth.ts) so both server/db.ts and server/_core/auth.ts can
// import it without creating a circular dependency between those two
// modules (db.ts already exposes helpers auth.ts calls).
export const ACCOUNT_LOCKOUT_THRESHOLD = 5;
export const ACCOUNT_LOCKOUT_DURATION_MS = 15 * 60 * 1000;
