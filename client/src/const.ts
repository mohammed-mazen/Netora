export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Independent auth uses email/password login (see client/src/pages/Login.tsx
// and the `auth.login` / `auth.register` tRPC mutations) instead of a
// redirect-based OAuth flow. This helper simply navigates to the login page;
// call it from an event handler or effect, e.g. `onClick={() => startLogin()}`.
export const startLogin = () => {
  window.location.href = "/login";
};
