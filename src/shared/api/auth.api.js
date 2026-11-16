// ─────────────────────────────────────────────────────────────────────────────
// auth.api.js — signing in to the platform plane.
//
// This is NOT the tenant login. A person who administers one organisation on
// HR Clouds cannot sign in here, and nothing in this console accepts a tenant
// token: the two planes keep separate credentials on purpose, so a compromised
// HR account can never reach across organisations.
// ─────────────────────────────────────────────────────────────────────────────
import { request, tokenHelper } from "./client";
import { ENV } from "../../config/env";
import { SAMPLE_VIEWER } from "../../data/sample";

/**
 * `POST /platform/auth/login` → `{ access_token, refresh_token, user }`.
 *
 * The real plane will also demand a second factor — platform staff hold the
 * keys to every customer's data, so a password alone is not enough. The step
 * is designed (vision doc, "Access and accountability") but not built, and
 * this function will grow a `requires_mfa` branch rather than a second one.
 */
export async function login({ email, password }) {
  if (!ENV.USE_SAMPLE_DATA) {
    return request("/platform/auth/login", { method: "POST", body: { email, password } });
  }

  // Sample mode accepts any well-formed credentials. It refuses an empty one
  // so the form's own error path is exercised rather than theoretical.
  await new Promise((resolve) => setTimeout(resolve, 600));
  if (!email || !password) {
    const err = new Error("Enter your email and password.");
    err.status = 400;
    throw err;
  }
  return {
    access_token: `sample.${btoa(email)}.token`,
    refresh_token: "sample.refresh.token",
    user: { ...SAMPLE_VIEWER, email },
  };
}

/** `POST /platform/auth/logout` — best effort; the local token goes either way. */
export async function logout() {
  if (!ENV.USE_SAMPLE_DATA) {
    await request("/platform/auth/logout", { method: "POST" }).catch(() => {});
  }
  tokenHelper.clear();
}

export const authAPI = { login, logout };
