// ─────────────────────────────────────────────────────────────────────────────
// LoginPage.jsx — the way in, and the only one.
//
// Built from HR Clouds Web's sign-in screen: the same split, the same white
// form panel, the same inputs and the same purple button. Two differences,
// both deliberate:
//
//   · The background clip is muted, looping and purely decorative. The gradient
//     sits on top of it, so the panel reads the same before the video arrives,
//     on a slow connection, or if it never loads at all.
//   · No sign-up, no Google, no "forgot password" self-service. A platform
//     account is issued by a person, not requested by one — there is nothing
//     here for someone who doesn't already have one.
//
// The theme control is on this screen as well as inside the console, because
// this is the screen someone meets before they have an account menu to find
// it in — and on a shared machine it is the first screen of the day.
//
// The brand panel stays dark in BOTH themes. It is a photograph under a
// purple wash and it was always dark; only the form half changes.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { HiEye, HiEyeOff, HiLockClosed, HiShieldCheck } from "react-icons/hi";

import { useAuth } from "../../shared/contexts/AuthContext";
import { DICTIONARY } from "../../config/dictionary";
import ThemeToggle from "../../shared/components/ThemeToggle";

/** Only in-app paths, so a crafted `?redirect=` can't bounce someone offsite. */
function safeRedirect(value) {
  if (!value) return null;
  return value.startsWith("/") && !value.startsWith("//") ? value : null;
}

/** Decorative loop behind the brand panel; the gradient above it does the work. */
const BACKGROUND_VIDEO = "https://www.pexels.com/download/video/855232/";

const POINTS = [
  "Every organisation, on one screen",
  "Who signed up, who is paying, who needs help",
  "Every action here is recorded against your name",
];

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, isAuthenticated, sessionExpired } = useAuth();

  const redirect = safeRedirect(searchParams.get("redirect")) || "/console";

  // Already signed in: don't show a form they'd only have to dismiss.
  if (isAuthenticated) return <Navigate to={redirect} replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login({ email, password });
      navigate(redirect, { replace: true });
    } catch (err) {
      setError(err.message || "Those details didn’t work. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex font-sans bg-white dark:bg-night-950">
      {/* ── Left: the brand panel ───────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[52%] relative overflow-hidden bg-[#1a0b2e]">
        <video
          src={BACKGROUND_VIDEO}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
          tabIndex={-1}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#2b0f4d]/90 via-[#4c1d95]/85 to-[#1a0b2e]/95" />
        <div className="absolute -top-24 -left-24 w-[34rem] h-[34rem] rounded-full bg-purple-500/25 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-8rem] right-[-6rem] w-[28rem] h-[28rem] rounded-full bg-fuchsia-500/20 blur-[110px] pointer-events-none" />

        <div className="relative z-10 flex flex-col justify-between w-full p-10">
          <img src="/logocolorwhite.png" alt="HR Clouds" className="h-10 w-auto object-contain self-start" />

          <div>
            <p className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 border border-white/20 text-white text-[10px] font-bold uppercase tracking-wider mb-5">
              <HiShieldCheck className="w-3 h-3 text-purple-200" /> Platform Console
            </p>
            <p className="text-white font-bold text-3xl leading-tight mb-3">
              The view from <span className="text-purple-300">above</span>
              <br />
              every organisation.
            </p>
            <ul className="space-y-2 mt-6">
              {POINTS.map((point) => (
                <li key={point} className="flex items-start gap-2.5 text-white/75 text-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-300 mt-[0.45rem] shrink-0" />
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* ── Right: the form ─────────────────────────────────────────────── */}
      <div className="flex flex-col w-full lg:w-[48%] px-8 sm:px-12 xl:px-16 py-8 min-h-screen relative">
        {/* Top-right on a wide screen, where nothing else sits. On a phone it
            joins the logo row below instead of floating over the form. */}
        <div className="hidden lg:block absolute top-6 right-6">
          <ThemeToggle variant="icon" />
        </div>
        <div className="pb-10 lg:hidden flex items-center justify-between">
          <img src="/logocolored.png" alt="HR Clouds" className="h-10 w-auto object-contain dark:hidden" />
          <img src="/logocolorwhite.png" alt="HR Clouds" className="h-10 w-auto object-contain hidden dark:block" />
          <ThemeToggle variant="icon" className="lg:hidden" />
        </div>

        <div className="flex-1 flex flex-col justify-center max-w-sm w-full mx-auto">
          <h2 className="text-2xl font-bold text-slate-900 mb-1 dark:text-slate-50">Sign in to Admin</h2>
          <p className="text-sm text-slate-500 mb-7 dark:text-slate-400">{DICTIONARY.PRODUCT.FULL} </p>

          {sessionExpired && (
            <p
              role="status"
              className="text-xs text-fuchsia-700 bg-fuchsia-50 border border-fuchsia-200 rounded-lg px-3 py-2 -mt-3 mb-5 dark:text-fuchsia-300 dark:bg-fuchsia-500/10 dark:border-fuchsia-500/25"
            >
              Your session ended. Sign in again to carry on.
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-1.5 dark:text-slate-300">
                Admin’s email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@hrclouds.in"
                required
                autoComplete="email"
                autoFocus
                className="w-full border-2 border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition-all bg-white dark:bg-night-850 dark:border-night-600 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:ring-purple-500/25"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-slate-700 mb-1.5 dark:text-slate-300">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                  className="w-full border-2 border-slate-300 rounded-xl px-4 py-2.5 pr-11 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition-all bg-white dark:bg-night-850 dark:border-night-600 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:ring-purple-500/25"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 transition-colors dark:text-slate-400 dark:hover:text-slate-200"
                >
                  {showPassword ? <HiEyeOff className="w-5 h-5" /> : <HiEye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && (
              <p
                role="alert"
                className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 dark:text-rose-300 dark:bg-rose-500/10 dark:border-rose-500/25"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-semibold text-sm rounded-xl py-3 transition-colors disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed shadow-sm shadow-purple-200 dark:shadow-none mt-1"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="flex items-start gap-2 text-[11px] text-slate-400 mt-7 leading-relaxed dark:text-slate-500">
            <HiLockClosed className="w-3.5 h-3.5 shrink-0 mt-px" />
            Accounts here are issued by HR Clouds. If you can’t get in, ask the platform team rather than resetting
            anything yourself.
          </p>
        </div>
      </div>
    </div>
  );
}
