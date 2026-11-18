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
// black scrim and it was always dark; only the form half changes.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { HiEye, HiEyeOff, HiLockClosed } from "react-icons/hi";

import { ENDED, useAuth } from "../../shared/contexts/AuthContext";
import { DICTIONARY } from "../../config/dictionary";
import ThemeToggle from "../../shared/components/ThemeToggle";

/**
 * Why they are looking at this screen again, said in the right words.
 *
 * Three endings that a lazier console would collapse into "please sign in":
 * a token that ran out, access that was taken away, and an account that never
 * had access here at all. The last one matters most — telling an HR manager
 * their access was "revoked" sends them to ask a colleague about a permission
 * they were never granted, when the true answer is that they are at the wrong
 * door and their own app is working fine.
 */
const ENDED_COPY = {
  [ENDED.EXPIRED]: { tone: "waiting", text: "Your session ended. Sign in again to carry on." },
  [ENDED.REVOKED]: {
    tone: "error",
    text: "Your access has been removed. Ask the platform team if you think that’s wrong.",
  },
  [ENDED.NOT_PLATFORM]: {
    tone: "error",
    text: "That account doesn’t have access here. If you administer an organisation on HR Clouds, sign in to the main app instead.",
  },
};

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
  // `identifier`, not `email`: an HR Clouds account is keyed by email OR
  // phone, and the field has carried that name across the API and the web app
  // from the start. A third name for one thing is how a staff member with a
  // phone login ends up unable to sign in.
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, isAuthenticated, endedReason } = useAuth();

  const redirect = safeRedirect(searchParams.get("redirect")) || "/console";
  // The form's own error wins: it is about the attempt just made, while the
  // banner is about a session that ended before this screen was opened.
  const ended = !error && endedReason ? ENDED_COPY[endedReason] : null;

  // Already signed in: don't show a form they'd only have to dismiss.
  if (isAuthenticated) return <Navigate to={redirect} replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login({ identifier, password });
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
      <div className="hidden lg:flex lg:w-[52%] relative overflow-hidden bg-neutral-950">
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
        {/* Three thin black layers, not one thick purple one. A 90%-opacity
            purple sheet turned the footage into flat mauve fog — you could
            tell something was behind it but not what. Black reads as a
            photograph lit low, and leaves the purple to the badge, the
            headline word and the bullets. So: an even dim, a bottom-up scrim
            where the words sit, and a top vignette under the logo. */}
        <div className="absolute inset-0 bg-black/55" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-transparent" />

        <div className="relative z-10 flex flex-col justify-between w-full p-10">
          <img src="/logocolorwhite.png" alt="HR Clouds" className="h-10 w-auto object-contain self-start" />

          <div>
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
          <p className="text-sm text-slate-500 mb-7 dark:text-slate-400">{DICTIONARY.PRODUCT.NAME}</p>

          {ended && (
            <p
              role="status"
              className={`text-xs border rounded-lg px-3 py-2 -mt-3 mb-5 leading-relaxed ${
                ended.tone === "error"
                  ? "text-rose-700 bg-rose-50 border-rose-200 dark:text-rose-300 dark:bg-rose-500/10 dark:border-rose-500/25"
                  : "text-fuchsia-700 bg-fuchsia-50 border-fuchsia-200 dark:text-fuchsia-300 dark:bg-fuchsia-500/10 dark:border-fuchsia-500/25"
              }`}
            >
              {ended.text}
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="identifier" className="block text-sm font-semibold text-slate-700 mb-1.5 dark:text-slate-300">
                Email or phone
              </label>
              <input
                id="identifier"
                // `type="text"`, not `email`: the same field takes a phone
                // number, and the browser's email validation would reject one
                // before the form ever reached the server.
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="admin@hrclouds.in"
                required
                autoComplete="username"
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
