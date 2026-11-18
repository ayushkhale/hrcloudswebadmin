// ─────────────────────────────────────────────────────────────────────────────
// auth.api.js — signing in.
//
// ─── There is no platform login endpoint, and there must not be one ─────────
// Platform staff sign in through the SAME `POST /auth/login` as everyone else.
// A staff member's only membership row is the platform one (`org_id IS NULL`),
// so the existing single-membership path hands back an ordinary token whose
// claims happen to read `{ role: "super-admin", orgId: null }`.
//
// Two consequences, both of which this console depends on:
//
//   1. No organisation picker. The login answer for platform staff is the
//      plain token response, never `requires_org_selection` — staff belong to
//      no organisation, so there is nothing to pick.
//   2. The token is NOT the authority on access. `role` in it is a claim the
//      client may not act on. Whether this person may see the console, and
//      how much of it, comes from `GET /platform/me` — which the server
//      answers from a fresh database read on every single request.
//
// So: this file gets you a token. `platform.api.js#getMe` is what decides
// whether the token is worth anything here.
// ─────────────────────────────────────────────────────────────────────────────
import { request, tokenHelper } from "./client";
import { ENV } from "../../config/env";

/**
 * `POST /auth/login` → `{ success, message, data: { user: { accessToken, … } } }`.
 *
 * `identifier`, not `email`: HR Clouds accounts are keyed by email OR phone,
 * and the field has been called `identifier` across the web app and the API
 * since the beginning. Calling it `email` here would be a third name for one
 * thing and would silently fail for a staff member who signs in with a phone.
 */
export async function login({ identifier, password }) {
  if (!ENV.USE_SAMPLE_DATA) {
    return request("/auth/login", { method: "POST", body: { identifier, password } });
  }

  // Sample mode takes any well-formed credentials, and refuses an empty one
  // so the form's own error path is exercised rather than theoretical.
  await new Promise((resolve) => setTimeout(resolve, 600));
  if (!identifier || !password) {
    const err = new Error("Enter your email and password.");
    err.status = 400;
    throw err;
  }
  return {
    success: true,
    data: { user: { accessToken: `sample.${btoa(identifier)}.token`, refreshToken: "sample.refresh.token" } },
  };
}

/**
 * Pull the tokens out of the login answer.
 *
 * HR Clouds Web carries the same shock absorber, for the same reason: this
 * one response has been seen nested under `data.user`, under `data`, and at
 * the top level, in both camelCase and snake_case, depending on the endpoint
 * and the vintage. Reading all of them costs a few lines here and saves a
 * blank screen on the day a backend deploy moves one.
 */
export function extractTokens(res) {
  const data = res?.data || res || {};
  const user = data.user || res?.user || data;
  const pick = (...keys) => keys.map((k) => user?.[k] ?? data?.[k] ?? res?.[k]).find(Boolean) || null;
  return {
    accessToken: pick("accessToken", "access_token", "token"),
    refreshToken: pick("refreshToken", "refresh_token"),
  };
}

/** `POST /auth/logout` — best effort; the local token goes either way. */
export async function logout() {
  if (!ENV.USE_SAMPLE_DATA) {
    await request("/auth/logout", { method: "POST" }).catch(() => {});
  }
  tokenHelper.clear();
}

export const authAPI = { login, logout, extractTokens };
