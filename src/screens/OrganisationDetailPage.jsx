// ─────────────────────────────────────────────────────────────────────────────
// OrganisationDetailPage.jsx — one customer's whole record, and the four
// things platform staff may do to it.
//
// Phase 3: the record (#290) and suspend/reactivate (#291).
// Phase 4: grant a plan (#292), change the seat ceiling (#293), invite an HR
//          (#295). They live here rather than on their own screens because
//          every one of them is a decision about THIS organisation, and an
//          operator making it needs the record in front of them.
//
// ONE READ: `orgsAPI.getOrg()` returns all ten panels. After a write, the
// same one read runs again — never a per-panel refresh, which is how two
// panels end up disagreeing about what plan somebody is on.
//
// ─── Resilient panels ────────────────────────────────────────────────────────
// The server builds every panel but the organisation row BEST-EFFORT and names
// whatever failed in `unavailable`. So this screen renders three different
// facts and never confuses them:
//
//   named in `unavailable`  → "this part didn't load", with a retry
//   null, not named         → genuinely nothing there ("Not applicable")
//   present                 → the data
//
// Collapsing the first two is the bug this structure exists to prevent: an
// empty "Plan" panel on a customer whose subscription read timed out would
// have an operator grant a second plan to somebody who already has one.
//
// ─── The locking rule ───────────────────────────────────────────────────────
// #292 and #293 carry `expected_subscription_id` — including `null`, which
// legitimately means "I believe there is no subscription". A STALE_SUBSCRIPTION
// refusal means the record moved while the dialog was open, so the console
// RELOADS and never retries: repeating the write would apply it to a
// subscription the operator never looked at.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  HiArrowLeft,
  HiBan,
  HiBadgeCheck,
  HiClipboardList,
  HiCreditCard,
  HiExclamation,
  HiInformationCircle,
  HiOfficeBuilding,
  HiRefresh,
  HiUserAdd,
  HiUserGroup,
} from "react-icons/hi";

import ConsoleTopBar from "../shared/components/ConsoleTopBar";
import ScreenHeader from "../shared/components/ScreenHeader";
import Card, { CardHeader } from "../shared/components/Card";
import Pill, { Tag } from "../shared/components/Pill";
import { OrgMark } from "../shared/components/StatusPill";
import Dialog, { DialogButton } from "../shared/components/Dialog";
import ReasonDialog, { Field, FIELD_CLASS } from "../shared/components/ReasonDialog";
import OneTimeLink from "../shared/components/OneTimeLink";
import { EmptyState, ErrorState } from "../shared/components/States";
import { Skeleton, SkeletonCard, SkeletonTiles } from "../shared/components/Skeleton";
import { GhostButton, PrimaryButton } from "../shared/components/ListControls";
import { useToast } from "../shared/components/AlertProvider";
import { useAuth } from "../shared/contexts/AuthContext";
import { orgsAPI } from "../shared/api/organisations.api";
import { DICTIONARY } from "../config/dictionary";
import { TIER } from "../config/platformAccess";
import {
  orgState,
  PANEL,
  PANEL_UNAVAILABLE,
  PILL_TONE,
  seatPressure,
  seatSummary,
  shouldReload,
  subscriptionState,
} from "../config/platformMeta";
import { displayValue, formatCount, formatDate, formatMoney, timeAgo } from "../shared/utils/format";

export default function OrganisationDetailPage() {
  const { orgId } = useParams();
  const { can } = useAuth();
  const toast = useToast();

  const [state, setState] = useState({ status: "loading", data: null, error: null });
  const [dialog, setDialog] = useState(null);
  // The HR activation link. Returned once, never fetchable again.
  const [inviteResult, setInviteResult] = useState(null);

  const load = useCallback(
    (signal) => {
      setState((prev) => ({ status: "loading", data: prev.data, error: null }));
      orgsAPI
        .getOrg({ orgId, signal })
        .then((data) => {
          if (signal?.aborted) return;
          setState({ status: "ready", data, error: null });
        })
        .catch((err) => {
          if (signal?.aborted || err?.name === "AbortError") return;
          setState({ status: "error", data: null, error: err });
        });
    },
    [orgId],
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const reload = () => {
    const controller = new AbortController();
    load(controller.signal);
  };

  /**
   * One wrapper around every write on this screen, so the stale-record rule
   * is in exactly one place. A STALE_SUBSCRIPTION reloads the record and then
   * rethrows, so the dialog keeps the reason the operator typed and shows the
   * refusal — rather than closing and leaving them to work out what happened.
   */
  const runWrite = useCallback(
    async (fn) => {
      try {
        return await fn();
      } catch (err) {
        if (shouldReload(err?.code)) reload();
        throw err;
      }
    },
    // `reload` is stable enough for this: it only closes over `load`, which is
    // keyed on orgId.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orgId],
  );

  const data = state.data;
  const org = data?.org;
  const down = (panel) => (data?.unavailable || []).includes(panel);

  const maySetStatus = can(TIER.ADMIN);
  const mayTouchMoney = can(TIER.SUPER_ADMIN);

  // ── The three screen states before the record exists ──────────────────────
  if (state.status === "error") {
    return (
      <>
        <ConsoleTopBar title={DICTIONARY.HEADERS.ORGANISATIONS} />
        <main className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 max-w-7xl w-full mx-auto">
          <BackLink />
          <Card>
            {state.error?.status === 404 ? (
              <EmptyState
                icon={HiOfficeBuilding}
                title="No organisation with that address"
                hint="The link may be out of date, or the organisation may have been removed."
                action={
                  <Link to="/console/organisations">
                    <PrimaryButton>Back to organisations</PrimaryButton>
                  </Link>
                }
              />
            ) : (
              <ErrorState error={state.error} onRetry={reload} fallback="Couldn’t load this organisation." />
            )}
          </Card>
        </main>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <ConsoleTopBar title={DICTIONARY.HEADERS.ORGANISATIONS} />
        <main className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 max-w-7xl w-full mx-auto">
          <BackLink />
          {/* Shaped like what is coming, so the page doesn't jump when it
              lands: a hero, four tiles, then two columns of cards. */}
          <Skeleton className="h-28 rounded-3xl" />
          <SkeletonTiles count={4} />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            <div className="lg:col-span-2 space-y-4 sm:space-y-6">
              <SkeletonCard height="h-40" />
              <SkeletonCard height="h-48" />
            </div>
            <SkeletonCard height="h-64" />
          </div>
        </main>
      </>
    );
  }

  const state_ = orgState(org?.status);
  const sub = data.subscription;
  const seats = seatSummary(data.usage?.activeEmployees ?? null, data.usage?.seatLimit ?? null);

  return (
    <>
      <ConsoleTopBar title={org?.name || DICTIONARY.HEADERS.ORGANISATIONS} />

      <main
        className={`p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 max-w-7xl w-full mx-auto transition-opacity ${
          state.status === "loading" ? "opacity-60" : ""
        }`}
      >
        <BackLink />

        <ScreenHeader
          title={org?.name || "N/A"}
          subtitle={
            // One line, and it says the thing the whole page is about: what
            // state they are in and whether anyone is paying. Not a
            // restatement of the name above it.
            [
              // Without the full stop: these read as one line of clauses
              // joined by a middot, and "Open for business. · On Growth Plan"
              // reads as a sentence that was cut off.
              state_.meaning?.replace(/\.$/, ""),
              sub?.plan?.name ? (sub.isOverride ? `On ${sub.plan.name}, granted` : `On ${sub.plan.name}`) : DICTIONARY.ORG.NO_PLAN,
            ]
              .filter(Boolean)
              .join(" · ")
          }
          rightContent={
            maySetStatus ? (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                {org?.status === "suspended" ? (
                  <PrimaryButton icon={HiBadgeCheck} onClick={() => setDialog({ kind: "status", next: "active" })} className="flex-1 sm:flex-none">
                    {DICTIONARY.ORG.REACTIVATE}
                  </PrimaryButton>
                ) : org?.status === "active" ? (
                  // Ghost, not primary: cutting a paying customer off is not
                  // the thing this page invites you to do, and it was only
                  // ever white-on-purple because it sat inside the hero.
                  <GhostButton icon={HiBan} onClick={() => setDialog({ kind: "status", next: "suspended" })} className="flex-1 sm:flex-none">
                    Suspend
                  </GhostButton>
                ) : null}
              </div>
            ) : null
          }
        />

        {/* ── The facts, four tiles ──────────────────────────────────────────
            Each one is a figure the cards below do NOT repeat. */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <FactTile
            icon={HiOfficeBuilding}
            label="State"
            value={state_.label}
            note={org?.createdAt ? `${DICTIONARY.ORG.JOINED} ${formatDate(org.createdAt)}` : null}
          />
          <FactTile
            icon={HiUserGroup}
            label="Seats"
            value={seats.text}
            note={seats.note || (seats.percent !== null ? `${seats.percent}% used` : null)}
            tone={seatPressure(seats.unknown ? null : seats.percent).tone}
          />
          <FactTile
            icon={HiCreditCard}
            label="Plan"
            value={sub?.plan?.name ? (sub.plan.amount != null && Number(sub.plan.amount) > 0 ? formatMoney(sub.plan.amount) : "Granted") : "N/A"}
            note={sub?.plan?.billingCycle ? `per ${sub.plan.billingCycle === "yearly" ? "year" : "month"}` : down("subscription") ? "Didn’t load" : null}
          />
          <FactTile
            icon={HiBadgeCheck}
            label={DICTIONARY.ORG.PLAN_PERIOD_ENDS}
            value={sub?.currentPeriodEnd ? formatDate(sub.currentPeriodEnd) : sub ? "No end date" : "N/A"}
            note={sub?.status ? subscriptionState(sub.status).label : null}
          />
        </div>

        {/* The one warning on this page that is worth interrupting for: the
            customer's limits were frozen when they subscribed and the plan has
            been edited since, so what they can actually do no longer matches
            what the plan says. */}
        {data.limitsAudit?.drifted && (
          <div className="flex items-start gap-3 p-4 rounded-3xl bg-fuchsia-50 border border-fuchsia-100 dark:bg-fuchsia-500/10 dark:border-fuchsia-500/25">
            <HiExclamation className="w-5 h-5 text-fuchsia-600 shrink-0 dark:text-fuchsia-300" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-fuchsia-900 dark:text-fuchsia-200">{DICTIONARY.ORG.LIMITS_DRIFTED}</p>
              <p className="text-xs font-semibold text-fuchsia-700 mt-1 dark:text-fuchsia-300/90">
                They are held to {displayValue(data.limitsAudit.snapshot?.max_employees)} employees; the plan now says{" "}
                {displayValue(data.limitsAudit.current?.max_employees)}.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            {/* ── Plan ───────────────────────────────────────────────────── */}
            <Panel
              name="subscription"
              icon={HiCreditCard}
              subtitle="What they are entitled to, and who decided that"
              down={down("subscription")}
              present={Boolean(sub)}
              onRetry={reload}
              action={
                mayTouchMoney ? (
                  <div className="flex items-center gap-2">
                    <GhostButton onClick={() => setDialog({ kind: "seats" })} disabled={!sub}>
                      Seats
                    </GhostButton>
                    <PrimaryButton onClick={() => setDialog({ kind: "plan" })}>
                      {sub ? "Change plan" : DICTIONARY.ORG.GRANT_PLAN}
                    </PrimaryButton>
                  </div>
                ) : null
              }
            >
              {sub && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-base font-bold text-slate-800 dark:text-slate-100">{displayValue(sub.plan?.name)}</p>
                    <Pill label={subscriptionState(sub.status).label} tone={subscriptionState(sub.status).tone} />
                    {sub.isOverride && <Tag>{DICTIONARY.ORG.GRANTED}</Tag>}
                    {sub.cancelAtPeriodEnd && <Pill label="Ends at the period" tone={PILL_TONE.waiting} />}
                    {/* `is_live` and `status` answer different questions: a
                        cancelled subscription can still be running out a paid
                        period, which is very much live for the customer. */}
                    {!sub.isLive && <Pill label="Not billing" tone={PILL_TONE.off} />}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <Fact label="Employees" value={displayValue(sub.limits?.maxEmployees, "No limit")} />
                    <Fact label="Managers" value={displayValue(sub.limits?.maxManagers, "No limit")} />
                    <Fact label="HRs" value={displayValue(sub.limits?.maxHrs, "No limit")} />
                    <Fact label="Period started" value={formatDate(sub.currentPeriodStart)} />
                  </div>

                  {sub.featureKeys.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      {sub.featureKeys.map((key) => (
                        <Tag key={key}>{key}</Tag>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Panel>

            {/* ── Company details ────────────────────────────────────────── */}
            <Panel
              name="profile"
              icon={HiOfficeBuilding}
              subtitle="What they told us when they signed up"
              down={down("profile")}
              present={Boolean(data.profile)}
              onRetry={reload}
            >
              {data.profile && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <Fact label="Industry" value={displayValue(data.profile.industry)} />
                  <Fact label="Size" value={displayValue(data.profile.size)} />
                  <Fact label="Where" value={[data.profile.city, data.profile.state].filter(Boolean).join(", ") || "N/A"} />
                  <Fact label="Key" value={displayValue(org?.key)} mono />
                  <Fact label="PAN" value={displayValue(data.profile.pan)} mono />
                  <Fact label="GST" value={displayValue(data.profile.gst)} mono />
                </div>
              )}
            </Panel>

            {/* ── What staff have done here ──────────────────────────────── */}
            <Panel
              name="recent_audit_logs"
              icon={HiClipboardList}
              subtitle="Platform staff only — not the customer’s own activity"
              down={down("recent_audit_logs")}
              present={data.auditLogs.length > 0}
              onRetry={reload}
            >
              <ul className="divide-y divide-slate-100 dark:divide-night-700">
                {data.auditLogs.map((log) => (
                  <li key={log.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{humanAction(log.action)}</p>
                        {/* The reason somebody typed at the time. This is the
                            entire point of making every write take one. */}
                        {log.reason && (
                          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed dark:text-slate-400">“{log.reason}”</p>
                        )}
                        <p className="text-[11px] font-semibold text-slate-400 mt-1 dark:text-slate-500">
                          {displayValue(log.actor)}
                        </p>
                      </div>
                      <p className="text-[11px] font-bold text-slate-400 shrink-0 dark:text-slate-500">{timeAgo(log.at)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>

          <div className="space-y-4 sm:space-y-6">
            {/* ── This organisation ──────────────────────────────────────── */}
            <Card>
              <CardHeader title="This organisation" subtitle="Its identity on the platform" icon={HiOfficeBuilding} />
              <IdentityBlock
                org={org}
                mayInvite={mayTouchMoney}
                onInvite={() => setDialog({ kind: "invite" })}
              />
            </Card>

            {/* ── Onboarding ─────────────────────────────────────────────── */}
            <Panel
              name="setup"
              icon={HiBadgeCheck}
              subtitle="How far they got setting themselves up"
              down={down("setup")}
              present={Boolean(data.setup)}
              onRetry={reload}
              // An organisation that never finished signing up has no
              // onboarding to report. "Not applicable" is the honest word for
              // that; "couldn't load" would send somebody looking for a fault.
              absentOverride={
                org?.status === "inactive" ? "They never finished signing up, so there is nothing set up yet." : undefined
              }
            >
              {data.setup && (
                <>
                  <div className="flex items-end justify-between gap-3 mb-2">
                    <p className="text-2xl font-bold text-slate-800 tabular-nums leading-none dark:text-slate-50">
                      {displayValue(data.setup.percent)}%
                    </p>
                    <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500">
                      {displayValue(data.setup.completedSteps)} of {displayValue(data.setup.totalSteps)} steps
                    </p>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden dark:bg-night-700">
                    <div className="h-full rounded-full bg-violet-500" style={{ width: `${data.setup.percent || 0}%` }} />
                  </div>
                  {data.setup.pending.length > 0 && (
                    <>
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-5 mb-2 dark:text-slate-500">
                        Still to do
                      </p>
                      <ul className="space-y-1.5">
                        {data.setup.pending.map((step) => (
                          <li key={step} className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                            {step}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </>
              )}
            </Panel>

            {/* ── Billing history ───────────────────────────────────────── */}
            <Panel
              name="recent_subscription_events"
              icon={HiRefresh}
              subtitle="Renewals, grants and cancellations"
              down={down("recent_subscription_events")}
              present={data.subscriptionEvents.length > 0}
              onRetry={reload}
            >
              <ul className="space-y-3">
                {data.subscriptionEvents.map((event) => (
                  <li key={event.id} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{humanAction(event.type)}</p>
                      {event.note && <p className="text-[11px] font-semibold text-slate-400 mt-0.5 dark:text-slate-500">{event.note}</p>}
                    </div>
                    <p className="text-[11px] font-bold text-slate-400 shrink-0 dark:text-slate-500">{timeAgo(event.at)}</p>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </div>
      </main>

      {/* ── The writes ─────────────────────────────────────────────────────── */}
      {dialog?.kind === "status" && (
        <StatusDialog
          org={org}
          next={dialog.next}
          runWrite={runWrite}
          onClose={() => setDialog(null)}
          onDone={(changed, next) => {
            setDialog(null);
            reload();
            toast.show(
              changed
                ? next === "suspended"
                  ? `${org.name} is suspended`
                  : `${org.name} is back on`
                : "It was already in that state",
            );
          }}
        />
      )}

      {dialog?.kind === "plan" && (
        <PlanDialog
          org={org}
          subscription={sub}
          runWrite={runWrite}
          onClose={() => setDialog(null)}
          onDone={(changed) => {
            setDialog(null);
            reload();
            toast.show(changed ? "Plan granted" : "They were already on that plan");
          }}
        />
      )}

      {dialog?.kind === "seats" && (
        <SeatsDialog
          org={org}
          subscription={sub}
          usage={data.usage}
          runWrite={runWrite}
          onClose={() => setDialog(null)}
          onDone={(changed) => {
            setDialog(null);
            reload();
            toast.show(changed ? "Seat limit changed" : "The limit was already that");
          }}
        />
      )}

      {dialog?.kind === "invite" && (
        <InviteHrDialog
          org={org}
          runWrite={runWrite}
          onClose={() => setDialog(null)}
          onDone={(result) => {
            setDialog(null);
            reload();
            if (result.activationLink) setInviteResult(result);
            else toast.show("Invitation sent");
          }}
        />
      )}

      {inviteResult && (
        <Dialog
          open
          onClose={() => setInviteResult(null)}
          title="Invitation created"
          subtitle={`Their HR needs this link to open ${org?.name || "the account"}.`}
          icon={HiUserAdd}
          footer={<DialogButton variant="primary" onClick={() => setInviteResult(null)}>Done</DialogButton>}
        >
          <OneTimeLink link={inviteResult.activationLink} emailDelivered={inviteResult.emailDelivered} />
        </Dialog>
      )}
    </>
  );
}

// ─── Pieces ──────────────────────────────────────────────────────────────────

function BackLink() {
  return (
    <Link
      to="/console/organisations"
      className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-purple-700 transition-colors dark:text-slate-400 dark:hover:text-purple-300"
    >
      <HiArrowLeft className="w-3.5 h-3.5" />
      {DICTIONARY.HEADERS.ORGANISATIONS}
    </Link>
  );
}

/**
 * One panel of the detail card, with the three-way distinction the server's
 * `unavailable` array exists to make. See the file header.
 */
function Panel({ name, icon, subtitle, down, present, onRetry, action, absentOverride, children }) {
  const meta = PANEL[name] || { title: name, absent: "Nothing here" };

  return (
    <Card>
      <CardHeader title={meta.title} subtitle={subtitle} icon={icon} action={action} />
      {down ? (
        // Didn't load. Not empty, and not a reason to fail the page — the
        // operator has a customer on the phone and needs the rest of it.
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200 dark:bg-night-800 dark:border-night-700">
          <HiInformationCircle className="w-4 h-4 text-slate-400 shrink-0 mt-px dark:text-slate-500" />
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-600 dark:text-slate-300">{PANEL_UNAVAILABLE}</p>
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1 text-xs font-bold text-purple-700 mt-1.5 hover:underline dark:text-purple-300"
            >
              <HiRefresh className="w-3 h-3" /> Load the whole record again
            </button>
          </div>
        </div>
      ) : !present ? (
        <p className="text-xs font-semibold text-slate-400 leading-relaxed dark:text-slate-500">
          {absentOverride || meta.absent}
        </p>
      ) : (
        children
      )}
    </Card>
  );
}

function FactTile({ icon: Icon, label, value, note, tone = "purple" }) {
  const tones = {
    purple: "bg-purple-50 text-purple-600 dark:bg-purple-500/15 dark:text-purple-300",
    violet: "bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300",
    fuchsia: "bg-fuchsia-50 text-fuchsia-600 dark:bg-fuchsia-500/15 dark:text-fuchsia-300",
    rose: "bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300",
    slate: "bg-slate-100 text-slate-400 dark:bg-night-800 dark:text-slate-500",
  };
  return (
    <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-xs dark:bg-night-850 dark:border-night-700 dark:shadow-none">
      <span className={`w-9 h-9 rounded-xl flex items-center justify-center mb-4 ${tones[tone] || tones.purple}`}>
        <Icon className="w-[1.1rem] h-[1.1rem]" />
      </span>
      <p className="text-lg font-bold text-slate-800 tabular-nums leading-tight dark:text-slate-50">{value}</p>
      <p className="text-[11px] font-bold text-slate-400 mt-1.5 uppercase tracking-wide dark:text-slate-500">{label}</p>
      {note && <p className="text-[11px] font-semibold text-slate-500 mt-1 dark:text-slate-400">{note}</p>}
    </div>
  );
}

function Fact({ label, value, mono = false }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider dark:text-slate-500">{label}</p>
      <p className={`text-sm font-bold text-slate-800 truncate dark:text-slate-100 ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </p>
    </div>
  );
}

/**
 * Who this organisation IS on the platform, and the HR-invitation action.
 *
 * Deliberately NOT a "who to contact" card. `GET /platform/organizations/:id`
 * returns ten panels and a contact is not one of them — the HR contact comes
 * from the DIRECTORY row (#289). An earlier version of this card was headed
 * "Who to contact" and said "invite an HR so somebody can open the account",
 * which on an organisation that has a perfectly reachable HR was simply
 * false: the screen was reporting the absence of a field the endpoint never
 * sends. A console that invents an operational problem is worse than one that
 * stays quiet about it.
 *
 * So the card says what this read actually knows — the name and the key — and
 * offers #295 as an action rather than as a diagnosis. Adding a second read
 * for one line would break the one-read rule for the sake of a line the list
 * screen already carries.
 */
function IdentityBlock({ org, mayInvite, onInvite }) {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <OrgMark name={org?.name} size="sm" />
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-800 truncate dark:text-slate-100">{displayValue(org?.name)}</p>
          <p className="text-[11px] font-semibold text-slate-400 font-mono truncate dark:text-slate-500">
            {displayValue(org?.key)}
          </p>
        </div>
      </div>

      {mayInvite && (
        <div className="pt-2 border-t border-slate-100 dark:border-night-700">
          <GhostButton icon={HiUserAdd} onClick={onInvite} className="w-full">
            {DICTIONARY.ORG.INVITE_HR}
          </GhostButton>
          {/* Said as what the action does, not as a claim about whether this
              organisation currently has anybody. This read doesn't know. */}
          <p className="text-[11px] font-semibold text-slate-400 mt-2 leading-relaxed dark:text-slate-500">
            Sends a link so somebody at this organisation can open the account.
          </p>
        </div>
      )}
    </div>
  );
}

/** `ORG_STATUS_CHANGED` → "Status changed". Enum names are not labels. */
function humanAction(action) {
  if (!action) return "N/A";
  const words = String(action).toLowerCase().replace(/[_.]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// ─── The write dialogs ───────────────────────────────────────────────────────

/** #291. The heaviest button in the console, so it names the organisation. */
function StatusDialog({ org, next, runWrite, onClose, onDone }) {
  const suspending = next === "suspended";
  return (
    <ReasonDialog
      title={suspending ? DICTIONARY.ORG.SUSPEND : DICTIONARY.ORG.REACTIVATE}
      subtitle={`${org.name} — ${suspending ? DICTIONARY.ORG.SUSPEND_MEANING : DICTIONARY.ORG.REACTIVATE_MEANING}`}
      icon={suspending ? HiBan : HiBadgeCheck}
      tone={suspending ? "danger" : "default"}
      confirmLabel={suspending ? "Suspend" : "Switch on"}
      reasonLabel={suspending ? "Why is this organisation being suspended?" : "Why is it being switched back on?"}
      onClose={onClose}
      onSubmit={async (reason) => {
        const result = await runWrite(() => orgsAPI.setOrgStatus({ orgId: org.id, status: next, reason }));
        onDone(result.changed, next);
      }}
    >
      {suspending && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-100 dark:bg-rose-500/10 dark:border-rose-500/25">
          <HiExclamation className="w-4 h-4 text-rose-600 shrink-0 mt-px dark:text-rose-400" />
          {/* The subtitle above already names the organisation — §10 is
              satisfied there. This line carries the part the subtitle
              doesn't: that it takes effect on people mid-session. */}
          <p className="text-xs font-semibold text-rose-700 leading-relaxed dark:text-rose-300">
            It takes effect immediately, including for anyone signed in right now.
          </p>
        </div>
      )}
    </ReasonDialog>
  );
}

/** #292. A plan granted rather than paid for. */
function PlanDialog({ org, subscription, runWrite, onClose, onDone }) {
  const [planCode, setPlanCode] = useState("");
  const [durationDays, setDurationDays] = useState("");
  const [plans, setPlans] = useState({ status: "loading", rows: [], error: null });

  useEffect(() => {
    const controller = new AbortController();
    orgsAPI
      .listPlans({ signal: controller.signal })
      .then((rows) => {
        if (controller.signal.aborted) return;
        setPlans({ status: "ready", rows, error: null });
      })
      .catch((err) => {
        if (controller.signal.aborted || err?.name === "AbortError") return;
        setPlans({ status: "error", rows: [], error: err });
      });
    return () => controller.abort();
  }, []);

  return (
    <ReasonDialog
      title={DICTIONARY.ORG.GRANT_PLAN}
      subtitle={`${org.name} — ${DICTIONARY.ORG.GRANT_PLAN_MEANING}`}
      icon={HiCreditCard}
      confirmLabel="Grant plan"
      reasonLabel="Why is this being granted?"
      reasonHint="Name the agreement. Granting a plan without a payment is the thing finance will ask about."
      disabled={!planCode || plans.status !== "ready"}
      onClose={onClose}
      onSubmit={async (reason) => {
        const result = await runWrite(() =>
          orgsAPI.grantPlanOverride({
            orgId: org.id,
            planCode,
            // Sent explicitly, and `null` is a real assertion: "I believe
            // this organisation has no subscription". Dropping the key when
            // it is null switches the guard off.
            expectedSubscriptionId: subscription?.id ?? null,
            durationDays,
            reason,
          }),
        );
        onDone(result.changed);
      }}
    >
      {subscription?.plan?.name && (
        <p className="text-xs font-semibold text-slate-500 p-3 rounded-xl bg-slate-50 border border-slate-200 dark:bg-night-800 dark:border-night-700 dark:text-slate-400">
          They are on {subscription.plan.name} today. Granting a plan replaces it.
        </p>
      )}

      <Field label="Plan" htmlFor="grant-plan-code">
        {plans.status === "loading" ? (
          <div className="h-11 rounded-xl bg-slate-200/70 animate-pulse dark:bg-slate-100/10" />
        ) : plans.status === "error" ? (
          <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">Couldn’t load the plans. Try again in a moment.</p>
        ) : (
          <select id="grant-plan-code" value={planCode} onChange={(e) => setPlanCode(e.target.value)} className={FIELD_CLASS}>
            <option value="">Choose a plan…</option>
            {plans.rows
              .filter((p) => p.isActive)
              .map((plan) => (
                <option key={plan.code} value={plan.code}>
                  {plan.name}
                  {plan.maxEmployees === null ? " — no seat limit" : ` — up to ${plan.maxEmployees}`}
                  {plan.isPrivate ? " (private)" : ""}
                </option>
              ))}
          </select>
        )}
      </Field>

      <Field label="For how long" htmlFor="grant-duration" hint="In days. Leave blank for no end date.">
        <input
          id="grant-duration"
          type="number"
          inputMode="numeric"
          min="1"
          value={durationDays}
          onChange={(e) => setDurationDays(e.target.value)}
          placeholder="e.g. 90"
          className={FIELD_CLASS}
        />
      </Field>
    </ReasonDialog>
  );
}

/** #293. The seat ceiling, without touching the plan. */
function SeatsDialog({ org, subscription, usage, runWrite, onClose, onDone }) {
  const [value, setValue] = useState(
    subscription?.limits?.maxEmployees != null ? String(subscription.limits.maxEmployees) : "",
  );
  const [unlimited, setUnlimited] = useState(subscription?.limits?.maxEmployees == null);

  const inUse = usage?.activeEmployees ?? null;
  const asked = unlimited ? null : Number(value);
  // The server refuses a ceiling under the headcount already in use. Said
  // here, beside the field, rather than after a round trip.
  const belowUsage = !unlimited && inUse !== null && Number.isFinite(asked) && asked < inUse;

  return (
    <ReasonDialog
      title={DICTIONARY.ORG.CHANGE_SEATS}
      subtitle={`${org.name} — how many employees they may have on the platform.`}
      icon={HiUserGroup}
      confirmLabel="Change limit"
      reasonLabel="Why is the limit changing?"
      disabled={belowUsage || (!unlimited && !value)}
      onClose={onClose}
      onSubmit={async (reason) => {
        const result = await runWrite(() =>
          orgsAPI.setSeatQuota({
            orgId: org.id,
            // null is "no ceiling" — a real thing an operator grants, and not
            // the same as not sending the field.
            maxEmployees: unlimited ? null : Number(value),
            expectedSubscriptionId: subscription?.id ?? null,
            reason,
          }),
        );
        onDone(result.changed);
      }}
    >
      <p className="text-xs font-semibold text-slate-500 p-3 rounded-xl bg-slate-50 border border-slate-200 dark:bg-night-800 dark:border-night-700 dark:text-slate-400">
        {/* The headcount, printed because the refusal depends on it. When it
            failed to load, say so — never imply zero. */}
        {inUse === null
          ? "Their current headcount didn’t load, so a limit below it will be refused by the server."
          : `They have ${formatCount(inUse)} active employees today.`}
      </p>

      <Field
        label="Seat limit"
        htmlFor="seat-limit"
        hint={belowUsage ? `That is fewer than the ${formatCount(inUse)} they are already using.` : undefined}
      >
        <input
          id="seat-limit"
          type="number"
          inputMode="numeric"
          min="1"
          value={unlimited ? "" : value}
          disabled={unlimited}
          onChange={(e) => setValue(e.target.value)}
          className={`${FIELD_CLASS} ${belowUsage ? "!border-rose-300 dark:!border-rose-500/40" : ""}`}
        />
      </Field>

      <label className="flex items-center gap-2.5 cursor-pointer">
        <input
          type="checkbox"
          checked={unlimited}
          onChange={(e) => setUnlimited(e.target.checked)}
          className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 dark:border-night-600 dark:bg-night-900"
        />
        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">No limit at all</span>
      </label>
    </ReasonDialog>
  );
}

/** #295. The recovery path for an organisation whose HR never got in. */
function InviteHrDialog({ org, runWrite, onClose, onDone }) {
  const [identifier, setIdentifier] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  return (
    <ReasonDialog
      title={DICTIONARY.ORG.INVITE_HR}
      subtitle={`${org.name} — ${DICTIONARY.ORG.INVITE_HR_SUBTITLE}`}
      icon={HiUserAdd}
      confirmLabel="Send invitation"
      reasonLabel="Why does this organisation need a new HR invitation?"
      disabled={!identifier.trim()}
      onClose={onClose}
      onSubmit={async (reason) => {
        const result = await runWrite(() =>
          orgsAPI.resendHrInvitation({
            orgId: org.id,
            identifier: identifier.trim(),
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            reason,
          }),
        );
        onDone(result);
      }}
    >
      <Field
        label="Email or phone number"
        htmlFor="hr-identifier"
        hint="Any invitation already sent to this organisation stops working."
      >
        <input id="hr-identifier" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="hr@company.com" className={FIELD_CLASS} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="First name" htmlFor="hr-first">
          <input id="hr-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={FIELD_CLASS} />
        </Field>
        <Field label="Last name" htmlFor="hr-last">
          <input id="hr-last" value={lastName} onChange={(e) => setLastName(e.target.value)} className={FIELD_CLASS} />
        </Field>
      </div>
    </ReasonDialog>
  );
}
