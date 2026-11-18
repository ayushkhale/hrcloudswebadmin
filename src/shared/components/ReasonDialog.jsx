// ─────────────────────────────────────────────────────────────────────────────
// ReasonDialog.jsx — the shell for every write that changes somebody's access
// or somebody's bill.
//
// Six endpoints take a `reason` of 5–500 characters (#284, #285, #291, #292,
// #293, #294, #295) and every one of them is a thing a customer might later
// ask about. Rather than six dialogs that each validate the field slightly
// differently, there is this: one dialog, one validator from
// `config/platformMeta`, one submitting state, one place server errors land.
//
// What it guarantees, so no screen has to remember:
//
//   • THE ORGANISATION OR PERSON IS NAMED IN THE QUESTION. House rule §10:
//     anything touching a customer's data or money is confirmed by name. "Are
//     you sure?" is not a confirmation, it is a formality.
//   • The reason is validated before the round trip, so nobody waits two
//     seconds to be told they typed four characters.
//   • The submit button is disabled while the write is in flight, so a second
//     click can't send a second suspend.
//   • A server error is shown INSIDE the dialog with the form still filled in.
//     Closing the dialog on failure throws away a reason somebody just typed.
//   • `onSubmit` may return a string, which is shown as the success toast by
//     the caller — the `changed: false` case needs different words from the
//     `changed: true` case, and only the caller knows which it got.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import { HiExclamationCircle } from "react-icons/hi";

import Dialog, { DialogButton } from "./Dialog";
import { REASON, reasonError, writeErrorCopy } from "../../config/platformMeta";

export default function ReasonDialog({
  open = true,
  onClose,
  title,
  // The sentence that names what is about to happen, to whom. Required.
  subtitle,
  icon,
  tone = "default",
  confirmLabel = "Confirm",
  // Why this reason is being asked for, in the operator's terms.
  reasonLabel = "Why are you doing this?",
  reasonHint = "This goes in the audit trail under your name.",
  // Anything the specific action needs above the reason box: a plan picker, a
  // seat field. The dialog owns the reason and nothing else.
  children,
  // Blocks submit while the caller's own fields are incomplete.
  disabled = false,
  onSubmit,
}) {
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState(null);

  const invalid = reasonError(reason);
  const showInvalid = touched && invalid;

  async function submit() {
    setTouched(true);
    if (invalid || disabled || submitting) return;
    setServerError(null);
    setSubmitting(true);
    try {
      await onSubmit(reason.trim());
      // The caller closes on success. It knows whether it also needs to
      // reload a list, and in what order.
    } catch (err) {
      // The server's code, translated. The raw message is the fallback rather
      // than the first choice: `ORG_STATUS_CHANGE_CONFLICT` means nothing to
      // the person reading it.
      setServerError(writeErrorCopy(err?.code, err?.message || "That didn’t go through. Try again."));
      setSubmitting(false);
    }
  }

  const remaining = REASON.MAX - reason.trim().length;

  return (
    <Dialog
      open={open}
      // A write in flight must not be dismissable: closing the dialog would
      // leave the operator with no idea whether the suspend landed.
      onClose={submitting ? undefined : onClose}
      dismissible={!submitting}
      title={title}
      subtitle={subtitle}
      icon={icon}
      tone={tone}
      footer={
        <>
          <DialogButton onClick={onClose} disabled={submitting}>
            Cancel
          </DialogButton>
          <DialogButton
            variant={tone === "danger" ? "danger" : "primary"}
            onClick={submit}
            disabled={submitting || disabled || Boolean(invalid)}
          >
            {submitting ? "Working…" : confirmLabel}
          </DialogButton>
        </>
      }
    >
      <div className="space-y-4">
        {children}

        <div>
          <label htmlFor="reason-field" className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 dark:text-slate-400">
            {reasonLabel}
          </label>
          <textarea
            id="reason-field"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onBlur={() => setTouched(true)}
            maxLength={REASON.MAX}
            disabled={submitting}
            placeholder="Agreed with the customer on a call this morning…"
            className={`w-full px-3.5 py-2.5 rounded-xl border bg-white text-sm text-slate-700 placeholder:text-slate-400 outline-none transition-colors resize-none disabled:opacity-60 dark:bg-night-900 dark:text-slate-100 dark:placeholder:text-slate-500 ${
              showInvalid
                ? "border-rose-300 focus:border-rose-400 dark:border-rose-500/40"
                : "border-slate-200 focus:border-purple-400 dark:border-night-600 dark:focus:border-purple-500/60"
            }`}
          />
          <div className="flex items-start justify-between gap-3 mt-1.5">
            <p className={`text-[11px] font-semibold leading-relaxed ${showInvalid ? "text-rose-600 dark:text-rose-400" : "text-slate-400 dark:text-slate-500"}`}>
              {showInvalid ? invalid : reasonHint}
            </p>
            {/* Only shown as the limit gets close. A counter on an empty box
                is clutter; a counter at 480 characters is information. */}
            {remaining <= 80 && (
              <p className="text-[11px] font-bold text-slate-400 shrink-0 tabular-nums dark:text-slate-500">{remaining}</p>
            )}
          </div>
        </div>

        {serverError && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-100 dark:bg-rose-500/10 dark:border-rose-500/25">
            <HiExclamationCircle className="w-4 h-4 text-rose-600 shrink-0 mt-px dark:text-rose-400" />
            <p className="text-xs font-semibold text-rose-700 leading-relaxed dark:text-rose-300">{serverError}</p>
          </div>
        )}
      </div>
    </Dialog>
  );
}

/** A labelled field for the rows a specific action adds above the reason. */
export function Field({ label, hint, htmlFor, children }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 dark:text-slate-400">
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px] font-semibold text-slate-400 mt-1.5 leading-relaxed dark:text-slate-500">{hint}</p>}
    </div>
  );
}

/** The input and select styling, so the dialog's fields match the reason box. */
export const FIELD_CLASS =
  "w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:border-purple-400 transition-colors disabled:opacity-60 dark:bg-night-900 dark:border-night-600 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-purple-500/60";
