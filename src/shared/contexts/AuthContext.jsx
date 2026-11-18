// ─────────────────────────────────────────────────────────────────────────────
// AuthContext.jsx — who is signed in, whether they still are, and what they
// may see.
//
// ─── A token is not access ──────────────────────────────────────────────────
// Signing in and being allowed in here are two different events. `POST
// /auth/login` is the same endpoint every HR and every employee on HR Clouds
// uses; it hands a valid token to anybody with a password. Whether that token
// means anything in THIS console is decided by `GET /platform/me`, which the
// server answers from a fresh database read every single time.
//
// So the console bootstraps by calling it on every start, not by trusting the
// `role` claim it could read out of the token for free. That one extra call
// is what makes revocation immediate: a staff member whose access was removed
// ninety seconds ago is refused on their next request rather than when their
// token expires three days from now.
//
// ─── Four ways a session can end, and they are not the same ────────────────
//   expired       401 — the token ran out. Sign in again.
//   revoked       403 PLATFORM_ACCESS_REVOKED — was staff, no longer is.
//   not_platform  403 PLATFORM_ACCESS_REQUIRED — never was staff. Different
//                 sentence entirely: nothing has been taken from them, they
//                 are at the wrong door. Telling this person their "access
//                 was revoked" would send them to ask about a grant that
//                 never existed.
//   unreachable   500 / 503 — the guard could not reach its database and
//                 failed closed. This is NOT a logout. Keep the token, show
//                 a retry; signing someone out over our own outage loses
//                 their place for no reason.
// ─────────────────────────────────────────────────────────────────────────────
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { ACCESS_REVOKED_EVENT, authAPI, platformAPI, SESSION_EXPIRED_EVENT, tokenHelper } from "../api";
import { canAccessTier, PLATFORM_ERROR, PLATFORM_ERROR_COPY } from "../../config/platformAccess";

const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/** Why the last session ended, in the words the sign-in screen will use. */
export const ENDED = {
  EXPIRED: "expired",
  REVOKED: "revoked",
  NOT_PLATFORM: "not_platform",
};

export function AuthProvider({ children }) {
  // The actor is never read from localStorage. It is what the server last
  // said, or nothing — a cached copy of "you are a Super Admin" is exactly
  // the claim this whole design refuses to trust.
  const [actor, setActor] = useState(null);
  // "booting" until the first /platform/me settles. Screens behind the gate
  // must not flash the sign-in page while we are still asking.
  const [status, setStatus] = useState(() => (tokenHelper.get() ? "booting" : "anonymous"));
  const [bootstrapError, setBootstrapError] = useState(null);
  const [endedReason, setEndedReason] = useState(null);

  // Survives re-renders so a bootstrap that resolves after the component
  // re-mounted (StrictMode runs effects twice in dev) can't apply twice.
  const bootToken = useRef(0);

  const endSession = useCallback((reason) => {
    tokenHelper.clear();
    setActor(null);
    setBootstrapError(null);
    setStatus("anonymous");
    setEndedReason(reason);
  }, []);

  /**
   * Ask the server who we are. The single place the console learns its own
   * access, used for the first boot and for the retry after an outage.
   */
  const bootstrap = useCallback(async () => {
    const ticket = ++bootToken.current;
    if (!tokenHelper.get()) {
      setStatus("anonymous");
      return;
    }
    setStatus("booting");
    setBootstrapError(null);
    try {
      const me = await platformAPI.getMe();
      if (ticket !== bootToken.current) return; // a newer boot already won
      setActor(me);
      setEndedReason(null);
      setStatus("ready");
    } catch (err) {
      if (ticket !== bootToken.current) return;
      if (err.code === PLATFORM_ERROR.ACCESS_REQUIRED) return endSession(ENDED.NOT_PLATFORM);
      if (err.code === PLATFORM_ERROR.ACCESS_REVOKED) return endSession(ENDED.REVOKED);
      // 401 already cleared the token and fired SESSION_EXPIRED; the listener
      // below has set the reason. Anything else is ours, not theirs: hold the
      // session and offer to try again.
      if (err.status === 401) return;
      setBootstrapError(err);
      setStatus("error");
    }
  }, [endSession]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    const onExpired = () => endSession(ENDED.EXPIRED);
    const onRevoked = () => endSession(ENDED.REVOKED);
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    window.addEventListener(ACCESS_REVOKED_EVENT, onRevoked);
    return () => {
      window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
      window.removeEventListener(ACCESS_REVOKED_EVENT, onRevoked);
    };
  }, [endSession]);

  /**
   * Sign in, then immediately ask whether that means anything here.
   *
   * The second call is not belt-and-braces. Without it an HR manager with a
   * perfectly good HR Clouds password would land inside the console shell and
   * only discover the truth when the first screen's read came back 403 —
   * having already been shown a menu of every organisation on the platform.
   * They are turned away at the door instead, with their token discarded.
   */
  const login = useCallback(
    async ({ identifier, password }) => {
      const res = await authAPI.login({ identifier, password });
      const { accessToken, refreshToken } = authAPI.extractTokens(res);
      if (!accessToken) throw new Error("Sign-in didn’t return a session. Try again.");
      tokenHelper.save(accessToken, refreshToken);

      try {
        const me = await platformAPI.getMe();
        setActor(me);
        setEndedReason(null);
        setBootstrapError(null);
        setStatus("ready");
        return me;
      } catch (err) {
        // Their password was right; this console is simply not theirs. Drop
        // the token rather than leaving a half-session on the machine.
        tokenHelper.clear();
        setStatus("anonymous");
        if (err.code === PLATFORM_ERROR.ACCESS_REQUIRED) {
          throw new Error(PLATFORM_ERROR_COPY[PLATFORM_ERROR.ACCESS_REQUIRED]);
        }
        if (err.code === PLATFORM_ERROR.ACCESS_REVOKED) {
          throw new Error(PLATFORM_ERROR_COPY[PLATFORM_ERROR.ACCESS_REVOKED]);
        }
        throw new Error(PLATFORM_ERROR_COPY[PLATFORM_ERROR.AUTH_INTERNAL]);
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    await authAPI.logout();
    setActor(null);
    setBootstrapError(null);
    setEndedReason(null);
    setStatus("anonymous");
  }, []);

  const value = useMemo(
    () => ({
      actor,
      tier: actor?.tier || null,
      /** `can(TIER.ADMIN)` — may the person in front of us see that? */
      can: (requiredTier) => canAccessTier(actor?.tier, requiredTier),
      isAuthenticated: status === "ready" && Boolean(actor),
      isBooting: status === "booting",
      bootstrapError: status === "error" ? bootstrapError : null,
      endedReason,
      retryBootstrap: bootstrap,
      login,
      logout,
    }),
    [actor, status, bootstrapError, endedReason, bootstrap, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
