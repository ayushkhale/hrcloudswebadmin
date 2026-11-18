// ─────────────────────────────────────────────────────────────────────────────
// OrganisationsPage.jsx — Phase 3 (#289), with Phase 4's provisioning (#294).
//
// ONE READ: `orgsAPI.listOrgs()`. Search, filter and paging are all the
// server's, because the organisation table is the one thing in this product
// guaranteed to grow forever and a console that pulls it down to filter it in
// the browser starts lying about how many customers match a search.
//
// The plan catalogue is fetched only when the provisioning dialog opens — the
// list draws each row's plan from the row itself.
//
// Each row says what is DIFFERENT about that organisation, not what the
// heading above it already said: its state, its plan, how full it is, and who
// to ring. Seats are the careful one — `seatSummary` exists because "0 of 150"
// for a headcount that failed to load has talked an operator into cutting
// seats a customer was using.
//
// "Add an organisation" is SUPER_ADMIN only and is absent, not greyed, for
// everybody else. A disabled button advertising a power an operator will
// never have is an invitation to go and ask why.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { HiChevronRight, HiExclamation, HiOfficeBuilding, HiPhone, HiPlus, HiUserAdd } from "react-icons/hi";

import ConsoleTopBar from "../shared/components/ConsoleTopBar";
import ScreenHeader from "../shared/components/ScreenHeader";
import Card from "../shared/components/Card";
import Pill, { Tag } from "../shared/components/Pill";
import { OrgMark } from "../shared/components/StatusPill";
import Dialog, { DialogButton } from "../shared/components/Dialog";
import ReasonDialog, { Field, FIELD_CLASS } from "../shared/components/ReasonDialog";
import OneTimeLink from "../shared/components/OneTimeLink";
import { EmptyState, ErrorState } from "../shared/components/States";
import { SkeletonRows } from "../shared/components/Skeleton";
import { FilterChips, Pager, PrimaryButton, SearchField } from "../shared/components/ListControls";
import { useToast } from "../shared/components/AlertProvider";
import { useAuth } from "../shared/contexts/AuthContext";
import { orgsAPI } from "../shared/api/organisations.api";
import { DICTIONARY } from "../config/dictionary";
import { TIER } from "../config/platformAccess";
import { orgState, seatPressure, seatSummary, subscriptionState } from "../config/platformMeta";
import { displayValue, formatDate } from "../shared/utils/format";

// The server's three organisation statuses, and nothing else. There is no
// "trial" or "grace" organisation status — those belong to the subscription,
// and offering a filter for one would teach the operator a wrong model.
const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
  { value: "inactive", label: "Never finished" },
];

const SEARCH_DEBOUNCE_MS = 300;

export default function OrganisationsPage() {
  const { can } = useAuth();
  const toast = useToast();

  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const [state, setState] = useState({ status: "loading", data: null, error: null });
  const [provisioning, setProvisioning] = useState(false);
  const [provisioned, setProvisioned] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => setPage(1), [debounced, status]);

  const load = useCallback(
    (signal) => {
      setState((prev) => ({ status: "loading", data: prev.data, error: null }));
      orgsAPI
        .listOrgs({ query: debounced, status, page, signal })
        .then((data) => {
          if (signal?.aborted) return;
          setState({ status: "ready", data, error: null });
        })
        .catch((err) => {
          if (signal?.aborted || err?.name === "AbortError") return;
          setState({ status: "error", data: null, error: err });
        });
    },
    [debounced, status, page],
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

  const rows = state.data?.rows || [];
  const searching = Boolean(debounced) || Boolean(status);
  const mayProvision = can(TIER.SUPER_ADMIN);

  return (
    <>
      <ConsoleTopBar title={DICTIONARY.HEADERS.ORGANISATIONS} />

      <main className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 max-w-7xl w-full mx-auto">
        <ScreenHeader
          title={DICTIONARY.ORG.HEADER}
          subtitle={DICTIONARY.ORG.SUBTITLE}
          rightContent={
            mayProvision ? (
              <PrimaryButton icon={HiPlus} onClick={() => setProvisioning(true)} className="w-full sm:w-auto">
                {DICTIONARY.ORG.PROVISION}
              </PrimaryButton>
            ) : null
          }
        />

        <Card>
          <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-5">
            <SearchField
              value={query}
              onChange={setQuery}
              placeholder="Search by name, key, city or contact"
              label="Search organisations"
            />
            <FilterChips options={STATUS_FILTERS} value={status} onChange={setStatus} label="Filter by state" />
          </div>

          {state.status === "error" ? (
            <ErrorState error={state.error} onRetry={reload} fallback="Couldn’t load the organisations." />
          ) : state.status === "loading" && !state.data ? (
            <SkeletonRows rows={8} />
          ) : rows.length === 0 ? (
            searching ? (
              <EmptyState icon={HiOfficeBuilding} title={DICTIONARY.EMPTY.NO_MATCHES} hint={DICTIONARY.EMPTY.NO_MATCHES_HINT} />
            ) : (
              <EmptyState
                icon={HiOfficeBuilding}
                title={DICTIONARY.EMPTY.ORGANISATIONS}
                hint={mayProvision ? "Or add one directly for a deal that isn’t coming through sign-up." : undefined}
              />
            )
          ) : (
            <>
              <div
                className={`divide-y divide-slate-100 dark:divide-night-700 transition-opacity ${
                  state.status === "loading" ? "opacity-50" : ""
                }`}
              >
                {rows.map((org) => (
                  <OrgRow key={org.id} org={org} />
                ))}
              </div>
              <Pager
                page={state.data.page}
                totalPages={state.data.totalPages}
                total={state.data.total}
                shown={rows.length}
                onPage={setPage}
                noun="organisations"
              />
            </>
          )}
        </Card>
      </main>

      {provisioning && (
        <ProvisionDialog
          onClose={() => setProvisioning(false)}
          onDone={(result) => {
            setProvisioning(false);
            reload();
            if (result.invitation?.activationLink) setProvisioned(result);
            else toast.show(`${result.org?.name || "Organisation"} created`);
          }}
        />
      )}

      {provisioned && (
        <Dialog
          open
          onClose={() => setProvisioned(null)}
          title={`${provisioned.org?.name || "Organisation"} is set up`}
          subtitle="Their HR needs this link to open the account."
          icon={HiUserAdd}
          footer={
            <>
              <DialogButton onClick={() => setProvisioned(null)}>Close</DialogButton>
              {provisioned.org?.id && (
                <Link to={`/console/organisations/${provisioned.org.id}`} onClick={() => setProvisioned(null)}>
                  <DialogButton variant="primary">Open the record</DialogButton>
                </Link>
              )}
            </>
          }
        >
          <OneTimeLink
            link={provisioned.invitation.activationLink}
            emailDelivered={provisioned.invitation.emailDelivered}
          />
        </Dialog>
      )}
    </>
  );
}

// ─── A row ───────────────────────────────────────────────────────────────────

function OrgRow({ org }) {
  const state = orgState(org.status);
  const seats = seatSummary(org.usage.activeEmployees, org.usage.seatLimit);
  const sub = org.plan?.subscriptionStatus ? subscriptionState(org.plan.subscriptionStatus) : null;

  return (
    <Link
      to={`/console/organisations/${org.id}`}
      className="flex flex-col sm:flex-row sm:items-center gap-3 py-4 first:pt-0 last:pb-0 group"
    >
      {/* The mark stays beside the name at every width. Letting it fall onto
          its own line when the row stacks leaves a lone initialled square
          above the organisation it belongs to, which reads as a separator. */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <OrgMark name={org.name} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold text-slate-800 truncate group-hover:text-purple-700 transition-colors dark:text-slate-100 dark:group-hover:text-purple-300">
              {org.name}
            </p>
            <Pill label={state.label} tone={state.tone} title={state.meaning || undefined} />
          </div>
          <p className="text-xs font-semibold text-slate-400 truncate mt-0.5 dark:text-slate-500">
            {/* Where they are and what they do — the two things that tell one
                "Veridian" apart from another on a support call. */}
            {[org.industry, org.city].filter(Boolean).join(" · ") || `${DICTIONARY.ORG.JOINED} ${formatDate(org.createdAt)}`}
          </p>
        </div>
      </div>

      {/* Plan. `isOverride` is flagged on the row rather than buried in the
          record: an operator who sees a customer on enterprise needs to know
          immediately whether anyone is paying for it. */}
      <div className="sm:w-48 min-w-0">
        {org.plan ? (
          <>
            <p className="text-xs font-bold text-slate-700 truncate dark:text-slate-200">{org.plan.name}</p>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {sub && <Pill label={sub.label} tone={sub.tone} />}
              {org.plan.isOverride && <Tag>{DICTIONARY.ORG.GRANTED}</Tag>}
            </div>
          </>
        ) : (
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">{DICTIONARY.ORG.NO_PLAN}</p>
        )}
      </div>

      {/* Seats. Three different facts, and only one of them is a fraction. */}
      <div className="sm:w-32 min-w-0">
        <p className={`text-xs font-bold tabular-nums ${seats.unknown ? "text-slate-400 dark:text-slate-500" : "text-slate-700 dark:text-slate-200"}`}>
          {seats.text}
        </p>
        {seats.note ? (
          <p className="text-[11px] font-semibold text-slate-400 mt-0.5 dark:text-slate-500">{seats.note}</p>
        ) : seats.percent !== null ? (
          <div className="mt-1.5 h-1 rounded-full bg-slate-100 overflow-hidden dark:bg-night-700">
            <div
              className={`h-full rounded-full ${seatPressure(seats.percent).bar}`}
              style={{ width: `${Math.min(100, seats.percent)}%` }}
            />
          </div>
        ) : null}
      </div>

      {/* Who to ring. An organisation with nobody reachable is an operational
          problem, not a blank cell — so it is said in words. */}
      <div className="sm:w-44 min-w-0">
        {org.contact ? (
          <>
            <p className="text-xs font-bold text-slate-700 truncate dark:text-slate-200">{displayValue(org.contact.name)}</p>
            <p className="text-[11px] font-semibold text-slate-400 truncate flex items-center gap-1 mt-0.5 dark:text-slate-500">
              {/* An HR identified by phone has no email at all. Showing the
                  identifier rather than `email` is what keeps them reachable. */}
              {org.contact.identifierType === "phone" && <HiPhone className="w-3 h-3 shrink-0" />}
              {displayValue(org.contact.identifier)}
            </p>
          </>
        ) : (
          <p className="text-[11px] font-bold text-fuchsia-700 flex items-start gap-1 leading-relaxed dark:text-fuchsia-300">
            <HiExclamation className="w-3.5 h-3.5 shrink-0 mt-px" />
            {DICTIONARY.ORG.NO_CONTACT}
          </p>
        )}
      </div>

      <HiChevronRight className="hidden sm:block w-4 h-4 text-slate-300 shrink-0 group-hover:text-purple-500 transition-colors dark:text-slate-600" />
    </Link>
  );
}

// ─── #294 Provisioning ───────────────────────────────────────────────────────

/**
 * Create a customer directly, for a signed deal that is not coming through
 * self-serve signup.
 *
 * One call does three things — organisation, plan, first HR — and it can
 * half-succeed: the organisation lands and the invitation email bounces. That
 * is why the HR fields are optional (an organisation with no HR is recoverable
 * through #295) and why the activation link gets a dialog of its own rather
 * than a toast.
 */
function ProvisionDialog({ onClose, onDone }) {
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [keyEdited, setKeyEdited] = useState(false);
  const [planCode, setPlanCode] = useState("");
  const [seatLimit, setSeatLimit] = useState("");
  const [hrIdentifier, setHrIdentifier] = useState("");
  const [hrFirstName, setHrFirstName] = useState("");
  const [hrLastName, setHrLastName] = useState("");

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

  const effectiveKey = keyEdited ? key : slugify(name);

  return (
    <ReasonDialog
      title={DICTIONARY.ORG.PROVISION}
      subtitle={DICTIONARY.ORG.PROVISION_SUBTITLE}
      icon={HiOfficeBuilding}
      confirmLabel="Create organisation"
      reasonLabel="What is this organisation for?"
      reasonHint="Name the deal or the agreement. It goes in the audit trail under your name."
      disabled={!name.trim()}
      onClose={onClose}
      onSubmit={async (reason) => {
        const result = await orgsAPI.provisionOrg({
          name: name.trim(),
          key: effectiveKey,
          planCode,
          seatLimit,
          hrIdentifier: hrIdentifier.trim(),
          hrFirstName: hrFirstName.trim(),
          hrLastName: hrLastName.trim(),
          reason,
        });
        onDone(result);
      }}
    >
      <Field label="Organisation name" htmlFor="prov-name">
        <input id="prov-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nimbus Logistics" className={FIELD_CLASS} />
      </Field>

      <Field label="Key" htmlFor="prov-key" hint="Short, lowercase. It appears in their URLs and can’t be changed.">
        <input
          id="prov-key"
          value={effectiveKey}
          onChange={(e) => {
            setKeyEdited(true);
            setKey(slugify(e.target.value));
          }}
          className={`${FIELD_CLASS} font-mono`}
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Plan" htmlFor="prov-plan" hint="Granted without a payment.">
          {plans.status === "loading" ? (
            <div className="h-11 rounded-xl bg-slate-200/70 animate-pulse dark:bg-slate-100/10" />
          ) : plans.status === "error" ? (
            <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">
              Couldn’t load the plans. You can add one after the organisation exists.
            </p>
          ) : (
            <select id="prov-plan" value={planCode} onChange={(e) => setPlanCode(e.target.value)} className={FIELD_CLASS}>
              <option value="">No plan for now</option>
              {plans.rows
                .filter((p) => p.isActive)
                .map((plan) => (
                  <option key={plan.code} value={plan.code}>
                    {plan.name}
                    {plan.isPrivate ? " (private)" : ""}
                  </option>
                ))}
            </select>
          )}
        </Field>

        <Field label="Seat limit" htmlFor="prov-seats" hint="Leave blank to use the plan’s own limit.">
          <input
            id="prov-seats"
            type="number"
            inputMode="numeric"
            min="1"
            value={seatLimit}
            onChange={(e) => setSeatLimit(e.target.value)}
            className={FIELD_CLASS}
          />
        </Field>
      </div>

      {/* Optional, and said so. An organisation with no HR is recoverable
          through "Invite an HR" on its record — this is not the last chance. */}
      <div className="pt-1 border-t border-slate-100 dark:border-night-700">
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider pt-3 mb-2 dark:text-slate-500">
          Their first HR — optional
        </p>
        <Field label="Email or phone number" htmlFor="prov-hr" hint="They get a link to set a password. You can also do this later.">
          <input id="prov-hr" value={hrIdentifier} onChange={(e) => setHrIdentifier(e.target.value)} placeholder="hr@company.com" className={FIELD_CLASS} />
        </Field>
        {hrIdentifier.trim() && (
          <div className="grid grid-cols-2 gap-3 mt-3">
            <Field label="First name" htmlFor="prov-hr-first">
              <input id="prov-hr-first" value={hrFirstName} onChange={(e) => setHrFirstName(e.target.value)} className={FIELD_CLASS} />
            </Field>
            <Field label="Last name" htmlFor="prov-hr-last">
              <input id="prov-hr-last" value={hrLastName} onChange={(e) => setHrLastName(e.target.value)} className={FIELD_CLASS} />
            </Field>
          </div>
        )}
      </div>
    </ReasonDialog>
  );
}

const slugify = (value) =>
  (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
