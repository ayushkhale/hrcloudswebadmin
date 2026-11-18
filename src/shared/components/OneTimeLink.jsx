// ─────────────────────────────────────────────────────────────────────────────
// OneTimeLink.jsx — an activation link the server will never send again.
//
// #283, #294 and #295 each return an `activation_link` ONCE, in the response
// body. There is no endpoint to fetch it back. If the operator closes the
// dialog without copying it and the email bounced, the only remaining fix is
// a database edit — so this component is deliberately hard to miss and the
// dialog that shows it does not auto-close.
//
// `emailDelivered: false` IS NOT AN ERROR. The access was granted; the email
// just didn't leave the building. Drawing it in rose would have an operator
// re-invite somebody who already has access — and a second invite invalidates
// the first link, which is how a bounced email becomes two dead links. It is
// fuchsia: waiting on somebody, and that somebody is now the operator.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import { HiCheck, HiClipboardCopy, HiMail } from "react-icons/hi";

export default function OneTimeLink({ link, emailDelivered }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      // Falls back to "copy" after a moment rather than staying green
      // forever: an operator doing two invitations in a row needs to see the
      // second one confirm too.
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // A denied clipboard permission is not worth an error state — the link
      // is on screen and selectable, which is the actual fallback.
      setCopied(false);
    }
  }

  return (
    <div className="space-y-3">
      <div
        className={`flex items-start gap-2 p-3 rounded-xl border ${
          emailDelivered === false
            ? "bg-fuchsia-50 border-fuchsia-100 dark:bg-fuchsia-500/10 dark:border-fuchsia-500/25"
            : "bg-indigo-50 border-indigo-100 dark:bg-indigo-500/10 dark:border-indigo-500/25"
        }`}
      >
        <HiMail
          className={`w-4 h-4 shrink-0 mt-px ${
            emailDelivered === false ? "text-fuchsia-600 dark:text-fuchsia-300" : "text-indigo-600 dark:text-indigo-300"
          }`}
        />
        <p
          className={`text-xs font-semibold leading-relaxed ${
            emailDelivered === false ? "text-fuchsia-800 dark:text-fuchsia-200" : "text-indigo-800 dark:text-indigo-200"
          }`}
        >
          {emailDelivered === false
            ? "The invitation email didn’t go out. Send this link to them yourself — it is the only copy."
            : "The invitation email has gone out. This link is the only copy, in case it doesn’t arrive."}
        </p>
      </div>

      <div className="flex items-stretch gap-2">
        <input
          readOnly
          value={link}
          onFocus={(e) => e.target.select()}
          aria-label="Activation link"
          className="flex-1 min-w-0 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono text-slate-600 outline-none focus:border-purple-400 dark:bg-night-900 dark:border-night-600 dark:text-slate-300"
        />
        <button
          type="button"
          onClick={copy}
          className="shrink-0 inline-flex items-center gap-1.5 px-3.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-colors"
        >
          {copied ? <HiCheck className="w-3.5 h-3.5" /> : <HiClipboardCopy className="w-3.5 h-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <p className="text-[11px] font-semibold text-slate-400 leading-relaxed dark:text-slate-500">
        It stops working the moment it is used, and it won’t be shown again.
      </p>
    </div>
  );
}
