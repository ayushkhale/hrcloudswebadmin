// ─────────────────────────────────────────────────────────────────────────────
// Dialog.jsx — the one modal shell. Every dialog in this console is this
// component with different children; nobody hand-rolls a `fixed inset-0`.
//
// What it already does, so no screen has to: dims the page, closes on Escape
// and on a backdrop click, traps focus inside itself, returns focus to
// whatever opened it, and locks the page behind it from scrolling.
//
// `tone="danger"` is for anything that destroys or cuts off access — the only
// place rose appears in this product.
//
// The dim layer is darker in the dark theme. `slate-900/40` over a near-black
// page is barely a change, and a modal you can't tell is modal is how someone
// ends up clicking the page behind the question they were asked.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef } from "react";
import { HiX } from "react-icons/hi";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const WIDTH = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
};

export default function Dialog({
  open = true,
  onClose,
  title,
  subtitle,
  icon: Icon,
  tone = "default",
  size = "md",
  children,
  footer,
  // A dialog that must be answered — no Escape, no backdrop, no close button.
  dismissible = true,
}) {
  const panelRef = useRef(null);
  const returnFocusRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    returnFocusRef.current = document.activeElement;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    // Focus the first thing inside, so a keyboard lands in the dialog rather
    // than on the page behind it.
    const first = panelRef.current?.querySelector(FOCUSABLE);
    (first || panelRef.current)?.focus?.();

    const onKeyDown = (e) => {
      if (e.key === "Escape" && dismissible) {
        e.preventDefault();
        onClose?.();
        return;
      }
      if (e.key !== "Tab") return;
      // Tab must not walk out of the dialog and into the page behind it.
      const items = Array.from(panelRef.current?.querySelectorAll(FOCUSABLE) || []);
      if (items.length === 0) return;
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstItem) {
        e.preventDefault();
        lastItem.focus();
      } else if (!e.shiftKey && document.activeElement === lastItem) {
        e.preventDefault();
        firstItem.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
      returnFocusRef.current?.focus?.();
    };
  }, [open, onClose, dismissible]);

  if (!open) return null;

  const danger = tone === "danger";

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm dark:bg-black/70"
      onMouseDown={(e) => {
        if (dismissible && e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        tabIndex={-1}
        className={`w-full ${
          WIDTH[size] || WIDTH.md
        } bg-white rounded-3xl shadow-2xl border border-slate-100 outline-none overflow-hidden dark:bg-night-850 dark:border-night-600`}
      >
        <div className="flex items-start gap-3 p-6 pb-4">
          {Icon && (
            <span
              className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                danger
                  ? "bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300"
                  : "bg-purple-50 text-purple-600 dark:bg-purple-500/15 dark:text-purple-300"
              }`}
            >
              <Icon className="w-5 h-5" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            {title && <h2 className="text-lg font-bold text-slate-800 leading-tight dark:text-slate-100">{title}</h2>}
            {subtitle && (
              <p className="text-xs font-medium text-slate-500 mt-1 leading-relaxed dark:text-slate-400">{subtitle}</p>
            )}
          </div>
          {dismissible && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="shrink-0 p-1.5 -mt-1 -mr-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors dark:hover:text-slate-200 dark:hover:bg-night-800"
            >
              <HiX className="w-5 h-5" />
            </button>
          )}
        </div>

        {children != null && <div className="px-6 pb-2 text-sm text-slate-600 dark:text-slate-300">{children}</div>}

        {footer && (
          <div className="flex items-center justify-end gap-2 px-6 py-4 mt-2 bg-slate-50/70 border-t border-slate-100 dark:bg-night-900/60 dark:border-night-700">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/** The buttons a dialog uses. Kept here so no two dialogs style them apart. */
export function DialogButton({ variant = "secondary", className = "", ...props }) {
  const base =
    "px-4 py-2.5 rounded-xl text-xs font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed";
  // The coloured buttons keep their colour in both themes — a primary action
  // that changes shade between themes stops being recognisable as the primary
  // action. Only the shadow goes, and the secondary button, which is defined
  // by the surface it sits on.
  const tones = {
    primary:
      "bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white shadow-sm shadow-purple-200 dark:shadow-none",
    danger: "bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-sm shadow-rose-200 dark:shadow-none",
    secondary:
      "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800 dark:bg-night-800 dark:border-night-600 dark:text-slate-300 dark:hover:bg-night-700 dark:hover:text-slate-100",
  };
  return <button type="button" className={`${base} ${tones[variant] || tones.secondary} ${className}`} {...props} />;
}
