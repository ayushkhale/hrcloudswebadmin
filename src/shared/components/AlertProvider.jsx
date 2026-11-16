// ─────────────────────────────────────────────────────────────────────────────
// AlertProvider.jsx — one place every message to the user comes out of.
//
// It gives the app three things and replaces the browser's own two:
//
//   await window.confirm("…")   an in-app question, NOT the OS box
//   window.alert("…")           an in-app notice
//   useToast().show("Saved")    the quiet confirmation after a write
//
// ⚠ window.confirm RETURNS A PROMISE HERE. Always await it:
//       if (!(await window.confirm("Suspend this organisation?"))) return;
//   Without `await` the Promise object is truthy, so the action runs while the
//   question is still on screen — which is how an unawaited confirm in the
//   main product once suspended things nobody agreed to.
//
// Why override the natives at all: a browser dialog is unstyled, blocks the
// whole tab, and says "localhost:5174 says". Overriding them means a stray
// alert() anywhere in the app still comes out in the product's own voice.
// ─────────────────────────────────────────────────────────────────────────────
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { HiCheckCircle, HiExclamationCircle, HiInformationCircle, HiQuestionMarkCircle, HiX } from "react-icons/hi";
import Dialog, { DialogButton } from "./Dialog";

// A dialog ignores its confirm button for this long after appearing, so the
// second click of a double-click on the button that OPENED it cannot answer it.
const ACCIDENTAL_CLICK_MS = 400;

const ToastContext = createContext({ show: () => {} });

/** `const toast = useToast(); toast.show("Plan updated")`. */
export function useToast() {
  return useContext(ToastContext);
}

// A toast is opaque in the dark theme, not a tint: it floats over whatever
// is underneath it, and a translucent one picks up the card behind it and
// stops being readable halfway along its own text.
const TOAST_TONE = {
  success: {
    icon: HiCheckCircle,
    className: "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-500/30 dark:bg-night-800 dark:text-violet-200",
    iconClass: "text-violet-600 dark:text-violet-300",
  },
  error: {
    icon: HiExclamationCircle,
    className: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-night-800 dark:text-rose-200",
    iconClass: "text-rose-600 dark:text-rose-300",
  },
  info: {
    icon: HiInformationCircle,
    className: "border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-500/30 dark:bg-night-800 dark:text-indigo-200",
    iconClass: "text-indigo-600 dark:text-indigo-300",
  },
};

export function AlertProvider({ children }) {
  // Both queues, so a second question asked while the first is open waits its
  // turn instead of replacing it.
  const [alerts, setAlerts] = useState([]);
  const [confirms, setConfirms] = useState([]);
  const [toasts, setToasts] = useState([]);
  const seq = useRef(0);
  const shownAt = useRef(0);

  const show = useCallback((message, tone = "success", ms = 3200) => {
    const id = ++seq.current;
    setToasts((list) => [...list, { id, message: String(message ?? ""), tone }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), ms);
  }, []);

  useEffect(() => {
    const nativeAlert = window.alert;
    const nativeConfirm = window.confirm;

    window.alert = (message) => {
      shownAt.current = Date.now();
      setAlerts((list) => [...list, { id: ++seq.current, message: String(message ?? "") }]);
    };

    window.confirm = (message) =>
      new Promise((resolve) => {
        shownAt.current = Date.now();
        setConfirms((list) => [...list, { id: ++seq.current, message: String(message ?? ""), resolve }]);
      });

    return () => {
      window.alert = nativeAlert;
      window.confirm = nativeConfirm;
    };
  }, []);

  const closeAlert = useCallback(() => setAlerts((list) => list.slice(1)), []);

  const answerConfirm = useCallback((value) => {
    setConfirms((list) => {
      const [current, ...rest] = list;
      current?.resolve(value);
      return rest;
    });
  }, []);

  const toastApi = useMemo(() => ({ show }), [show]);

  const alert = alerts[0];
  const confirm = confirms[0];
  // Guards the double-click case described at the top of the file.
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!confirm) return undefined;
    setArmed(false);
    const t = setTimeout(() => setArmed(true), ACCIDENTAL_CLICK_MS);
    return () => clearTimeout(t);
  }, [confirm?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ToastContext.Provider value={toastApi}>
      {children}

      {alert && (
        <Dialog
          size="sm"
          icon={HiInformationCircle}
          title="Just so you know"
          onClose={closeAlert}
          footer={<DialogButton variant="primary" onClick={closeAlert}>Got it</DialogButton>}
        >
          <p className="leading-relaxed">{alert.message}</p>
        </Dialog>
      )}

      {confirm && (
        <Dialog
          size="sm"
          icon={HiQuestionMarkCircle}
          title="Are you sure?"
          dismissible={false}
          footer={
            <>
              <DialogButton onClick={() => answerConfirm(false)}>Cancel</DialogButton>
              <DialogButton variant="primary" disabled={!armed} onClick={() => answerConfirm(true)}>
                Yes, continue
              </DialogButton>
            </>
          }
        >
          <p className="leading-relaxed">{confirm.message}</p>
        </Dialog>
      )}

      {/* Toasts sit above everything but the dialogs, and never cover the
          bottom-right of a form — they clear on their own. */}
      <div className="fixed bottom-5 right-5 z-[80] flex flex-col gap-2 pointer-events-none" role="status" aria-live="polite">
        {toasts.map((toast) => {
          const tone = TOAST_TONE[toast.tone] || TOAST_TONE.info;
          const Icon = tone.icon;
          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-center gap-2.5 pl-3.5 pr-2.5 py-2.5 rounded-2xl border shadow-lg text-xs font-bold max-w-sm ${tone.className}`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${tone.iconClass}`} />
              <span className="min-w-0">{toast.message}</span>
              <button
                type="button"
                onClick={() => setToasts((list) => list.filter((t) => t.id !== toast.id))}
                aria-label="Dismiss"
                className="shrink-0 p-1 rounded-lg hover:bg-black/5 transition-colors dark:hover:bg-white/10"
              >
                <HiX className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export default AlertProvider;
