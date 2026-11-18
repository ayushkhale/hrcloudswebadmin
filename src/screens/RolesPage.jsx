// ─────────────────────────────────────────────────────────────────────────────
// RolesPage.jsx — Phase 2. The roles themselves: what each one reaches, who
// holds it, and whether it can still be handed out.
//
// ONE READ: `staffAPI.listRoles()`. The catalog is flat, unpaginated and
// small — there will never be forty of these — so there is no search and no
// pager, and adding either would be furniture.
//
// The screen exists because of custom roles. From this phase the platform can
// define a role at priority 71–99 with any key it likes, and the moment that
// is possible somebody needs a place to see what exists, what band each one
// lands in, and which of them are safe to hand out. The alternative is reading
// it out of the database.
//
// The two fields that look like one and are not:
//   is_active          — can this role be handed out at all any more?
//   assignable_via_api — can it be handed out THROUGH THIS CONSOLE?
// The seeded `admin` role is `is_assignable: false` and yet is the most common
// grant in the product. So the row prints the honest answer rather than either
// raw flag, and `assignableRoles()` in the api layer is the only thing a
// picker is allowed to use.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useState } from "react";
import { HiCollection, HiLockClosed, HiPlus, HiUserGroup } from "react-icons/hi";

import ConsoleTopBar from "../shared/components/ConsoleTopBar";
import ScreenHeader from "../shared/components/ScreenHeader";
import Card, { CardHeader } from "../shared/components/Card";
import Pill, { Tag } from "../shared/components/Pill";
import ReasonDialog, { Field, FIELD_CLASS } from "../shared/components/ReasonDialog";
import { EmptyState, ErrorState } from "../shared/components/States";
import { SkeletonRows } from "../shared/components/Skeleton";
import { PrimaryButton } from "../shared/components/ListControls";
import { useToast } from "../shared/components/AlertProvider";
import { CUSTOM_ROLE_PRIORITY, staffAPI } from "../shared/api/staff.api";
import { DICTIONARY } from "../config/dictionary";
import { TIER_META } from "../config/platformAccess";
import { PILL_TONE } from "../config/platformMeta";
import { displayValue, formatCount } from "../shared/utils/format";

export default function RolesPage() {
  const toast = useToast();
  const [state, setState] = useState({ status: "loading", rows: null, error: null });
  const [creating, setCreating] = useState(false);

  const load = useCallback((signal) => {
    setState((prev) => ({ status: "loading", rows: prev.rows, error: null }));
    staffAPI
      .listRoles({ signal })
      .then((rows) => {
        if (signal?.aborted) return;
        setState({ status: "ready", rows, error: null });
      })
      .catch((err) => {
        if (signal?.aborted || err?.name === "AbortError") return;
        setState({ status: "error", rows: null, error: err });
      });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const reload = () => {
    const controller = new AbortController();
    load(controller.signal);
  };

  const rows = state.rows || [];
  // Highest priority first: the way the bands actually stack, so the three
  // seeded roles bracket whatever has been invented between them.
  const sorted = [...rows].sort((a, b) => (b.priority || 0) - (a.priority || 0));

  return (
    <>
      <ConsoleTopBar title={DICTIONARY.HEADERS.ROLES} />

      <main className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 max-w-7xl w-full mx-auto">
        <ScreenHeader
          title={DICTIONARY.ROLES.HEADER}
          subtitle={DICTIONARY.ROLES.SUBTITLE}
          rightContent={
            <PrimaryButton icon={HiPlus} onClick={() => setCreating(true)} className="w-full sm:w-auto">
              {DICTIONARY.ROLES.CREATE}
            </PrimaryButton>
          }
        />

        <Card>
          <CardHeader
            title="Every role on the platform"
            // One subtitle line, and it earns its place by explaining the
            // ordering rather than restating the heading.
            subtitle="Highest access first. A role’s priority decides its band."
            icon={HiCollection}
          />

          {state.status === "error" ? (
            <ErrorState error={state.error} onRetry={reload} fallback="Couldn’t load the roles." />
          ) : state.status === "loading" && !state.rows ? (
            <SkeletonRows rows={5} />
          ) : sorted.length === 0 ? (
            <EmptyState
              icon={HiCollection}
              title={DICTIONARY.EMPTY.ROLES}
              hint="The three built-in roles ship with the platform, so this is unexpected."
            />
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-night-700">
              {sorted.map((role) => (
                <RoleRow key={role.id || role.key} role={role} />
              ))}
            </div>
          )}
        </Card>
      </main>

      {creating && (
        <CreateRoleDialog
          existing={rows}
          onClose={() => setCreating(false)}
          onDone={(role) => {
            setCreating(false);
            reload();
            toast.show(`${role.name} created`);
          }}
        />
      )}
    </>
  );
}

function RoleRow({ role }) {
  const tierMeta = role.tier ? TIER_META[role.tier] : null;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 py-4 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{role.name}</p>
          {role.isSystemRole && <Tag>{DICTIONARY.ROLES.SYSTEM}</Tag>}
          {!role.isActive && (
            <Pill label={DICTIONARY.ROLES.RETIRED} tone={PILL_TONE.off} title={DICTIONARY.ROLES.RETIRED_MEANING} />
          )}
          {/* An active role that still can't be granted from here. Said
              plainly, because the alternative is an operator hunting for a
              role in the invite dropdown that is never going to appear. */}
          {role.isActive && !role.assignableViaApi && (
            <Pill
              label={DICTIONARY.ROLES.NOT_ASSIGNABLE}
              tone={PILL_TONE.off}
              icon={HiLockClosed}
              title="It exists and people may hold it, but it isn’t offered in the invite form."
            />
          )}
        </div>
        <p className="text-xs font-semibold text-slate-400 mt-0.5 dark:text-slate-500">
          {displayValue(role.description)}
        </p>
      </div>

      {/* The band, and the number that puts it in that band. The band alone
          hides why; the number alone means nothing to a new operator. */}
      <div className="sm:w-44 min-w-0">
        <Pill label={displayValue(tierMeta?.label)} tone={PILL_TONE.info} title={tierMeta?.summary || undefined} />
        <p className="text-[11px] font-bold text-slate-400 mt-1 tabular-nums dark:text-slate-500">
          {DICTIONARY.ROLES.PRIORITY} {displayValue(role.priority)}
        </p>
      </div>

      <div className="sm:w-36 min-w-0 flex items-center gap-1.5">
        <HiUserGroup className="w-3.5 h-3.5 text-slate-400 shrink-0 dark:text-slate-500" />
        <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
          {/* A measured zero is "0". An uncounted one is N/A. Not the same. */}
          {role.assignedCount === null ? "N/A" : formatCount(role.assignedCount)}
          <span className="font-semibold text-slate-400 dark:text-slate-500"> holding it</span>
        </p>
      </div>
    </div>
  );
}

function CreateRoleDialog({ existing, onClose, onDone }) {
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("75");

  // The key is derived from the name until somebody edits it: a role key is a
  // slug nobody wants to type, and getting it wrong is permanent.
  const [keyEdited, setKeyEdited] = useState(false);
  const effectiveKey = keyEdited ? key : slugify(name);

  const priorityNumber = Number(priority);
  const priorityValid =
    Number.isInteger(priorityNumber) &&
    priorityNumber >= CUSTOM_ROLE_PRIORITY.MIN &&
    priorityNumber <= CUSTOM_ROLE_PRIORITY.MAX;

  // Checked here as well as on the server, because a taken key comes back as
  // ROLE_KEY_TAKEN after a round trip and after a reason has been typed.
  const keyTaken = existing.some((r) => r.key === effectiveKey);

  // Which band the number lands in, said as the number is typed rather than
  // explained in a paragraph above it.
  const band = priorityValid ? (priorityNumber >= 80 ? TIER_META.ADMIN : TIER_META.WORKER) : null;

  return (
    <ReasonDialog
      title={DICTIONARY.ROLES.CREATE}
      subtitle={DICTIONARY.ROLES.CREATE_SUBTITLE}
      icon={HiPlus}
      confirmLabel="Create role"
      reasonLabel="What is this role for?"
      disabled={!name.trim() || !effectiveKey || !priorityValid || keyTaken}
      onClose={onClose}
      onSubmit={async (reason) => {
        const role = await staffAPI.createRole({
          key: effectiveKey,
          name: name.trim(),
          description: description.trim(),
          priority: priorityNumber,
          reason,
        });
        onDone(role);
      }}
    >
      <Field label="Name" htmlFor="role-name" hint="What you would call the job out loud.">
        <input
          id="role-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Support Lead"
          className={FIELD_CLASS}
        />
      </Field>

      <Field
        label="Key"
        htmlFor="role-key"
        hint={keyTaken ? "A role with that key already exists." : "Used by the server. It can’t be changed later."}
      >
        <input
          id="role-key"
          value={effectiveKey}
          onChange={(e) => {
            setKeyEdited(true);
            setKey(slugify(e.target.value));
          }}
          placeholder="support-lead"
          className={`${FIELD_CLASS} font-mono ${keyTaken ? "!border-rose-300 dark:!border-rose-500/40" : ""}`}
        />
      </Field>

      <Field
        label={DICTIONARY.ROLES.PRIORITY}
        htmlFor="role-priority"
        hint={
          band
            ? `${priorityNumber} makes this ${band.label.toLowerCase()} — ${band.summary}`
            : DICTIONARY.ROLES.PRIORITY_BAND
        }
      >
        <input
          id="role-priority"
          type="number"
          inputMode="numeric"
          min={CUSTOM_ROLE_PRIORITY.MIN}
          max={CUSTOM_ROLE_PRIORITY.MAX}
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className={`${FIELD_CLASS} ${priority && !priorityValid ? "!border-rose-300 dark:!border-rose-500/40" : ""}`}
        />
      </Field>

      <Field label="Description" htmlFor="role-description" hint="One line. It shows in the invite form.">
        <input
          id="role-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Runs the support desk"
          className={FIELD_CLASS}
        />
      </Field>
    </ReasonDialog>
  );
}

const slugify = (value) =>
  (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
