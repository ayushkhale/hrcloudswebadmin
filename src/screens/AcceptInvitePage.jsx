// ─────────────────────────────────────────────────────────────────────────────
// AcceptInvitePage.jsx — Phase 2, #288. Setting a password from an invitation.
//
// The only screen in this app that renders OUTSIDE the console shell, and the
// only call that carries no token. Someone opening this has never seen the
// product and may not know what HR Clouds is, so it says what they are
// accepting before it asks for anything.
//
// ⚠ THE ROUTE PATH IS A CONTRACT. The server builds the link in the
// invitation email from its own `urls.platformInviteAcceptPath` config. If
// this route moves, every invitation already in somebody's inbox lands on the
// console's catch-all redirect and bounces them to a sign-in screen they
// cannot pass. Change both or neither.
//
// Two behaviours that are the endpoint's design and not an oversight:
//
//   • EVERY failure is one opaque `INVALID_INVITATION`. Expired, already
//     used, malformed, no such user — the same answer, so the endpoint cannot
//     be used to probe whether a token or an account exists. This screen
//     therefore CANNOT say which it was, and must not guess: it says the link
//     doesn't work and points at the person who sent it. A helpful "your link
//     expired" here would be inventing a fact.
//
//   • It issues NO SESSION. Accepting an invitation is not signing in. So the
//     screen ends by sending them to the sign-in page, rather than dropping
//     them at a console door that will turn them away.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { HiCheckCircle, HiExclamationCircle, HiLockClosed } from "react-icons/hi";

import { DICTIONARY } from "../config/dictionary";
import { staffAPI } from "../shared/api/staff.api";

// Matched to the server's own rule. Checked here so somebody doesn't submit a
// six-character password and get one opaque error back for their trouble.
const PASSWORD_MIN = 8;

const FIELD =
  "w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:border-purple-400 transition-colors disabled:opacity-60 dark:bg-night-900 dark:border-night-600 dark:text-slate-100 dark:placeholder:text-slate-500";

export default function AcceptInvitePage() {
  const [params] = useSearchParams();
  const token = params.get("token");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  const localError =
    password.length === 0
      ? "Choose a password."
      : password.length < PASSWORD_MIN
        ? `At least ${PASSWORD_MIN} characters.`
        : confirm !== password
          ? "The two passwords don’t match."
          : null;

  async function submit(e) {
    e.preventDefault();
    setTouched(true);
    if (localError || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await staffAPI.acceptInvitation({ token, password, firstName: firstName.trim(), lastName: lastName.trim() });
      setDone(true);
    } catch (err) {
      // One sentence for every cause, because the server gives one answer for
      // every cause. See the header.
      setError(
        err?.code === "INVALID_INVITATION"
          ? "This link doesn’t work any more. It may have been used already, or a newer invitation may have replaced it. Ask whoever invited you to send another."
          : err?.message || "That didn’t go through. Try again.",
      );
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F8F7FB] flex items-center justify-center p-4 sm:p-6 dark:bg-night-900">
      <div className="w-full max-w-md">
        {/* The same purple hero as every console screen, so the first thing
            somebody sees of this product is the thing they will keep seeing. */}
        {/* Hand-built rather than a <PageHeader>, because this screen is
            outside the console shell and its banner has no right-hand action
            and a narrower column. It keeps the same gradient, radius, height
            and corner artwork, so the first thing somebody sees of this
            product is the same object they will keep seeing inside it. */}
        <div className="bg-gradient-to-r from-[#5B21B6] via-[#6328D7] to-[#4C1D95] dark:from-[#2E1065] dark:via-[#3B1E7A] dark:to-[#1E0B3F] rounded-3xl px-6 py-7 sm:px-7 sm:py-8 min-h-[9rem] text-white mb-4 relative overflow-hidden flex flex-col justify-center">
          <img
            src="/header-art.png"
            alt=""
            aria-hidden="true"
            className="absolute right-0 bottom-0 w-[30%] pointer-events-none select-none [filter:invert(1)_hue-rotate(180deg)] mix-blend-screen opacity-90 dark:opacity-70 [mask-image:radial-gradient(130%_130%_at_bottom_right,black_45%,transparent_85%)]"
          />
          <div className="absolute right-0 top-0 bottom-0 w-1/2 opacity-15 pointer-events-none bg-[radial-gradient(circle_at_right,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" />
          <p className="relative z-10 text-[11px] font-bold uppercase tracking-wider text-purple-200">
            {DICTIONARY.PRODUCT.NAME}
          </p>
          <h1 className="relative z-10 text-2xl font-bold tracking-tight mt-1">
            {done ? "You’re all set" : "Set your password"}
          </h1>
          <p className="relative z-10 text-xs text-purple-100/90 mt-1.5 leading-relaxed max-w-[22rem]">
            {done
              ? "Your password is saved. Sign in to get started."
              : "You’ve been given access to run the HR Clouds platform. Choose a password to finish."}
          </p>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs dark:bg-night-850 dark:border-night-700 dark:shadow-none">
          {/* A link with no token at all never reaches the server: there is
              nothing to send, and a round trip would only return the same
              opaque refusal a second later. */}
          {!token ? (
            <Outcome
              tone="bad"
              icon={HiExclamationCircle}
              title="This link is incomplete"
              body="Open the link from your invitation email exactly as it was sent — it carries a code this page needs."
            />
          ) : done ? (
            <Outcome
              tone="good"
              icon={HiCheckCircle}
              title="Password saved"
              body="Accepting an invitation doesn’t sign you in, so there’s one more step."
              action={
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center px-5 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-colors"
                >
                  Go to sign in
                </Link>
              }
            />
          ) : (
            <form onSubmit={submit} className="space-y-4" noValidate>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="invite-first" className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 dark:text-slate-400">
                    First name
                  </label>
                  <input id="invite-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" className={FIELD} />
                </div>
                <div>
                  <label htmlFor="invite-last" className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 dark:text-slate-400">
                    Last name
                  </label>
                  <input id="invite-last" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" className={FIELD} />
                </div>
              </div>

              <div>
                <label htmlFor="invite-password" className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 dark:text-slate-400">
                  Password
                </label>
                <input
                  id="invite-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={() => setTouched(true)}
                  disabled={submitting}
                  className={FIELD}
                />
              </div>

              <div>
                <label htmlFor="invite-confirm" className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 dark:text-slate-400">
                  Password again
                </label>
                <input
                  id="invite-confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  onBlur={() => setTouched(true)}
                  disabled={submitting}
                  className={FIELD}
                />
                <p className={`text-[11px] font-semibold mt-1.5 ${touched && localError ? "text-rose-600 dark:text-rose-400" : "text-slate-400 dark:text-slate-500"}`}>
                  {touched && localError ? localError : `At least ${PASSWORD_MIN} characters.`}
                </p>
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-100 dark:bg-rose-500/10 dark:border-rose-500/25">
                  <HiExclamationCircle className="w-4 h-4 text-rose-600 shrink-0 mt-px dark:text-rose-400" />
                  <p className="text-xs font-semibold text-rose-700 leading-relaxed dark:text-rose-300">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white text-xs font-bold transition-colors disabled:opacity-60"
              >
                <HiLockClosed className="w-4 h-4" />
                {submitting ? "Saving…" : "Save password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function Outcome({ tone, icon: Icon, title, body, action }) {
  const tones = {
    good: "bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300",
    bad: "bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300",
  };
  return (
    <div className="text-center py-4">
      <span className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 ${tones[tone]}`}>
        <Icon className="w-6 h-6" />
      </span>
      <p className="text-sm font-bold text-slate-700 dark:text-slate-100">{title}</p>
      <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-xs mx-auto dark:text-slate-400">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
