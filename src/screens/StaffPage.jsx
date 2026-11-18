// ─────────────────────────────────────────────────────────────────────────────
// StaffPage.jsx — Phase 2. Who can open this console.
//
// ONE READ: `staffAPI.listStaff()`. The role catalog is a SECOND call and it
// is a deliberate exception rather than a slip: the roster doesn't draw roles
// it hasn't been given — each row carries its own `role.name` — so the catalog
// is only needed by the invite and change-role dialogs, and it is fetched when
// one of those opens. Loading it with the page would be a second spinner on
// every visit to pay for a form most visits never open.
//
// The screen protects against two mistakes the server also refuses, because
// being refused after typing a reason is a worse way to learn:
//   • You cannot change or revoke your own access. The row says "This is you"
//     and offers nothing.
//   • The last person with full access cannot be demoted or removed. The
//     server counts; the console doesn't guess, it just surfaces the refusal
//     in words (CANNOT_MODIFY_LAST_SUPER_ADMIN).
//
// Both flags on every row. `is_active` is the grant, `status` is the account
// under it, and the server refuses a sign-in on either — so a roster showing
// only the grant will insist somebody has access while they sit locked out.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useState } from "react";
import {
  HiBan,
  HiCheckCircle,
  HiExclamation,
  HiIdentification,
  HiPencilAlt,
  HiPlus,
  HiShieldExclamation,
  HiUserAdd,
  HiUserGroup,
} from "react-icons/hi";

import ConsoleTopBar from "../shared/components/ConsoleTopBar";
import ScreenHeader from "../shared/components/ScreenHeader";
import Card from "../shared/components/Card";
import Pill, { Tag } from "../shared/components/Pill";
import Dialog, { DialogButton } from "../shared/components/Dialog";
import ReasonDialog, { Field, FIELD_CLASS } from "../shared/components/ReasonDialog";
import OneTimeLink from "../shared/components/OneTimeLink";
import { ErrorState, EmptyState } from "../shared/components/States";
import { SkeletonRows } from "../shared/components/Skeleton";
import { FilterChips, GhostButton, Pager, PrimaryButton, SearchField } from "../shared/components/ListControls";
import { useToast } from "../shared/components/AlertProvider";
import { useAuth } from "../shared/contexts/AuthContext";
import { staffAPI } from "../shared/api/staff.api";
import { DICTIONARY } from "../config/dictionary";
import { TIER, TIER_META } from "../config/platformAccess";
import { PILL_TONE, staffState } from "../config/platformMeta";
import { displayValue, formatDate, timeAgo } from "../shared/utils/format";

const TIER_FILTERS = [
  { value: "", label: "Everyone" },
  { value: TIER.SUPER_ADMIN, label: "Full access" },
  { value: TIER.ADMIN, label: "Operators" },
  { value: TIER.WORKER, label: "Support" },
];

// Long enough that typing a name is one request, short enough that it feels
// like the list is keeping up.
const SEARCH_DEBOUNCE_MS = 300;

export default function StaffPage() {
  const { actor } = useAuth();
  const toast = useToast();

  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [tier, setTier] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [page, setPage] = useState(1);

  const [state, setState] = useState({ status: "loading", data: null, error: null });

  // Which dialog is open, and about whom. One piece of state, so two dialogs
  // can never be open at once.
  const [dialog, setDialog] = useState(null);
  const [roles, setRoles] = useState({ status: "idle", rows: [], error: null });
  // The activation link, held after the grant dialog closes. It is the only
  // copy in existence, so it gets its own dialog that does not auto-dismiss.
  const [grantResult, setGrantResult] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  // A new search starts at page one. Staying on page three of the old result
  // shows an empty list and looks like a failure.
  useEffect(() => setPage(1), [debounced, tier, includeInactive]);

  const load = useCallback(
    (signal) => {
      setState((prev) => ({ status: "loading", data: prev.data, error: null }));
      staffAPI
        .listStaff({ query: debounced, tier, includeInactive, page, signal })
        .then((data) => {
          if (signal?.aborted) return;
          setState({ status: "ready", data, error: null });
        })
        .catch((err) => {
          // An answer that lands after the screen is gone must not set state.
          if (signal?.aborted || err?.name === "AbortError") return;
          setState({ status: "error", data: null, error: err });
        });
    },
    [debounced, tier, includeInactive, page],
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

  /** The catalog, fetched the first time a form needs it and then kept. */
  const ensureRoles = useCallback(() => {
    if (roles.status === "ready" || roles.status === "loading") return;
    setRoles({ status: "loading", rows: [], error: null });
    staffAPI
      .listRoles()
      .then((rows) => setRoles({ status: "ready", rows, error: null }))
      .catch((err) => setRoles({ status: "error", rows: [], error: err }));
  }, [roles.status]);

  function openDialog(next) {
    ensureRoles();
    setDialog(next);
  }

  const rows = state.data?.rows || [];
  const searching = Boolean(debounced) || Boolean(tier);

  return (
    <>
      <ConsoleTopBar title={DICTIONARY.HEADERS.STAFF} />

      <main className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 max-w-7xl w-full mx-auto">
        <ScreenHeader
          title={DICTIONARY.STAFF.HEADER}
          subtitle={DICTIONARY.STAFF.SUBTITLE}
          rightContent={
            <PrimaryButton icon={HiUserAdd} onClick={() => openDialog({ kind: "grant" })} className="w-full sm:w-auto">
              {DICTIONARY.STAFF.GRANT}
            </PrimaryButton>
          }
        />

        <Card>
          <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-5">
            <SearchField
              value={query}
              onChange={setQuery}
              placeholder="Search by name, email or role"
              label="Search platform staff"
            />
            <FilterChips options={TIER_FILTERS} value={tier} onChange={setTier} label="Filter by access level" />
            {/* Off by default: the roster answers "who can get in right now".
                People whose access was revoked are a different question, and
                the operator has to ask it. */}
            <GhostButton
              onClick={() => setIncludeInactive((v) => !v)}
              aria-pressed={includeInactive}
              className={includeInactive ? "border-purple-200 text-purple-700 bg-purple-50 dark:bg-purple-500/15 dark:border-purple-500/30 dark:text-purple-200" : ""}
            >
              {includeInactive ? "Hiding nobody" : "Show removed"}
            </GhostButton>
          </div>

          {state.status === "error" ? (
            <ErrorState error={state.error} onRetry={reload} fallback="Couldn’t load the staff list." />
          ) : state.status === "loading" && !state.data ? (
            <SkeletonRows rows={6} />
          ) : rows.length === 0 ? (
            searching ? (
              <EmptyState
                icon={HiUserGroup}
                title={DICTIONARY.EMPTY.NO_MATCHES}
                hint={DICTIONARY.EMPTY.NO_MATCHES_HINT}
              />
            ) : (
              <EmptyState
                icon={HiUserGroup}
                title={DICTIONARY.EMPTY.STAFF}
                hint={DICTIONARY.EMPTY.STAFF_HINT}
                action={
                  <PrimaryButton icon={HiUserAdd} onClick={() => openDialog({ kind: "grant" })}>
                    {DICTIONARY.STAFF.GRANT}
                  </PrimaryButton>
                }
              />
            )
          ) : (
            <>
              <div
                // Dims while a new page is in flight rather than swapping the
                // rows for a skeleton: the list is already the right shape,
                // and replacing it would make a filter click feel like a
                // whole page load.
                className={`divide-y divide-slate-100 dark:divide-night-700 transition-opacity ${
                  state.status === "loading" ? "opacity-50" : ""
                }`}
              >
                {rows.map((member) => (
                  <StaffRow
                    key={member.userId}
                    member={member}
                    isSelf={member.userId === actor?.id}
                    onChangeRole={() => openDialog({ kind: "role", member })}
                    onRevoke={() => openDialog({ kind: "revoke", member })}
                  />
                ))}
              </div>
              <Pager
                page={state.data.page}
                totalPages={state.data.totalPages}
                total={state.data.total}
                shown={rows.length}
                onPage={setPage}
                noun="people"
              />
            </>
          )}
        </Card>
      </main>

      {dialog?.kind === "grant" && (
        <GrantDialog
          roles={roles}
          onRetryRoles={ensureRoles}
          onClose={() => setDialog(null)}
          onDone={(result) => {
            setDialog(null);
            reload();
            // A link that will never be shown again does not go in a toast.
            if (result.activationLink) setGrantResult(result);
            else toast.show(result.createdUser ? "Invitation sent" : "Access granted");
          }}
        />
      )}

      {dialog?.kind === "role" && (
        <ChangeRoleDialog
          member={dialog.member}
          roles={roles}
          onRetryRoles={ensureRoles}
          onClose={() => setDialog(null)}
          onDone={(changed) => {
            setDialog(null);
            reload();
            toast.show(changed ? "Role changed" : "They were already on that role");
          }}
        />
      )}

      {dialog?.kind === "revoke" && (
        <RevokeDialog
          member={dialog.member}
          onClose={() => setDialog(null)}
          onDone={(changed) => {
            setDialog(null);
            reload();
            toast.show(changed ? "Access removed" : "They already had no access");
          }}
        />
      )}

      {grantResult && (
        <Dialog
          open
          onClose={() => setGrantResult(null)}
          title="Access granted"
          subtitle={DICTIONARY.STAFF.LINK_ONCE}
          icon={HiCheckCircle}
          footer={<DialogButton variant="primary" onClick={() => setGrantResult(null)}>Done</DialogButton>}
        >
          <OneTimeLink link={grantResult.activationLink} emailDelivered={grantResult.emailDelivered} />
        </Dialog>
      )}
    </>
  );
}

// ─── A row ───────────────────────────────────────────────────────────────────

function StaffRow({ member, isSelf, onChangeRole, onRevoke }) {
  const state = staffState(member);
  const tierLabel = member.tier ? TIER_META[member.tier]?.label : null;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 py-4 first:pt-0 last:pb-0">
      {/* Initials stay beside the name at every width — a lone square above
          the person it belongs to reads as a separator, not an avatar. */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <span className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 font-bold text-xs flex items-center justify-center shrink-0 border border-purple-100 dark:bg-purple-500/15 dark:text-purple-200 dark:border-purple-500/25">
          {initials(member)}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Somebody created by the bootstrap CLI has NO profile row, and
                they are the first row in this table. Heading their row "N/A"
                makes the roster look broken at exactly the point an operator
                is checking whether it works, so the identifier stands in —
                and the line below it is dropped rather than printed twice. */}
            <p className="text-sm font-bold text-slate-800 truncate dark:text-slate-100">
              {displayValue(member.name || member.identifier)}
            </p>
            {isSelf && <Tag>{DICTIONARY.STAFF.SELF}</Tag>}
            {!member.hasProfileName && <Tag>No profile name</Tag>}
          </div>
          {member.hasProfileName && (
            <p className="text-xs font-semibold text-slate-400 truncate mt-0.5 dark:text-slate-500">
              {displayValue(member.identifier)}
            </p>
          )}
        </div>
      </div>

      {/* The role as the server named it, never a label this build invented.
          Custom roles carry keys no build has seen. */}
      <div className="sm:w-44 min-w-0 flex items-center gap-1.5 flex-wrap">
        <Pill
          label={displayValue(member.role?.name)}
          tone={PILL_TONE.info}
          title={tierLabel ? `${tierLabel} · priority ${member.role?.priority ?? "N/A"}` : undefined}
        />
        {member.role && !member.role.isActive && (
          <Tag>{DICTIONARY.ROLES.RETIRED}</Tag>
        )}
      </div>

      <div className="sm:w-40 min-w-0">
        <Pill label={state.label} tone={state.tone} title={state.why || undefined} />
      </div>

      {/* What is DIFFERENT about this row, not what the heading already said:
          when they were last actually here. */}
      <div className="sm:w-28 min-w-0">
        <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
          {member.lastLoginAt ? timeAgo(member.lastLoginAt) : DICTIONARY.STAFF.NEVER_SIGNED_IN}
        </p>
        <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
          {member.assignedBy === null && member.assignedAt
            ? DICTIONARY.STAFF.ADDED_BY_SETUP
            : `${DICTIONARY.STAFF.ADDED} ${formatDate(member.assignedAt)}`}
        </p>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {isSelf ? (
          // Nothing at all. Not a disabled button — a greyed "Remove access"
          // on your own row is an invitation to find out what it does — and
          // not a dash either, which is the one thing this product never
          // renders. The "This is you" tag on the row already says why the
          // buttons are missing.
          null
        ) : (
          <>
            <GhostButton icon={HiPencilAlt} onClick={onChangeRole} className="!px-2.5">
              <span className="sr-only sm:not-sr-only">Role</span>
            </GhostButton>
            {member.isActive && (
              <GhostButton
                icon={HiBan}
                onClick={onRevoke}
                className="!px-2.5 hover:!text-rose-700 hover:!bg-rose-50 dark:hover:!bg-rose-500/10 dark:hover:!text-rose-300"
              >
                <span className="sr-only">{DICTIONARY.STAFF.REVOKE}</span>
              </GhostButton>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function initials(member) {
  const source = member.name || member.identifier || "";
  const words = source.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

// ─── The dialogs ─────────────────────────────────────────────────────────────

/** The role `<select>`, with the catalog's three failure modes handled. */
function RolePicker({ roles, value, onChange, onRetry, id = "role-picker" }) {
  if (roles.status === "error") {
    return (
      <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-100 dark:bg-rose-500/10 dark:border-rose-500/25">
        <HiExclamation className="w-4 h-4 text-rose-600 shrink-0 mt-px dark:text-rose-400" />
        <div>
          <p className="text-xs font-semibold text-rose-700 dark:text-rose-300">Couldn’t load the roles.</p>
          <button type="button" onClick={onRetry} className="text-xs font-bold text-rose-700 underline mt-1 dark:text-rose-300">
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (roles.status !== "ready") {
    return <div className="h-11 rounded-xl bg-slate-200/70 animate-pulse dark:bg-slate-100/10" />;
  }

  // `assignableViaApi`, NOT `isAssignable`. The seeded `admin` role has
  // `is_assignable: false` and is the most common thing anyone grants.
  const options = staffAPI.assignableRoles(roles.rows);

  if (options.length === 0) {
    return (
      <p className="text-xs font-semibold text-slate-500 p-3 rounded-xl bg-slate-50 border border-slate-200 dark:bg-night-800 dark:border-night-700 dark:text-slate-400">
        No role can be handed out from here. Create one on the Roles screen first.
      </p>
    );
  }

  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={FIELD_CLASS}>
      <option value="">Choose a role…</option>
      {options.map((role) => (
        <option key={role.key} value={role.key}>
          {role.name}
          {role.description ? ` — ${role.description}` : ""}
        </option>
      ))}
    </select>
  );
}

function GrantDialog({ roles, onRetryRoles, onClose, onDone }) {
  const [identifier, setIdentifier] = useState("");
  const [roleKey, setRoleKey] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  return (
    <ReasonDialog
      title={DICTIONARY.STAFF.GRANT}
      subtitle={DICTIONARY.STAFF.GRANT_SUBTITLE}
      icon={HiUserAdd}
      confirmLabel="Give access"
      reasonLabel="Why does this person need access?"
      disabled={!identifier.trim() || !roleKey}
      onClose={onClose}
      onSubmit={async (reason) => {
        const result = await staffAPI.grantStaffAccess({
          identifier: identifier.trim(),
          roleKey,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          reason,
        });
        onDone(result);
      }}
    >
      <Field
        label="Email or phone number"
        htmlFor="grant-identifier"
        hint="If they already use HR Clouds they keep their existing password — no invitation is sent."
      >
        <input
          id="grant-identifier"
          type="text"
          autoComplete="off"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="name@hrclouds.in"
          className={FIELD_CLASS}
        />
      </Field>

      <Field label={DICTIONARY.STAFF.ROLE} htmlFor="grant-role">
        <RolePicker roles={roles} value={roleKey} onChange={setRoleKey} onRetry={onRetryRoles} id="grant-role" />
      </Field>

      {/* Only used when the account has to be created. Said so, rather than
          leaving two fields that look required. */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="First name" htmlFor="grant-first" hint="Only used if we have to create the account.">
          <input id="grant-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={FIELD_CLASS} />
        </Field>
        <Field label="Last name" htmlFor="grant-last">
          <input id="grant-last" value={lastName} onChange={(e) => setLastName(e.target.value)} className={FIELD_CLASS} />
        </Field>
      </div>
    </ReasonDialog>
  );
}

function ChangeRoleDialog({ member, roles, onRetryRoles, onClose, onDone }) {
  const [roleKey, setRoleKey] = useState("");

  return (
    <ReasonDialog
      title={DICTIONARY.STAFF.CHANGE_ROLE}
      // Named, every time. "Are you sure?" is a formality, not a confirmation.
      subtitle={`${displayValue(member.name)} is ${displayValue(member.role?.name)} today.`}
      icon={HiIdentification}
      confirmLabel="Change role"
      reasonLabel="Why is their role changing?"
      disabled={!roleKey}
      onClose={onClose}
      onSubmit={async (reason) => {
        const result = await staffAPI.changeStaffRole({ userId: member.userId, roleKey, reason });
        // `changed: false` is a success with nothing to report — they already
        // held that role. Saying "saved" would be a lie the operator can't see.
        onDone(result.changed);
      }}
    >
      <Field label="New role" htmlFor="change-role">
        <RolePicker roles={roles} value={roleKey} onChange={setRoleKey} onRetry={onRetryRoles} id="change-role" />
      </Field>
    </ReasonDialog>
  );
}

function RevokeDialog({ member, onClose, onDone }) {
  return (
    <ReasonDialog
      title={DICTIONARY.STAFF.REVOKE}
      subtitle={`${displayValue(member.name)} will no longer be able to open this console.`}
      icon={HiShieldExclamation}
      tone="danger"
      confirmLabel={DICTIONARY.STAFF.REVOKE}
      reasonLabel="Why is their access being removed?"
      onClose={onClose}
      onSubmit={async (reason) => {
        // The reason travels in the BODY of a DELETE. See staff.api.js — this
        // is the call a tidy-up refactor is most likely to break.
        const result = await staffAPI.revokeStaffAccess({ userId: member.userId, reason });
        onDone(result.changed);
      }}
    >
      <p className="flex items-start gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-600 leading-relaxed dark:bg-night-800 dark:border-night-700 dark:text-slate-300">
        <HiPlus className="w-4 h-4 shrink-0 mt-px rotate-45 text-slate-400" />
        {DICTIONARY.STAFF.REVOKE_MEANING}
      </p>
    </ReasonDialog>
  );
}
