// ─────────────────────────────────────────────────────────────────────────────
// AuthContext.jsx — who is signed in, and whether they still are.
//
// One read of localStorage at startup, then nothing touches the token except
// this file and the api client. A screen asks `useAuth()` and never
// `localStorage.getItem`.
//
// The session can end without anybody clicking sign out — a 401 from any call
// fires SESSION_EXPIRED_EVENT, and this listens for it, so an expired token
// drops the person at the sign-in screen with an explanation instead of an
// error on whatever page they were reading.
// ─────────────────────────────────────────────────────────────────────────────
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { authAPI, decodeJWT, SESSION_EXPIRED_EVENT, tokenHelper } from "../api";

const USER_KEY = "hrclouds_console_user";

const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/** The stored user, if there is a live token to go with it. */
function readStoredSession() {
  const token = tokenHelper.get();
  if (!token || tokenHelper.isExpired(token)) {
    tokenHelper.clear();
    localStorage.removeItem(USER_KEY);
    return null;
  }
  try {
    const stored = JSON.parse(localStorage.getItem(USER_KEY) || "null");
    // The token is the authority on the role, not the cached copy of it.
    const claims = decodeJWT(token);
    return stored ? { ...stored, role: claims?.role || stored.role } : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => readStoredSession());
  const [sessionExpired, setSessionExpired] = useState(false);
  // Only ever true for the first tick, but screens behind the gate must not
  // flash the sign-in page while we work out whether there is a session.
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const onExpired = () => {
      setUser(null);
      setSessionExpired(true);
      localStorage.removeItem(USER_KEY);
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  const login = useCallback(async ({ email, password }) => {
    setIsLoading(true);
    try {
      const res = await authAPI.login({ email, password });
      tokenHelper.save(res.access_token, res.refresh_token);
      localStorage.setItem(USER_KEY, JSON.stringify(res.user));
      setSessionExpired(false);
      setUser(res.user);
      return res.user;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await authAPI.logout();
    localStorage.removeItem(USER_KEY);
    setSessionExpired(false);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, role: user?.role || null, isAuthenticated: Boolean(user), isLoading, sessionExpired, login, logout }),
    [user, isLoading, sessionExpired, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
