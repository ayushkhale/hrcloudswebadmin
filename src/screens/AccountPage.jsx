// ─────────────────────────────────────────────────────────────────────────────
// AccountPage.jsx — "Your access". What `GET /platform/me` knows about you,
// said back to you in words you'd use.
//
// This screen exists because the console's entire permission model is one
// field, `tier`, and a person's own copy of it is the only part of the system
// they can check for themselves. A support hire who cannot see Organisations
// should be able to find out why in one click rather than asking a colleague
// whether something is broken.
//
// ONE READ. The actor is already in context from the app's bootstrap, so this
// page draws what the shell already fetched rather than asking again — same
// rule as every other screen, arrived at from the other direction. The retry
// re-runs that one bootstrap call, so the page and the shell can never end up
// disagreeing about who is signed in.
//
// Nothing here is repeated from the top bar. The bar prints a name and a role;
// this page answers what that role can actually DO, which is the part the bar
// has no room for.
// ─────────────────────────────────────────────────────────────────────────────
import { HiCheck, HiClock, HiIdentification, HiMail, HiShieldCheck } from "react-icons/hi";

import ConsoleTopBar from "../shared/components/ConsoleTopBar";
import ScreenHeader from "../shared/components/ScreenHeader";
import Card, { CardHeader } from "../shared/components/Card";
import { ErrorState } from "../shared/components/States";
import { SkeletonCard, SkeletonTiles } from "../shared/components/Skeleton";
import { useAuth } from "../shared/contexts/AuthContext";
import { DICTIONARY } from "../config/dictionary";
import { TIER_META } from "../config/platformAccess";
import { displayValue, formatDate, timeAgo } from "../shared/utils/format";

/** One fact: a quiet label, the answer under it. */
function Fact({ icon: Icon, label, value, note }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 dark:bg-purple-500/15 dark:text-purple-300">
        <Icon className="w-4 h-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider dark:text-slate-500">{label}</p>
        <p className="text-sm font-bold text-slate-800 truncate dark:text-slate-100">{value}</p>
        {note && <p className="text-[11px] font-semibold text-slate-400 mt-0.5 dark:text-slate-500">{note}</p>}
      </div>
    </div>
  );
}

export default function AccountPage() {
  const { actor, isBooting, bootstrapError, retryBootstrap } = useAuth();

  // The tier is a closed vocabulary the server owns. If a build meets a band
  // it has never heard of, say so plainly rather than rendering an empty card
  // that looks like the page half-loaded.
  const meta = actor?.tier ? TIER_META[actor.tier] : null;

  return (
    <>
      <ConsoleTopBar title={DICTIONARY.HEADERS.ACCOUNT} />

      <main className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 max-w-7xl w-full mx-auto">
        <ScreenHeader
          title={DICTIONARY.ACCESS.HEADER}
          subtitle={DICTIONARY.ACCESS.SUBTITLE}
        />

        {bootstrapError ? (
          <Card>
            <ErrorState error={bootstrapError} onRetry={retryBootstrap} fallback="Couldn’t load your access." />
          </Card>
        ) : isBooting || !actor ? (
          <>
            <SkeletonTiles count={3} />
            <SkeletonCard height="h-64" />
          </>
        ) : (
          <>
            {/* ── Who the server says you are ───────────────────────────── */}
            <Card>
              <CardHeader title={DICTIONARY.ACCESS.SIGNED_IN_AS} subtitle="Confirmed by the server, not by this browser" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                <Fact
                  icon={HiIdentification}
                  label="Name"
                  value={displayValue(actor.name)}
                  // Said only when it IS the fallback, so the line isn't a
                  // permanent apology on every properly-filled profile.
                  note={actor.name === actor.identifier ? "No profile name on file" : null}
                />
                <Fact
                  icon={HiMail}
                  label={actor.identifierType === "phone" ? "Phone" : "Email"}
                  value={displayValue(actor.identifier)}
                />
                <Fact
                  icon={HiClock}
                  label={DICTIONARY.ACCESS.LAST_SIGNED_IN}
                  value={actor.lastLoginAt ? timeAgo(actor.lastLoginAt) : DICTIONARY.ACCESS.NEVER_SIGNED_IN}
                  note={actor.lastLoginAt ? formatDate(actor.lastLoginAt) : null}
                />
              </div>
            </Card>

            {/* ── What that lets you do ─────────────────────────────────── */}
            <Card>
              <CardHeader
                title={DICTIONARY.ACCESS.TIER}
                subtitle={
                  actor.role?.name
                    ? `${DICTIONARY.ACCESS.ACTING_AS} ${actor.role.name}`
                    : DICTIONARY.ACCESS.ACTING_AS
                }
                icon={HiShieldCheck}
              />

              {meta ? (
                <>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-100 text-xs font-bold dark:bg-purple-500/15 dark:text-purple-200 dark:border-purple-500/25">
                      {meta.label}
                    </span>
                    <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">{meta.summary}</p>
                  </div>

                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-6 mb-3 dark:text-slate-500">
                    {DICTIONARY.ACCESS.ALLOWS}
                  </p>
                  <ul className="space-y-2.5">
                    {meta.allows.map((line) => (
                      <li key={line} className="flex items-start gap-2.5 text-sm text-slate-600 dark:text-slate-300">
                        <span className="w-4 h-4 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center shrink-0 mt-0.5 dark:bg-violet-500/20 dark:text-violet-300">
                          <HiCheck className="w-2.5 h-2.5" />
                        </span>
                        {line}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Your access level is {displayValue(actor.tier)}, which this version of the console doesn’t recognise.
                  Everything the server allows still works; only this description is missing.
                </p>
              )}

              {/* Said once, here, where someone is already thinking about what
                  they can do. Not on every screen — a warning repeated on
                  every page stops being read by the second one. */}
              <p className="flex items-start gap-2 text-[11px] text-slate-400 mt-7 pt-5 border-t border-slate-100 leading-relaxed dark:text-slate-500 dark:border-night-700">
                <HiShieldCheck className="w-3.5 h-3.5 shrink-0 mt-px" />
                {DICTIONARY.ACCESS.RECORDED}
              </p>
            </Card>
          </>
        )}
      </main>
    </>
  );
}
