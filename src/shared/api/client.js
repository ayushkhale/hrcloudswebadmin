// ─────────────────────────────────────────────────────────────────────────────
// client.js — the one network client. Every domain module imports `request`
// and `tokenHelper` from here, and no component ever calls fetch itself.
//
// Mirrors HR Clouds Web's client deliberately: same storage keys shape, same
// session-expired event, same error envelope. A developer moving between the
// two repos should not have to learn a second networking story.
// ─────────────────────────────────────────────────────────────────────────────
import { ENV } from "../../config/env";

export const API_BASE_URL = ENV.API_BASE_URL;

// Our own timeout, under nginx's 120s, so a slow call produces our error
// message rather than an HTML 504 we then fail to parse.
const REQUEST_TIMEOUT_MS = 110_000;

const TOKEN_KEY = "hrclouds_console_token";
const REFRESH_TOKEN_KEY = "hrclouds_console_refresh_token";

/** Fired when the stored session stops being valid (a 401, or `exp` passed). */
export const SESSION_EXPIRED_EVENT = "hrclouds-console:session-expired";

/**
 * Read a JWT's claims without verifying it. JWTs are base64url — plain atob()
 * rejects "-" and "_" — and hold UTF-8 JSON, so a name with an accent in it
 * needs a real UTF-8 decode rather than a charCode loop.
 */
export function decodeJWT(token) {
  try {
    const b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), "="));
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0))));
  } catch {
    return null;
  }
}

export const tokenHelper = {
  save(accessToken, refreshToken) {
    if (accessToken && accessToken !== "undefined" && accessToken !== "null") {
      localStorage.setItem(TOKEN_KEY, accessToken);
    }
    if (refreshToken && refreshToken !== "undefined" && refreshToken !== "null") {
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    }
  },
  get() {
    const token = localStorage.getItem(TOKEN_KEY);
    return !token || token === "undefined" || token === "null" ? null : token;
  },
  getRefresh() {
    const token = localStorage.getItem(REFRESH_TOKEN_KEY);
    return !token || token === "undefined" || token === "null" ? null : token;
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },
  /** Expiry in ms since epoch, or null when the token carries no `exp`. */
  expiresAt(token = tokenHelper.get()) {
    const exp = token ? decodeJWT(token)?.exp : null;
    return Number.isFinite(exp) ? exp * 1000 : null;
  },
  isExpired(token = tokenHelper.get()) {
    const at = tokenHelper.expiresAt(token);
    return at != null && at <= Date.now();
  },
};

export function notifySessionExpired() {
  tokenHelper.clear();
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
}

/** `{ a: 1, b: undefined }` → `?a=1`. Empty values are dropped, not sent. */
export function qs(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    if (Array.isArray(value)) value.forEach((v) => search.append(key, v));
    else search.append(key, value);
  });
  const str = search.toString();
  return str ? `?${str}` : "";
}

/**
 * An error the UI can read: `.message` is already the sentence to show, and
 * `.status` lets a caller tell "you may not" from "it broke".
 */
export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export async function request(path, { method = "GET", body, headers = {}, signal } = {}) {
  const token = tokenHelper.get();

  // A token we can already see has expired is not worth a round trip — the
  // server would 401 and we would end up here anyway, a second later.
  if (token && tokenHelper.isExpired(token)) {
    notifySessionExpired();
    throw new ApiError("Your session has expired. Please sign in again.", 401);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  // One abort out of two sources: the caller's cancel, and our timeout.
  signal?.addEventListener("abort", () => controller.abort(), { once: true });

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err.name === "AbortError") throw new ApiError("That took too long. Try again.", 408);
    throw new ApiError("Couldn’t reach the server. Check your connection.", 0);
  }
  clearTimeout(timer);

  const payload = await response.json().catch(() => null);

  if (response.status === 401) {
    notifySessionExpired();
    throw new ApiError(payload?.message || "Your session has expired. Please sign in again.", 401, payload);
  }
  if (!response.ok) {
    throw new ApiError(payload?.message || "Something went wrong. Try again.", response.status, payload);
  }
  return payload;
}
